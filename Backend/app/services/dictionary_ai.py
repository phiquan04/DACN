"""AI-backed lookups for the dictionary feature: translation, synonyms,
Vietnamese-meaning search, furigana readings and example sentences.

All of these ultimately call the OpenRouter LLM (`call_ai`) or, for plain
English->Vietnamese translation, deep_translator's free Google endpoint with
an OpenRouter fallback. Each public function owns its own in-memory cache —
these are read-through caches (word/text -> parsed result), not something
callers need to manage.
"""
import asyncio
import json
import os
import re
import time
from typing import List, Optional

import httpx
from deep_translator import GoogleTranslator
from sqlalchemy.orm import Session

from app.models.database import SearchHistory

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

translator = GoogleTranslator(source='en', target='vi')

# deep_translator's free Google endpoint gets rate-limited in bursts (e.g.
# importing a large kanji set translates dozens/hundreds of meanings back to
# back). Once it fails once, skip it for a cooldown window instead of paying
# its network latency + failure on every remaining item in the batch -- go
# straight to the AI fallback until the cooldown expires.
_GOOGLE_TRANSLATE_COOLDOWN_SECONDS = 300
_google_translate_disabled_until = 0.0

_TRANSLATE_CONCURRENCY = 6

_translation_cache: dict = {}
_synonym_cache: dict = {}
_meaning_search_cache: dict = {}
_reading_cache: dict = {}
_example_cache: dict = {}
_sentence_translation_cache: dict = {}


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


async def _translate_via_ai(text: str) -> str:
    """Fallback translator using the same OpenRouter LLM as the chatbot.

    deep_translator's GoogleTranslator hits Google's free, unofficial
    translate endpoint — it gets rate-limited (HTTP 429) fairly often, which
    otherwise silently leaves definitions in English. This gives every
    lookup a second, paid/authenticated path instead of just failing.
    """
    prompt = (
        f'Dịch từ/cụm từ tiếng Anh sau đây sang tiếng Việt. '
        f'Chỉ trả về đúng bản dịch, không giải thích, không dấu ngoặc kép: "{text}"'
    )
    try:
        response = await call_ai(prompt)
    except Exception as e:
        print(f"AI translation error for '{text}': {e}", flush=True)
        return ""
    return response.strip().strip('"').strip() if response else ""


async def _translate_via_google(text: str) -> Optional[str]:
    """Returns None (without even trying the network call) while the
    cooldown from a recent failure is active."""
    global _google_translate_disabled_until
    if time.monotonic() < _google_translate_disabled_until:
        return None
    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, translator.translate, text
        )
        if result:
            return result
    except Exception as e:
        print(f"Translation error for '{text}': {e}", flush=True)
    _google_translate_disabled_until = time.monotonic() + _GOOGLE_TRANSLATE_COOLDOWN_SECONDS
    return None


async def translate_batch(texts: List[str]) -> List[str]:
    semaphore = asyncio.Semaphore(_TRANSLATE_CONCURRENCY)

    async def _translate_one(text: str) -> str:
        cache_key = f"trans:{text}"
        if cache_key in _translation_cache:
            return _translation_cache[cache_key]

        async with semaphore:
            result = await _translate_via_google(text)
            if not result:
                result = await _translate_via_ai(text)

        result = result or text  # last resort: show the original English rather than nothing
        _translation_cache[cache_key] = result
        return result

    return list(await asyncio.gather(*(_translate_one(text) for text in texts)))


def _own_history_row(db: Session, word: str, user_id: Optional[int]) -> Optional[SearchHistory]:
    """The caller's own saved lookup of `word`, if any.

    SearchHistory rows are client-supplied (POST /history/save stores whatever
    synonyms/examples the browser sends), so one user's row must never be
    served to another — that would let anyone plant content on a word for
    every other learner. A caller can only ever read back what they saved.
    """
    if user_id is None:
        return None
    try:
        return (
            db.query(SearchHistory)
            .filter(SearchHistory.word == word, SearchHistory.user_id == user_id)
            .order_by(SearchHistory.created_at.desc())
            .first()
        )
    except Exception as e:
        print(f"[History DB lookup] Error: {e}", flush=True)
        return None


async def get_synonyms(word: str, db: Session, user_id: Optional[int] = None) -> list:
    """Synonyms for a Japanese word: in-memory cache, then the caller's own
    SearchHistory row for the word, then an AI-generated fallback."""
    if word in _synonym_cache:
        return _synonym_cache[word]

    # Deliberately not copied into the shared in-memory cache: it is
    # user-supplied data (see _own_history_row).
    record = _own_history_row(db, word, user_id)
    if record and record.synonyms:
        return record.synonyms

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


async def search_by_vietnamese_meaning(viet: str) -> list:
    """Dùng AI: nhập tiếng Việt, trả về danh sách các từ tiếng Nhật phù hợp (tối đa 5 từ)."""
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
            result = [item for item in data if "word" in item and "reading" in item]
            _meaning_search_cache[cache_key] = result
            return result
    except Exception as e:
        print(f"Error parsing search-by-meaning: {e}\nResponse: {response}", flush=True)
    return []


async def get_sentence_reading(text: str) -> str:
    """Sinh cách đọc toàn bộ bằng hiragana cho một câu tiếng Nhật tuỳ ý."""
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

    _reading_cache[cache_key] = reading
    return reading


async def translate_japanese_sentence(text: str) -> str:
    """One-shot Japanese -> Vietnamese translation for whatever the learner
    highlights on a page (see components/site-help-chat/SelectionMeaningPopup.tsx).
    Separate from get_sentence_reading (which only transliterates to
    hiragana) and from translate_batch (English -> Vietnamese only)."""
    cache_key = f"ja_vi:{text}"
    if cache_key in _sentence_translation_cache:
        return _sentence_translation_cache[cache_key]

    prompt = (
        "Dịch câu hoặc cụm từ tiếng Nhật sau đây sang tiếng Việt tự nhiên, dễ hiểu. "
        f'Chỉ trả về đúng bản dịch, không giải thích, không dấu ngoặc kép: "{text}"'
    )
    try:
        response = await call_ai(prompt)
    except Exception as e:
        print(f"Sentence translation error for '{text}': {e}", flush=True)
        response = ""

    translation = response.strip().strip('"').strip() if response else ""
    _sentence_translation_cache[cache_key] = translation
    return translation


async def get_examples(word: str, db: Session, user_id: Optional[int] = None) -> list:
    """Ví dụ minh hoạ cho một từ: in-memory cache, rồi SearchHistory của chính
    người gọi, rồi AI-generated fallback."""
    if word in _example_cache:
        return _example_cache[word]

    record = _own_history_row(db, word, user_id)
    if record and record.examples:
        return record.examples

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
