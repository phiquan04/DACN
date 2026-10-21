"""Shared OpenRouter chat-completion helper for every place in this codebase
that calls the free-tier model: the PDF-import AI parsers (vocabulary_ocr.py,
grammar_ocr.py, grammar_exercise_ai.py) AND the per-page vision-OCR fallback
(practice_test_ocr.py's ocr_page_with_vision, used by all three PDF pipelines
above whenever a PDF's text layer is too thin to read directly). All of these
hit the same free-tier model and are equally vulnerable to 429 rate-limit
bursts when a multi-page PDF fires one request per page/batch back-to-back
with no spacing — centralizing the retry/backoff here fixes it everywhere at
once instead of independent copies drifting apart (which is exactly what
happened before: the JSON-parsing callers got a retry fix first, and the
vision-OCR path kept failing because it posts directly and never went
through this module).
"""
import json
import os
import re
import time
from typing import List, Optional

import requests as req

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
FREE_MODEL = "minimax/minimax-m3:free"  # free tier, avoids needing OpenRouter credits

DEFAULT_MAX_RETRIES = 4
DEFAULT_BACKOFF_SECONDS = 3.0  # doubles each retry: 3s, 6s, 12s, 24s


def post_chat_completion(messages: List[dict], *, model: str = FREE_MODEL, max_tokens: int = 16000,
                          temperature: float = 0.2, timeout: int = 180,
                          max_retries: int = DEFAULT_MAX_RETRIES) -> str:
    """POSTs one chat-completion request (any `messages` shape — plain text
    or multimodal image+text content), retrying on 429 (rate limit) with
    exponential backoff — honoring the server's `Retry-After` header when
    present, since the free tier's actual reset window varies and guessing
    wrong either wastes time or retries too soon. Also retries on transient
    network errors. Returns the raw reply text. Raises ValueError with a
    Vietnamese message on final failure, matching this codebase's convention
    of surfacing AI failures as ValueError so callers can skip just one
    page/batch instead of failing the whole import.
    """
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    backoff = DEFAULT_BACKOFF_SECONDS
    last_error: Optional[Exception] = None

    for attempt in range(max_retries + 1):
        try:
            response = req.post(OPENROUTER_URL, headers=headers, json=payload, timeout=timeout)
        except req.exceptions.RequestException as e:
            last_error = e
            if attempt < max_retries:
                time.sleep(backoff)
                backoff *= 2
                continue
            raise ValueError(f"Gọi OpenRouter thất bại sau {max_retries + 1} lần thử: {e}") from e

        if response.status_code == 429:
            if attempt < max_retries:
                wait = float(response.headers.get("Retry-After", backoff))
                time.sleep(wait)
                backoff *= 2
                continue
            raise ValueError(
                "OpenRouter đang giới hạn tốc độ (rate limit) cho model miễn phí, "
                f"đã thử lại {max_retries} lần nhưng vẫn bị chặn. Hãy thử lại sau vài phút."
            )

        response.raise_for_status()
        return response.json()['choices'][0]['message']['content'].strip()

    raise ValueError(f"Gọi OpenRouter thất bại: {last_error}")  # unreachable in practice


def call_openrouter_json(prompt: str, *, model: str = FREE_MODEL, max_tokens: int = 16000, timeout: int = 180,
                          max_retries: int = DEFAULT_MAX_RETRIES, temperature: float = 0.2) -> dict:
    """Same as post_chat_completion, for the common case of a single plain-text
    prompt expected to come back as a JSON-only reply — strips markdown code
    fences and parses the result, raising ValueError on invalid JSON."""
    raw = post_chat_completion(
        [{"role": "user", "content": prompt}],
        model=model, max_tokens=max_tokens, temperature=temperature, timeout=timeout, max_retries=max_retries,
    )
    clean = re.sub(r'```json|```', '', raw).strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError as e:
        raise ValueError(f"AI trả về JSON không hợp lệ: {e}") from e
