"""Shared Japanese grammar-grading logic: normalize -> BERT GEC correction ->
character diff -> LLM explanation. Used by both the standalone /correct
endpoint and the chatbot's per-message grading, so the (expensive, ~1.3GB)
GEC checkpoint is only loaded once.
"""
import re
import unicodedata
from difflib import ndiff

from app.services.grammar_ai import generate_explanation
from model import GEC

gec_model = GEC(pretrained_weights_path='data/model/model_checkpoint')

# Matches one sentence including its terminator (。！？), or a trailing
# fragment with no terminator at all.
_SENTENCE_RE = re.compile(r'[^。！？]*[。！？]|[^。！？]+')


def _split_sentences(text: str) -> list:
    return _SENTENCE_RE.findall(text)


def grade_text(text: str) -> dict:
    """Normalizes `text`, runs it through the GEC model, and asks the LLM to
    explain the diff. Returns {corrected_text, diffs, error_count, explanation, has_errors}.

    `has_errors` is based on whether the LLM could actually explain a real
    problem, not on raw string inequality: the GEC model occasionally emits a
    cosmetic difference (e.g. punctuation) that isn't a genuine grammar
    error, and `generate_explanation` correctly comes back empty for those —
    using `original != corrected` alone would flag it as an "error" anyway
    with nothing to show for why.

    The GEC model is a per-token tagger whose predictions for a given token
    depend on the full sequence it's fed — a real error inside one sentence
    of a multi-sentence paragraph can go undetected simply because the
    surrounding sentences shift its context, even though the same sentence
    checked alone would be flagged correctly. Grading sentence-by-sentence
    (split on 。！？) keeps each prediction in the same kind of short context
    the model sees for a single chat message, instead of diluting it across
    an entire pasted paragraph.
    """
    normalized = unicodedata.normalize('NFKC', text).replace(' ', '')
    sentences = _split_sentences(normalized)
    corrected_text = ''.join(gec_model.correct(sentences)) if sentences else ''
    diffs = list(ndiff(normalized, corrected_text))
    error_count = sum(1 for d in diffs if d.startswith('- ') or d.startswith('+ '))
    explanation = generate_explanation(normalized, corrected_text, diffs)

    return {
        "original_text": normalized,
        "corrected_text": corrected_text,
        "diffs": diffs,
        "error_count": error_count,
        "explanation": explanation,
        "has_errors": bool(explanation),
    }
