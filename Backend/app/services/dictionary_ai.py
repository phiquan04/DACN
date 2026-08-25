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
from typing import List, Optional

import httpx
from deep_translator import GoogleTranslator
from sqlalchemy.orm import Session

from app.models.database import SearchHistory

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

translator = GoogleTranslator(source='en', target='vi')

_translation_cache: dict = {}
_synonym_cache: dict = {}
_meaning_search_cache: dict = {}
_reading_cache: dict = {}
_example_cache: dict = {}


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


async def translate_batch(texts: List[str]) -> List[str]:
    results = []
    for i, text in enumerate(texts):
        if i > 0:
            await asyncio.sleep(0.05)
        cache_key = f"trans:{text}"
        if cache_key in _translation_cache:
            results.append(_translation_cache[cache_key])
            continue

        result = None
        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None, translator.translate, text
            )
        except Exception as e:
            print(f"Translation error for '{text}': {e}", flush=True)

        if not result:
            result = await _translate_via_ai(text)

        result = result or text  # last resort: show the original English rather than nothing
        _translation_cache[cache_key] = result
        results.append(result)
    return results


async def get_synonyms(word: str, db: Session) -> list:
    """Synonyms for a Japanese word: in-memory cache, then the most recent
    SearchHistory row for the word (any user), then an AI-generated fallback."""
    if word in _synonym_cache:
        return _synonym_cache[word]

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


async def get_examples(word: str, db: Session) -> list:
    """Ví dụ minh hoạ cho một từ: in-memory cache, rồi SearchHistory gần nhất
    (bất kỳ user nào), rồi AI-generated fallback."""
    if word in _example_cache:
        return _example_cache[word]

    try:
        record = db.query(SearchHistory).filter(SearchHistory.word == word).order_by(SearchHistory.created_at.desc()).first()
        if record and record.examples:
            _example_cache[word] = record.examples
            return record.examples
    except Exception as e:
        print(f"[Examples DB lookup] Error: {e}", flush=True)

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
