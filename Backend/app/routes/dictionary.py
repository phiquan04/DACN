import os
import re
import sys
import asyncio
import json
import requests
from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel
from typing import List, Optional
from jamdict import Jamdict
from deep_translator import GoogleTranslator
from sqlalchemy.orm import Session
from fastapi.concurrency import run_in_threadpool
import httpx
import os

_backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

try:
    from app.models.database import get_db, SearchHistory, User
except ModuleNotFoundError:
    _alt_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if _alt_root not in sys.path:
        sys.path.insert(0, _alt_root)
    from database import get_db, SearchHistory, User

router = APIRouter(prefix="/dictionary", tags=["dictionary"])

# Caches
_cache: dict = {}
_translation_cache: dict = {}
_example_cache: dict = {}
_synonym_cache: dict = {}
_meaning_search_cache: dict = {}

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

try:
    jmdict = Jamdict()
    print("JMdict loaded successfully", flush=True)
except Exception as e:
    print(f"Warning: JMdict failed to load: {e}", flush=True)
    jmdict = None

translator = GoogleTranslator(source='en', target='vi')

# ---------- Request/Response Models ----------
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
    synonyms: List[str]
    jlpt: str
    frequency: str

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

class VietnameseMeaningRequest(BaseModel):
    vietnamese: str

async def call_ai(prompt: str) -> str:
    url = "https://openrouter.ai/api/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "openai/gpt-4o-mini",
        "messages": [
            {"role": "user", "content": prompt}
        ],
    }

    async with httpx.AsyncClient() as client:
        res = await client.post(url, headers=headers, json=payload)

    if res.status_code == 200:
        return res.json()["choices"][0]["message"]["content"]
    else:
        print("OpenRouter error:", res.text)
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
            pos = ", ".join(sense.pos) if hasattr(sense, 'pos') and sense.pos else ""
            senses_data.append((english_text, pos))
    if not senses_data:
        return []
    english_texts = [en for en, _ in senses_data]
    translated = await translate_batch(english_texts)
    return [
        Definition(meaning=vi, pos=pos)
        for vi, (_, pos) in zip(translated, senses_data)
    ]

# ---------- Examples endpoint ----------
@router.get("/examples/{word}")
async def get_examples(word: str):
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
    response = await call_ai(prompt)
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
    response = await call_ai(prompt)
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

# ---------- Search by Vietnamese meaning (Gemini) ----------
@router.post("/search-by-meaning")
async def search_words_by_vietnamese(req: VietnameseMeaningRequest):
    """Dùng Gemini: nhập tiếng Việt, trả về danh sách các từ tiếng Nhật phù hợp (tối đa 5 từ)"""
    viet = req.vietnamese.strip()
    if not viet:
        return []

    # Kiểm tra cache
    cache_key = f"vimeaning:{viet}"
    if cache_key in _meaning_search_cache:
        return _meaning_search_cache[cache_key]

    prompt = f"""
    Người dùng nhập nghĩa tiếng Việt: "{viet}".
    Hãy tìm 3-5 từ tiếng Nhật phổ biến có nghĩa tương ứng (có thể là từ đơn, từ ghép).
    Trả về một mảng JSON, mỗi phần tử là một object có các trường:
    - "word": từ tiếng Nhật (viết bằng kanji/hiragana)
    - "reading": cách đọc (hiragana)
    - "meaning": nghĩa tiếng Việt (giữ nguyên "{viet}" hoặc có thể mô tả thêm)
    Chỉ trả về mảng JSON, không giải thích thêm.
    Ví dụ: [{{"word": "開発", "reading": "かいはつ", "meaning": "phát triển"}}, ...]
    """
    response = await call_ai(prompt)
    if not response:
        return []

    try:
        json_match = re.search(r'\[.*\]', response, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
        else:
            data = json.loads(response)
        if isinstance(data, list):
            # Lọc các item có đủ trường
            result = [item for item in data if "word" in item and "reading" in item]
            _meaning_search_cache[cache_key] = result
            return result
    except Exception as e:
        print(f"Error parsing search-by-meaning: {e}\nResponse: {response}", flush=True)
    return []

# ---------- Search History endpoints ----------
@router.post("/history/save")
def save_search_history(req: SaveHistoryRequest, db: Session = Depends(get_db)):
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
def get_search_history(user_id: int, db: Session = Depends(get_db)):
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
def delete_history_item(user_id: int, history_id: int, db: Session = Depends(get_db)):
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
def clear_history(user_id: int, db: Session = Depends(get_db)):
    db.query(SearchHistory).filter(SearchHistory.user_id == user_id).delete()
    db.commit()
    return {"success": True}

# ---------- Get unique words for pronunciation practice ----------
@router.get("/history/words/{user_id}")
def get_history_words(user_id: int, db: Session = Depends(get_db)):
    """Lấy danh sách các từ đã tra cứu (word, reading, meaning) phục vụ luyện phát âm"""
    from sqlalchemy import func
    subq = db.query(
        SearchHistory.word,
        func.max(SearchHistory.created_at).label('latest')
    ).filter(SearchHistory.user_id == user_id).group_by(SearchHistory.word).subquery()
    
    records = db.query(SearchHistory).join(
        subq,
        (SearchHistory.word == subq.c.word) & (SearchHistory.created_at == subq.c.latest)
    ).order_by(SearchHistory.created_at.desc()).all()
    
    unique_words = {}
    for r in records:
        if r.word not in unique_words:
            unique_words[r.word] = {
                "word": r.word,
                "reading": r.reading or "",
                "meaning": r.meaning or ""
            }
    return list(unique_words.values())

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

    result = await run_in_threadpool(jmdict.lookup, word)
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
    jlpt = str(entry.jlpt_old) if hasattr(entry, 'jlpt_old') and entry.jlpt_old else \
           str(entry.jlpt) if hasattr(entry, 'jlpt') and entry.jlpt else "N/A"
    frequency = str(entry.frequency) if hasattr(entry, 'frequency') and entry.frequency else "N/A"

    print(f"[Jamdict] '{kanji}' ({reading}) - {len(definitions)} defs", flush=True)

    response = LookupResponse(
        word=kanji, reading=reading, definitions=definitions,
        examples=[], synonyms=[], jlpt=jlpt, frequency=frequency
    )
    _cache[word] = response
    return response

@router.get("/examples/{word}")
async def get_examples(word: str, db: Session = Depends(get_db)):
    word = word.strip()
    if not word:
        return Response(content="[]", media_type="application/json; charset=utf-8")

    # trả nhanh từ cache nhớ nếu có
    if word in _example_cache:
        json_text = json.dumps(_example_cache[word], ensure_ascii=False)
        return Response(content=json_text, media_type="application/json; charset=utf-8")

    # nếu trong DB có SearchHistory chứa ví dụ (mới nhất) -> trả luôn
    try:
        record = None
        if 'SearchHistory' in globals():
            record = db.query(SearchHistory).filter(SearchHistory.word == word).order_by(SearchHistory.created_at.desc()).first()
        if record and record.examples:
            examples = record.examples
            _example_cache[word] = examples
            json_text = json.dumps(examples, ensure_ascii=False)
            return Response(content=json_text, media_type="application/json; charset=utf-8")
    except Exception as e:
        print(f"[Examples DB lookup] Error: {e}", flush=True)

    # --- fallback: gọi AI tạo examples như trước ---
    prompt = (
        f'Hãy tạo 3 câu ví dụ bằng tiếng Nhật cho từ \"{word}\". '
        f'Mỗi câu ví dụ phải có:\n'
        f'- Một câu tiếng Nhật tự nhiên, trình độ N4-N3.\n'
        f'- Bản dịch tiếng Việt bên dưới.\n'
        f'Xuất kết quả dưới dạng JSON list, mỗi object có key \"japanese\" và \"vietnamese\". '
        f'Không thêm bất kỳ văn bản nào khác ngoài JSON.\n'
        f'Ví dụ: [{{\"japanese\": \"今日はいい天気ですね。\", \"vietnamese\": \"Hôm nay thời tiết đẹp nhỉ.\"}}]'
    )
    response = await call_ai(prompt)
    if not response:
        return Response(content="[]", media_type="application/json; charset=utf-8")
    try:
        json_match = re.search(r'\[.*\]', response, re.DOTALL)
        if json_match:
            examples = json.loads(json_match.group())
        else:
            examples = json.loads(response)
        if isinstance(examples, list) and all("japanese" in e and "vietnamese" in e for e in examples):
            _example_cache[word] = examples
            json_text = json.dumps(examples, ensure_ascii=False)
            return Response(content=json_text, media_type="application/json; charset=utf-8")
    except Exception as e:
        print(f"Failed to parse examples: {e}\nResponse: {response}", flush=True)
    return Response(content="[]", media_type="application/json; charset=utf-8")