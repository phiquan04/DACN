import os
import re
import sys
import asyncio
import json
import hashlib
import tempfile
import requests
import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, HTTPException, Depends, Response, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from jamdict import Jamdict
from deep_translator import GoogleTranslator
from gtts import gTTS
from sqlalchemy.orm import Session, joinedload, selectinload
import httpx
import os

_backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

try:
    from app.models.database import (
        get_db, SearchHistory, DictionaryImage, DictionaryComment, DictionaryCommentVote,
    )
    from app.utils.pos_labels import translate_pos_list
except ModuleNotFoundError:
    _alt_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if _alt_root not in sys.path:
        sys.path.insert(0, _alt_root)
    from database import (
        get_db, SearchHistory, DictionaryImage, DictionaryComment, DictionaryCommentVote,
    )
    from utils.pos_labels import translate_pos_list

from app.routes.auth import get_current_user, UserResponse
from app.utils.cloudinary import init_cloudinary

init_cloudinary()

router = APIRouter(prefix="/dictionary", tags=["dictionary"])

# Caches
_cache: dict = {}
_translation_cache: dict = {}
_example_cache: dict = {}
_synonym_cache: dict = {}
_meaning_search_cache: dict = {}
_reading_cache: dict = {}
_kanji_cache: dict = {}

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# gTTS audio is regenerated the first time a word/text is requested, then
# served from disk on every later request (same cache-aside pattern as
# app/routes/pronunciation.py's reference audio).
_audio_cache_dir = os.path.join(tempfile.gettempdir(), "dictionary_audio")
os.makedirs(_audio_cache_dir, exist_ok=True)

MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB

CJK_RE = re.compile(r'[一-鿿]')

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
    definitions: Optional[List[dict]] = []
    examples: Optional[List[dict]] = []
    synonyms: Optional[List[str]] = []
    jlpt: Optional[str] = ""
    frequency: Optional[str] = ""

class HistoryItem(BaseModel):
    id: int
    word: str
    reading: Optional[str] = ""
    meaning: Optional[str] = ""
    definitions: Optional[List[dict]] = []
    examples: Optional[List[dict]] = []
    synonyms: Optional[List[str]] = []
    jlpt: Optional[str] = ""
    frequency: Optional[str] = ""
    created_at: str

class VietnameseMeaningRequest(BaseModel):
    vietnamese: str

class ReadingRequest(BaseModel):
    text: str

class ImageItem(BaseModel):
    id: int
    image_url: str
    caption: Optional[str] = ""
    uploaded_by: int
    uploader_username: str
    created_at: str

class CommentVoteRequest(BaseModel):
    vote_type: str  # 'up' or 'down'

class CreateCommentRequest(BaseModel):
    word: str
    content: str

class CommentItem(BaseModel):
    id: int
    word: str
    user_id: int
    username: str
    content: str
    upvotes: int
    downvotes: int
    my_vote: Optional[str] = None
    created_at: str

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

# ---------- Synonyms endpoint ----------
@router.get("/synonyms/{word}")
async def get_synonyms(word: str, db: Session = Depends(get_db)):
    word = word.strip()
    if not word:
        return []
    if word in _synonym_cache:
        return _synonym_cache[word]

    # nếu trong DB có SearchHistory chứa synonyms (mới nhất, của bất kỳ user nào) -> trả luôn
    try:
        record = db.query(SearchHistory).filter(SearchHistory.word == word).order_by(SearchHistory.created_at.desc()).first()
        if record and record.synonyms:
            _synonym_cache[word] = record.synonyms
            return record.synonyms
    except Exception as e:
        print(f"[Synonyms DB lookup] Error: {e}", flush=True)

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

# ---------- Sentence reading / furigana (dùng để tạo bản mẫu luyện phát âm) ----------
@router.post("/reading")
async def get_sentence_reading(req: ReadingRequest):
    """Sinh cách đọc toàn bộ bằng hiragana cho một câu tiếng Nhật tuỳ ý."""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Thiếu câu tiếng Nhật")

    cache_key = f"reading:{text}"
    if cache_key in _reading_cache:
        return _reading_cache[cache_key]

    prompt = f"""
    Chuyển câu tiếng Nhật sau đây sang cách đọc toàn bộ bằng hiragana, giữ nguyên trợ từ và dấu câu:
    "{text}"
    Chỉ trả về đúng một object JSON dạng {{"reading": "..."}}, không giải thích thêm.
    """
    response = await call_ai(prompt)
    reading = ""
    if response:
        try:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            data = json.loads(json_match.group() if json_match else response)
            if isinstance(data, dict) and data.get("reading"):
                reading = data["reading"]
        except Exception as e:
            print(f"Error parsing reading response: {e}\nResponse: {response}", flush=True)

    result = {"reading": reading}
    _reading_cache[cache_key] = result
    return result

# ---------- Search History endpoints ----------
@router.post("/history/save")
def save_search_history(req: SaveHistoryRequest, db: Session = Depends(get_db)):
    existing = db.query(SearchHistory).filter(
        SearchHistory.user_id == req.user_id,
        SearchHistory.word == req.word
    ).first()
    if existing:
        # Chỉ ghi đè trường nào có dữ liệu mới — tránh 1 lần lưu thiếu
        # (vd chỉ có examples) xoá mất dữ liệu đã lưu trước đó (vd synonyms)
        if req.reading:
            existing.reading = req.reading
        if req.meaning:
            existing.meaning = req.meaning
        if req.definitions:
            existing.definitions = req.definitions
        if req.examples:
            existing.examples = req.examples
        if req.synonyms:
            existing.synonyms = req.synonyms
        if req.jlpt:
            existing.jlpt = req.jlpt
        if req.frequency:
            existing.frequency = req.frequency
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
            definitions=req.definitions or [],
            examples=req.examples or [],
            synonyms=req.synonyms or [],
            jlpt=req.jlpt,
            frequency=req.frequency,
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
            "definitions": r.definitions or [],
            "examples": r.examples or [],
            "synonyms": r.synonyms or [],
            "jlpt": r.jlpt or "",
            "frequency": r.frequency or "",
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

    result = jmdict.lookup(word)
    if not result.entries:
        response = LookupResponse(
            word=word, reading="", definitions=[],
            examples=[], synonyms=[], jlpt="N/A", frequency="N/A", kanji=[]
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
        # Save to a temp file first and rename into place — a failure mid-write
        # (e.g. dropped connection to gTTS) then leaves no partial file at
        # `path`, so the next request retries instead of serving a corrupt cache hit.
        tmp_path = f"{path}.{os.getpid()}.tmp"
        try:
            await asyncio.get_event_loop().run_in_executor(
                None, lambda: gTTS(text=text, lang='ja', slow=False).save(tmp_path)
            )
            os.replace(tmp_path, path)
        except Exception as e:
            print(f"[Dictionary TTS] Failed for '{text}': {e}", flush=True)
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            raise HTTPException(status_code=502, detail="Failed to generate audio")

    return FileResponse(path, media_type="audio/mpeg")

# ---------- Community images ----------
@router.get("/images/{word}", response_model=List[ImageItem])
async def get_images(word: str, db: Session = Depends(get_db)):
    records = (
        db.query(DictionaryImage)
        .filter(DictionaryImage.word == word)
        .order_by(DictionaryImage.created_at.desc())
        .all()
    )
    return [
        ImageItem(
            id=r.id, image_url=r.image_url, caption=r.caption or "",
            uploaded_by=r.uploaded_by, uploader_username=r.uploader.username if r.uploader else "",
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in records
    ]

@router.post("/images", response_model=ImageItem)
async def upload_image(
    word: str = Form(...),
    caption: str = Form(""),
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    word = word.strip()
    if not word:
        raise HTTPException(status_code=400, detail="Missing 'word'")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    content = await file.read(MAX_UPLOAD_IMAGE_BYTES + 1)
    if len(content) > MAX_UPLOAD_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 5MB)")

    try:
        upload_result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: cloudinary.uploader.upload(content, folder="dictionary_images"),
        )
    except Exception as e:
        print(f"[Cloudinary upload] Error: {e}", flush=True)
        raise HTTPException(status_code=502, detail="Failed to upload image")

    record = DictionaryImage(
        word=word,
        image_url=upload_result["secure_url"],
        cloudinary_public_id=upload_result.get("public_id"),
        caption=caption or None,
        uploaded_by=current_user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return ImageItem(
        id=record.id, image_url=record.image_url, caption=record.caption or "",
        uploaded_by=record.uploaded_by, uploader_username=current_user.username,
        created_at=record.created_at.isoformat() if record.created_at else "",
    )

@router.delete("/images/{image_id}")
async def delete_image(
    image_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(DictionaryImage).filter(DictionaryImage.id == image_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Image not found")
    if record.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own images")

    if record.cloudinary_public_id:
        try:
            await asyncio.get_event_loop().run_in_executor(
                None, lambda: cloudinary.uploader.destroy(record.cloudinary_public_id)
            )
        except Exception as e:
            print(f"[Cloudinary destroy] Error: {e}", flush=True)  # best-effort; still remove the DB row

    db.delete(record)
    db.commit()
    return {"success": True}

# ---------- Community comments ----------
def _comment_to_item(comment: DictionaryComment, requesting_user_id: Optional[int]) -> CommentItem:
    upvotes = sum(1 for v in comment.votes if v.vote_type == 'up')
    downvotes = sum(1 for v in comment.votes if v.vote_type == 'down')
    my_vote = next((v.vote_type for v in comment.votes if v.user_id == requesting_user_id), None)
    return CommentItem(
        id=comment.id, word=comment.word, user_id=comment.user_id,
        username=comment.author.username if comment.author else "",
        content=comment.content, upvotes=upvotes, downvotes=downvotes, my_vote=my_vote,
        created_at=comment.created_at.isoformat() if comment.created_at else "",
    )

@router.get("/comments/{word}", response_model=List[CommentItem])
async def get_comments(word: str, user_id: Optional[int] = None, db: Session = Depends(get_db)):
    comments = (
        db.query(DictionaryComment)
        .options(joinedload(DictionaryComment.author), selectinload(DictionaryComment.votes))
        .filter(DictionaryComment.word == word)
        .order_by(DictionaryComment.created_at.desc())
        .all()
    )
    return [_comment_to_item(c, user_id) for c in comments]

@router.post("/comments", response_model=CommentItem)
async def create_comment(
    req: CreateCommentRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    word = req.word.strip()
    content = req.content.strip()
    if not word or not content:
        raise HTTPException(status_code=400, detail="Missing 'word' or 'content'")

    comment = DictionaryComment(word=word, user_id=current_user.id, content=content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _comment_to_item(comment, current_user.id)

@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(DictionaryComment).filter(DictionaryComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
    db.delete(comment)
    db.commit()
    return {"success": True}

@router.post("/comments/{comment_id}/vote", response_model=CommentItem)
async def vote_comment(
    comment_id: int,
    req: CommentVoteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.vote_type not in ('up', 'down'):
        raise HTTPException(status_code=400, detail="vote_type must be 'up' or 'down'")
    comment = db.query(DictionaryComment).filter(DictionaryComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    existing = db.query(DictionaryCommentVote).filter(
        DictionaryCommentVote.comment_id == comment_id,
        DictionaryCommentVote.user_id == current_user.id,
    ).first()

    if existing and existing.vote_type == req.vote_type:
        db.delete(existing)  # clicking the same vote again toggles it off
    elif existing:
        existing.vote_type = req.vote_type
    else:
        db.add(DictionaryCommentVote(comment_id=comment_id, user_id=current_user.id, vote_type=req.vote_type))
    db.commit()
    db.refresh(comment)
    return _comment_to_item(comment, current_user.id)

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