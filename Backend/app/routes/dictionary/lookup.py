"""Word lookup and the AI-backed features around it: synonyms, meaning search,
furigana readings, example sentences and pronunciation audio.

Business logic lives in app.services.dictionary_ai / dictionary_jmdict —
this module is HTTP glue: request validation, calling the service, shaping
the response.
"""
import asyncio
import hashlib
import json
import os
import tempfile

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse
from gtts import gTTS
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.schemas.dictionary import (
    LookupRequest, LookupResponse, ReadingRequest, TranslateSentenceRequest,
    TranslateSentenceResponse, VietnameseMeaningRequest,
)
from app.services import dictionary_ai, dictionary_jmdict

router = APIRouter()

# gTTS audio is regenerated the first time a word/text is requested, then
# served from disk on every later request (same cache-aside pattern as
# app/routes/pronunciation.py's reference audio).
_audio_cache_dir = os.path.join(tempfile.gettempdir(), "dictionary_audio")
os.makedirs(_audio_cache_dir, exist_ok=True)


@router.get("/synonyms/{word}")
async def get_synonyms(word: str, db: Session = Depends(get_db)):
    word = word.strip()
    if not word:
        return []
    return await dictionary_ai.get_synonyms(word, db)


@router.post("/search-by-meaning")
async def search_words_by_vietnamese(req: VietnameseMeaningRequest):
    """Dùng Gemini: nhập tiếng Việt, trả về danh sách các từ tiếng Nhật phù hợp (tối đa 5 từ)"""
    viet = req.vietnamese.strip()
    if not viet:
        return []
    return await dictionary_ai.search_by_vietnamese_meaning(viet)


@router.post("/reading")
async def get_sentence_reading(req: ReadingRequest):
    """Sinh cách đọc toàn bộ bằng hiragana cho một câu tiếng Nhật tuỳ ý."""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Thiếu câu tiếng Nhật")
    reading = await dictionary_ai.get_sentence_reading(text)
    return {"reading": reading}


@router.post("/translate-sentence", response_model=TranslateSentenceResponse)
async def translate_sentence(req: TranslateSentenceRequest):
    """Quick Japanese -> Vietnamese translation for a highlighted sentence
    (see the frontend's SelectionMeaningPopup) — for a single word, the
    client calls /lookup instead to get a proper dictionary entry."""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Thiếu câu tiếng Nhật")
    translation = await dictionary_ai.translate_japanese_sentence(text)
    if not translation:
        raise HTTPException(status_code=502, detail="Không dịch được câu này")
    return TranslateSentenceResponse(translation=translation)


@router.post("/lookup", response_model=LookupResponse)
async def dictionary_lookup(req: LookupRequest):
    word = req.word.strip()
    if not word:
        raise HTTPException(status_code=400, detail="Missing word parameter")
    if not dictionary_jmdict.is_available():
        raise HTTPException(status_code=503, detail="Dictionary service not available")
    return await dictionary_jmdict.lookup_word(word)


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


@router.get("/examples/{word}")
async def get_examples(word: str, db: Session = Depends(get_db)):
    word = word.strip()
    if not word:
        return Response(content="[]", media_type="application/json; charset=utf-8")

    examples = await dictionary_ai.get_examples(word, db)
    json_text = json.dumps(examples, ensure_ascii=False)
    return Response(content=json_text, media_type="application/json; charset=utf-8")
