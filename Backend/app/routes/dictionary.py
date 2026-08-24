import os
import re
import sys
import asyncio
import json
import hashlib
import tempfile
import requests
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from jamdict import Jamdict
from deep_translator import GoogleTranslator
from gtts import gTTS
from sqlalchemy.orm import Session

_backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

try:
    from app.models.database import get_db, SearchHistory, User
    from app.utils.pos_labels import translate_pos_list
except ModuleNotFoundError:
    _alt_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if _alt_root not in sys.path:
        sys.path.insert(0, _alt_root)
    from database import get_db, SearchHistory, User
    from utils.pos_labels import translate_pos_list

router = APIRouter(prefix="/dictionary", tags=["dictionary"])

# Caches
_cache: dict = {}
_translation_cache: dict = {}
_example_cache: dict = {}
_synonym_cache: dict = {}
_kanji_cache: dict = {}

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# gTTS audio is regenerated the first time a word/text is requested, then
# served from disk on every later request (same cache-aside pattern as
# app/routes/pronunciation.py's reference audio).
_audio_cache_dir = os.path.join(tempfile.gettempdir(), "dictionary_audio")
os.makedirs(_audio_cache_dir, exist_ok=True)

CJK_RE = re.compile(r'[一-鿿]')

try:
    jmdict = Jamdict()
    print("JMdict loaded successfully", flush=True)
except Exception as e:
    print(f"Warning: JMdict failed to load: {e}", flush=True)
    jmdict = None

translator = GoogleTranslator(source='en', target='vi')

class LookupRequest(BaseModel):
    word: str

class Definition(BaseModel):
    meaning: str
    pos: str
    pos_label: str = ""

class Example(BaseModel):
    japanese: str
    vietnamese: str

class KanjiInfo(BaseModel):
    literal: str
    on_yomi: List[str] = []
    kun_yomi: List[str] = []
    hanviet: List[str] = []
    meaning: str = ""
    stroke_count: Optional[int] = None
    jlpt: Optional[str] = None
    grade: Optional[str] = None

class LookupResponse(BaseModel):
    word: str
    reading: str
    definitions: List[Definition]
    examples: List[Example]
    synonyms: List[str]
    jlpt: str
    frequency: str
    kanji: List[KanjiInfo] = []

class SaveHistoryRequest(BaseModel):
    user_id: int
    word: str
    reading: Optional[str] = ""
    meaning: Optional[str] = ""
    examples: Optional[List[dict]] = []
    synonyms: Optional[List[str]] = []

class HistoryItem(BaseModel):
    id: int
    word: str
    reading: Optional[str] = ""
    meaning: Optional[str] = ""
    examples: Optional[List[dict]] = []
    synonyms: Optional[List[str]] = []
    created_at: str

# ---------- Helper: Gemini call ----------
async def call_gemini(prompt: str) -> str:
    """Call Gemini API and return the text response."""
    if not GEMINI_API_KEY:
        print("Warning: GEMINI_API_KEY is not set", flush=True)
        return ""

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash-lite:generateContent?key={GEMINI_API_KEY}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 500, "temperature": 0.7},
    }
    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: requests.post(url, json=payload, timeout=8),  # timeout 8s
        )
        if response.status_code == 200:
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        else:
            print(f"Gemini error: {response.status_code} - {response.text}", flush=True)
            return ""
    except Exception as e:
        print(f"Gemini exception: {e}", flush=True)
        return ""

# ---------- Translation ----------
async def translate_batch(texts: List[str]) -> List[str]:
    results = []
    for i, text in enumerate(texts):
        if i > 0:
            await asyncio.sleep(0.05)
        cache_key = f"trans:{text}"
        if cache_key in _translation_cache:
            results.append(_translation_cache[cache_key])
        else:
            try:
                result = await asyncio.get_event_loop().run_in_executor(
                    None, translator.translate, text
                )
                _translation_cache[cache_key] = result
                results.append(result)
            except Exception as e:
                print(f"Translation error for '{text}': {e}", flush=True)
                results.append(text)
    return results

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
    translated = await translate_batch(english_texts)
    return [
        Definition(meaning=vi, pos=pos, pos_label=pos_label)
        for vi, (_, pos, pos_label) in zip(translated, senses_data)
    ]

# ---------- Kanji breakdown (from KANJIDIC2, bundled in jamdict) ----------
async def fetch_kanji_breakdown(text: str) -> List[KanjiInfo]:
    if not jmdict:
        return []
    literals = []
    for ch in text:
        if CJK_RE.match(ch) and ch not in literals:
            literals.append(ch)
    if not literals:
        return []

    pending = []  # (info dict without meaning, english meaning text) for literals not yet cached
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
        translated = await translate_batch([p["meaning_en"] for p in pending])
        for info, meaning_vi in zip(pending, translated):
            kanji_info = KanjiInfo(
                literal=info["literal"], on_yomi=info["on_yomi"], kun_yomi=info["kun_yomi"],
                hanviet=info["hanviet"], meaning=meaning_vi, stroke_count=info["stroke_count"],
                jlpt=info["jlpt"], grade=info["grade"],
            )
            _kanji_cache[info["literal"]] = kanji_info
            results_by_literal[info["literal"]] = kanji_info

    return [results_by_literal[literal] for literal in literals if literal in results_by_literal]

# ---------- Examples endpoint ----------
@router.get("/examples/{word}")
async def get_examples(word: str):
    """Generate example sentences using Gemini."""
    word = word.strip()
    if not word:
        return []

    if word in _example_cache:
        return _example_cache[word]

    prompt = (
        f'Hãy tạo 3 câu ví dụ bằng tiếng Nhật cho từ "{word}". '
        f'Mỗi câu ví dụ phải có:\n'
        f'- Một câu tiếng Nhật tự nhiên, trình độ N4-N3.\n'
        f'- Bản dịch tiếng Việt bên dưới.\n'
        f'Xuất kết quả dưới dạng JSON list, mỗi object có key "japanese" và "vietnamese". '
        f'Không thêm bất kỳ văn bản nào khác ngoài JSON.\n'
        f'Ví dụ: [{{"japanese": "今日はいい天気ですね。", "vietnamese": "Hôm nay thời tiết đẹp nhỉ."}}]'
    )

    response = await call_gemini(prompt)
    if not response:
        return []

    try:
        json_match = re.search(r'\[.*\]', response, re.DOTALL)
        if json_match:
            examples = json.loads(json_match.group())
        else:
            examples = json.loads(response)
        if isinstance(examples, list) and all("japanese" in e and "vietnamese" in e for e in examples):
            _example_cache[word] = examples
            return examples
    except Exception as e:
        print(f"Failed to parse examples: {e}\nResponse: {response}", flush=True)
    return []

# ---------- Synonyms endpoint ----------
@router.get("/synonyms/{word}")
async def get_synonyms(word: str):
    """Generate synonyms/related words using Gemini."""
    word = word.strip()
    if not word:
        return []

    if word in _synonym_cache:
        return _synonym_cache[word]

    prompt = (
        f'Liệt kê 2-3 từ đồng nghĩa hoặc có liên quan chặt chẽ đến từ "{word}" trong tiếng Nhật.\n'
        f'Chỉ trả về một mảng JSON các chuỗi, không có văn bản khác.\n'
        f'Ví dụ: ["言葉", "単語", "用語"]'
    )

    response = await call_gemini(prompt)
    if not response:
        return []

    try:
        json_match = re.search(r'\[.*\]', response, re.DOTALL)
        if json_match:
            synonyms = json.loads(json_match.group())
        else:
            synonyms = json.loads(response)
        if isinstance(synonyms, list):
            _synonym_cache[word] = synonyms
            return synonyms
    except Exception as e:
        print(f"Failed to parse synonyms: {e}\nResponse: {response}", flush=True)
    return []

# ---------- Search History endpoints ----------
@router.post("/history/save")
async def save_search_history(req: SaveHistoryRequest, db: Session = Depends(get_db)):
    """Save a word lookup to user's search history. Upsert by user+word."""
    existing = db.query(SearchHistory).filter(
        SearchHistory.user_id == req.user_id,
        SearchHistory.word == req.word
    ).first()

    if existing:
        existing.reading = req.reading
        existing.meaning = req.meaning
        existing.examples = req.examples or []
        existing.synonyms = req.synonyms or []
        from datetime import datetime
        existing.created_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        record = existing
    else:
        record = SearchHistory(
            user_id=req.user_id,
            word=req.word,
            reading=req.reading,
            meaning=req.meaning,
            examples=req.examples or [],
            synonyms=req.synonyms or [],
        )
        db.add(record)
        db.commit()
        db.refresh(record)

    return {"success": True, "id": record.id}

@router.get("/history/{user_id}")
async def get_search_history(user_id: int, db: Session = Depends(get_db)):
    records = (
        db.query(SearchHistory)
        .filter(SearchHistory.user_id == user_id)
        .order_by(SearchHistory.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": r.id,
            "word": r.word,
            "reading": r.reading or "",
            "meaning": r.meaning or "",
            "examples": r.examples or [],
            "synonyms": r.synonyms or [],
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in records
    ]

@router.delete("/history/{user_id}/{history_id}")
async def delete_history_item(user_id: int, history_id: int, db: Session = Depends(get_db)):
    record = db.query(SearchHistory).filter(
        SearchHistory.id == history_id,
        SearchHistory.user_id == user_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="History item not found")
    db.delete(record)
    db.commit()
    return {"success": True}

@router.delete("/history/{user_id}")
async def clear_history(user_id: int, db: Session = Depends(get_db)):
    db.query(SearchHistory).filter(SearchHistory.user_id == user_id).delete()
    db.commit()
    return {"success": True}

# ---------- Main lookup ----------
@router.post("/lookup", response_model=LookupResponse)
async def dictionary_lookup(req: LookupRequest):
    word = req.word.strip()
    if not word:
        raise HTTPException(status_code=400, detail="Missing word parameter")
    if not jmdict:
        raise HTTPException(status_code=503, detail="Dictionary service not available")

    if word in _cache:
        print(f"[Cache HIT] '{word}'", flush=True)
        return _cache[word]

    result = jmdict.lookup(word)
    if not result.entries:
        response = LookupResponse(
            word=word, reading="", definitions=[],
            examples=[], synonyms=[], jlpt="N/A", frequency="N/A"
        )
        _cache[word] = response
        return response

    entry = result.entries[0]
    kanji = word
    if entry.kanji_forms:
        kanji = entry.kanji_forms[0].text
    elif entry.kana_forms:
        kanji = entry.kana_forms[0].text

    reading = entry.kana_forms[0].text if entry.kana_forms else ""
    definitions = await fetch_definitions(entry)
    kanji_breakdown = await fetch_kanji_breakdown(kanji)
    jlpt = str(entry.jlpt_old) if hasattr(entry, 'jlpt_old') and entry.jlpt_old else \
           str(entry.jlpt) if hasattr(entry, 'jlpt') and entry.jlpt else "N/A"
    frequency = str(entry.frequency) if hasattr(entry, 'frequency') and entry.frequency else "N/A"

    print(f"[Jamdict] '{kanji}' ({reading}) - {len(definitions)} defs", flush=True)

    response = LookupResponse(
        word=kanji, reading=reading, definitions=definitions,
        examples=[], synonyms=[], jlpt=jlpt, frequency=frequency,
        kanji=kanji_breakdown,
    )
    _cache[word] = response
    return response

# ---------- Pronunciation audio ----------
@router.get("/audio")
async def get_pronunciation_audio(text: str):
    """Serve gTTS audio for a word or reading, generating it once and caching on disk."""
    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Missing 'text' query parameter")

    filename = f"{hashlib.md5(text.encode('utf-8')).hexdigest()}.mp3"
    path = os.path.join(_audio_cache_dir, filename)
    if not os.path.exists(path):
        try:
            await asyncio.get_event_loop().run_in_executor(
                None, lambda: gTTS(text=text, lang='ja', slow=False).save(path)
            )
        except Exception as e:
            print(f"[Dictionary TTS] Failed for '{text}': {e}", flush=True)
            raise HTTPException(status_code=502, detail="Failed to generate audio")

    return FileResponse(path, media_type="audio/mpeg")