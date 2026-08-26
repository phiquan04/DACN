"""Shared Japanese grammar-grading logic: normalize -> BERT GEC correction ->
character diff -> LLM explanation. Used by both the standalone /correct
endpoint and the chatbot's per-message grading, so the (expensive, ~1.3GB)
GEC checkpoint is only loaded once.
"""
import unicodedata
from difflib import ndiff

from app.services.grammar_ai import generate_explanation
from model import GEC

gec_model = GEC(pretrained_weights_path='data/model/model_checkpoint')


def grade_text(text: str) -> dict:
    """Normalizes `text`, runs it through the GEC model, and asks the LLM to
    explain the diff. Returns {corrected_text, diffs, error_count, explanation}.
    """
    normalized = unicodedata.normalize('NFKC', text).replace(' ', '')
    corrected_text = gec_model.correct(normalized)
    diffs = list(ndiff(normalized, corrected_text))
    error_count = sum(1 for d in diffs if d.startswith('- ') or d.startswith('+ '))
    explanation = generate_explanation(normalized, corrected_text, diffs)

    return {
        "original_text": normalized,
        "corrected_text": corrected_text,
        "diffs": diffs,
        "error_count": error_count,
        "explanation": explanation,
    }
