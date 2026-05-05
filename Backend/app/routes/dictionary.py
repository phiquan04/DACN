# app/routes/dictionary.py
import os
import json
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from jamdict import Jamdict
from googletrans import Translator

router = APIRouter(prefix="/dictionary", tags=["dictionary"])

# Khởi tạo Jamdict một lần (global)
try:
    jmdict = Jamdict()
    print("JMdict loaded successfully", flush=True)
except Exception as e:
    print(f"Warning: JMdict failed to load: {e}", flush=True)
    jmdict = None

# Khởi tạo Translator cho dịch Anh -> Việt
translator = Translator()

class LookupRequest(BaseModel):
    word: str

class Definition(BaseModel):
    meaning: str
    pos: str

class Example(BaseModel):
    japanese: str
    vietnamese: str

class LookupResponse(BaseModel):
    word: str
    reading: str
    definitions: List[Definition]
    examples: List[Example]
    jlpt: str
    frequency: str

def translate_to_vietnamese(text: str) -> str:
    """Dịch văn bản tiếng Anh sang tiếng Việt, nếu lỗi thì trả về nguyên bản."""
    if not text or not isinstance(text, str):
        return ""
    try:
        result = translator.translate(text, src='en', dest='vi')
        return result.text
    except Exception as e:
        print(f"Translation error: {e}", flush=True)
        return text

@router.post("/lookup", response_model=LookupResponse)
async def dictionary_lookup(req: LookupRequest):
    """
    Tra từ điển Nhật - Việt (JMdict) qua Jamdict.
    """
    word = req.word.strip()
    if not word:
        raise HTTPException(status_code=400, detail="Missing word parameter")

    if not jmdict:
        raise HTTPException(status_code=503, detail="Dictionary service not available")

    print(f"[Jamdict] Lookup: '{word}'", flush=True)
    result = jmdict.lookup(word)

    if not result.entries:
        return LookupResponse(
            word=word,
            reading="",
            definitions=[],
            examples=[],
            jlpt="N/A",
            frequency="N/A"
        )

    entry = result.entries[0]

    # --- 1. Dạng viết (kanji hoặc kana) ---
    kanji = word
    if entry.kanji_forms:
        kanji = entry.kanji_forms[0].text
    elif entry.kana_forms:
        kanji = entry.kana_forms[0].text

    # --- 2. Cách đọc ---
    reading = ""
    if entry.kana_forms:
        reading = entry.kana_forms[0].text

    # --- 3. Định nghĩa (dịch Anh -> Việt) ---
    definitions = []
    if entry.senses:
        for sense in entry.senses[:5]:  # giới hạn 5 nghĩa
            english_glosses = []
            if hasattr(sense, 'gloss') and sense.gloss:
                english_glosses = [g.text for g in sense.gloss if g.text]
            if not english_glosses:
                continue

            english_text = ', '.join(english_glosses)
            vietnamese_text = translate_to_vietnamese(english_text)

            pos = ""
            if hasattr(sense, 'pos') and sense.pos:
                pos = ', '.join(sense.pos)

            definitions.append(Definition(meaning=vietnamese_text, pos=pos))

    # --- 4. Câu ví dụ ---
    examples = []
    if entry.senses:
        for sense in entry.senses:
            if hasattr(sense, 'examples') and sense.examples:
                for ex in sense.examples[:3]:
                    jp_text = ex.japanese if hasattr(ex, 'japanese') else ''
                    en_text = ex.english if hasattr(ex, 'english') else ''
                    vi_text = translate_to_vietnamese(en_text) if en_text else ''
                    if jp_text:
                        examples.append(Example(japanese=jp_text, vietnamese=vi_text))
            elif hasattr(sense, 'sentence_examples') and sense.sentence_examples:
                for ex in sense.sentence_examples[:3]:
                    jp_text = ex.japanese if hasattr(ex, 'japanese') else ''
                    en_text = ex.english if hasattr(ex, 'english') else ''
                    vi_text = translate_to_vietnamese(en_text) if en_text else ''
                    if jp_text:
                        examples.append(Example(japanese=jp_text, vietnamese=vi_text))

    if not examples and hasattr(entry, 'examples') and entry.examples:
        for ex in entry.examples[:5]:
            jp_text = ex.japanese if hasattr(ex, 'japanese') else ''
            en_text = ex.english if hasattr(ex, 'english') else ''
            vi_text = translate_to_vietnamese(en_text) if en_text else ''
            if jp_text:
                examples.append(Example(japanese=jp_text, vietnamese=vi_text))

    # --- 5. JLPT & frequency ---
    jlpt = "N/A"
    frequency = "N/A"
    if hasattr(entry, 'jlpt_old') and entry.jlpt_old:
        jlpt = str(entry.jlpt_old)
    elif hasattr(entry, 'jlpt') and entry.jlpt:
        jlpt = str(entry.jlpt)
    if hasattr(entry, 'frequency') and entry.frequency:
        frequency = str(entry.frequency)

    print(f"[Jamdict] Found '{kanji}' ({reading}) - {len(definitions)} definitions, {len(examples)} examples", flush=True)

    return LookupResponse(
        word=kanji,
        reading=reading,
        definitions=definitions,
        examples=examples,
        jlpt=jlpt,
        frequency=frequency
    )