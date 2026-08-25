"""JMdict/KANJIDIC2 lookups (via jamdict) for the dictionary feature.

Owns the jamdict instance, the word-lookup and kanji-breakdown caches, and
composes JMdict's raw entries into the API's response shapes — including
running English definitions/kanji meanings through
`dictionary_ai.translate_batch`.
"""
import asyncio
import re
from typing import List, Optional

from jamdict import Jamdict

from app.schemas.dictionary import Definition, KanjiInfo, LookupResponse
from app.services import dictionary_ai
from app.utils.pos_labels import translate_pos_list

CJK_RE = re.compile(r'[一-鿿]')

_lookup_cache: dict = {}
_kanji_cache: dict = {}

try:
    jmdict = Jamdict()
    print("JMdict loaded successfully", flush=True)
except Exception as e:
    print(f"Warning: JMdict failed to load: {e}", flush=True)
    jmdict = None


def is_available() -> bool:
    return jmdict is not None


async def fetch_definitions(entry) -> List[Definition]:
    senses_data = []
    for sense in entry.senses[:5]:
        glosses = [g.text for g in sense.gloss if g.text] if hasattr(sense, 'gloss') else []
        if glosses:
            english_text = ', '.join(glosses)
            pos_list = list(sense.pos) if hasattr(sense, 'pos') and sense.pos else []
            pos = ", ".join(pos_list)
            pos_label = translate_pos_list(pos_list)
            senses_data.append((english_text, pos, pos_label))
    if not senses_data:
        return []
    english_texts = [en for en, _, _ in senses_data]
    translated = await dictionary_ai.translate_batch(english_texts)
    return [
        Definition(meaning=vi, pos=pos, pos_label=pos_label)
        for vi, (_, pos, pos_label) in zip(translated, senses_data)
    ]


async def fetch_kanji_breakdown(text: str) -> List[KanjiInfo]:
    """Kanji breakdown from KANJIDIC2, bundled in jamdict."""
    if not jmdict:
        return []
    literals = []
    for ch in text:
        if CJK_RE.match(ch) and ch not in literals:
            literals.append(ch)
    if not literals:
        return []

    pending = []  # info dicts (without translated meaning) for literals not yet cached
    results_by_literal = {}
    for literal in literals:
        if literal in _kanji_cache:
            results_by_literal[literal] = _kanji_cache[literal]
            continue
        try:
            lookup = jmdict.lookup(literal)
        except Exception as e:
            print(f"[Kanji lookup] Error for '{literal}': {e}", flush=True)
            continue
        if not lookup.chars:
            continue
        kchar = lookup.chars[0]
        on_yomi, kun_yomi, hanviet, meanings_en = [], [], [], []
        for rmg in kchar.rm_groups:
            for rd in rmg.readings:
                if rd.r_type == 'ja_on' and rd.value not in on_yomi:
                    on_yomi.append(rd.value)
                elif rd.r_type == 'ja_kun' and rd.value not in kun_yomi:
                    kun_yomi.append(rd.value)
                elif rd.r_type == 'vietnam' and rd.value not in hanviet:
                    hanviet.append(rd.value)
            for m in rmg.meanings:
                if not m.m_lang and m.value not in meanings_en:
                    meanings_en.append(m.value)
        pending.append({
            "literal": literal,
            "on_yomi": on_yomi,
            "kun_yomi": kun_yomi,
            "hanviet": hanviet,
            "stroke_count": kchar.stroke_count,
            "jlpt": str(kchar.jlpt) if kchar.jlpt else None,
            "grade": str(kchar.grade) if kchar.grade else None,
            "meaning_en": ', '.join(meanings_en[:4]),
        })

    if pending:
        translated = await dictionary_ai.translate_batch([p["meaning_en"] for p in pending])
        for info, meaning_vi in zip(pending, translated):
            kanji_info = KanjiInfo(
                literal=info["literal"], on_yomi=info["on_yomi"], kun_yomi=info["kun_yomi"],
                hanviet=info["hanviet"], meaning=meaning_vi, stroke_count=info["stroke_count"],
                jlpt=info["jlpt"], grade=info["grade"],
            )
            _kanji_cache[info["literal"]] = kanji_info
            results_by_literal[info["literal"]] = kanji_info

    return [results_by_literal[literal] for literal in literals if literal in results_by_literal]


async def lookup_word(word: str) -> Optional[LookupResponse]:
    """Full JMdict lookup for one word, cached. Returns None if JMdict isn't loaded."""
    if not jmdict:
        return None

    if word in _lookup_cache:
        print(f"[Cache HIT] '{word}'", flush=True)
        return _lookup_cache[word]

    result = jmdict.lookup(word)
    if not result.entries:
        response = LookupResponse(
            word=word, reading="", definitions=[],
            examples=[], synonyms=[], jlpt="N/A", frequency="N/A", kanji=[]
        )
        _lookup_cache[word] = response
        return response

    entry = result.entries[0]
    kanji = word
    if entry.kanji_forms:
        kanji = entry.kanji_forms[0].text
    elif entry.kana_forms:
        kanji = entry.kana_forms[0].text

    reading = entry.kana_forms[0].text if entry.kana_forms else ""
    definitions, kanji_breakdown = await asyncio.gather(
        fetch_definitions(entry), fetch_kanji_breakdown(kanji)
    )
    jlpt = str(entry.jlpt_old) if hasattr(entry, 'jlpt_old') and entry.jlpt_old else \
           str(entry.jlpt) if hasattr(entry, 'jlpt') and entry.jlpt else "N/A"
    frequency = str(entry.frequency) if hasattr(entry, 'frequency') and entry.frequency else "N/A"

    print(f"[Jamdict] '{kanji}' ({reading}) - {len(definitions)} defs", flush=True)

    response = LookupResponse(
        word=kanji, reading=reading, definitions=definitions,
        examples=[], synonyms=[], jlpt=jlpt, frequency=frequency,
        kanji=kanji_breakdown,
    )
    _lookup_cache[word] = response
    return response
