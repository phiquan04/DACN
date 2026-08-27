"""LLM-backed explanation for grammar corrections.

The GEC model (`model.py`) is a sequence-tagging model (GECToR-style): for
each token it only predicts a discrete edit ($KEEP/$DELETE/$APPEND_x/
$REPLACE_x/$TRANSFORM_x), so it has no way to produce a natural-language
explanation on its own. This module fills that gap by handing the LLM
already-computed, correct data (the original text, the corrected text, and
the character-level diff between them) and asking it only to explain the
*known* changes in Vietnamese, rather than asking it to find or correct
errors itself.

The instruction prompt itself is written in Vietnamese (not Japanese) even
though it's explaining Japanese sentences: LLMs are biased to continue
responding in whichever language dominates the prompt, so a Japanese-language
prompt asking for a Vietnamese answer measurably leaks Japanese back into the
explanation text more often than a Vietnamese-language prompt does.
"""
import json
import os
import re
from typing import List

from app.services.chat_ai import call_openrouter

EXPLANATION_PROMPT = """Bạn là giáo viên tiếng Nhật. So sánh câu học viên viết và câu đã được sửa lại dưới đây, rồi giải thích rõ ràng bằng tiếng Việt cho từng chỗ đã sửa.

Câu gốc: "{original}"
Câu đã sửa: "{corrected}"
Tham khảo (diff theo từng ký tự, "+" là phần được thêm vào, "-" là phần bị xoá):
{diff_hint}

Chỉ trả lời đúng một object JSON theo định dạng bên dưới, không thêm lời giải thích, không thêm markdown. Nếu câu gốc và câu đã sửa thực chất giống nhau (không có lỗi) thì trả về "errors": [].

Bắt buộc: nội dung của "error_type", "why_wrong" và "why_fixed" PHẢI viết hoàn toàn bằng tiếng Việt. Được phép trích ngắn một từ/cụm tiếng Nhật trong dấu ngoặc kép khi cần minh hoạ (ví dụ thuật ngữ ngữ pháp, dạng chia động từ), nhưng tuyệt đối không được viết cả câu giải thích bằng tiếng Nhật. Chỉ riêng "original_fragment" và "corrected_fragment" là được giữ nguyên tiếng Nhật, vì đó là phần trích trực tiếp từ câu gốc/câu đã sửa.

Định dạng JSON cần trả về:
{{"errors": [{{"original_fragment": "đoạn sai trong câu gốc, giữ nguyên tiếng Nhật, trích ngắn gọn", "corrected_fragment": "đoạn tương ứng trong câu đã sửa, giữ nguyên tiếng Nhật", "error_type": "chọn đúng 1 trong các nhãn tiếng Việt sau: Trợ từ | Chia động từ/tính từ | Từ vựng | Trật tự từ | Kính ngữ | Cách viết | Khác", "why_wrong": "giải thích bằng tiếng Việt vì sao chỗ đó sai", "why_fixed": "giải thích bằng tiếng Việt vì sao sửa như vậy là đúng"}}]}}"""

RETRY_SUFFIX = """

QUAN TRỌNG: Câu trả lời trước của bạn đã vi phạm yêu cầu ở trên (còn lẫn nguyên câu tiếng Nhật trong phần giải thích). Hãy viết lại toàn bộ "error_type", "why_wrong", "why_fixed" hoàn toàn bằng tiếng Việt — chỉ được trích ngắn một từ/cụm tiếng Nhật trong ngoặc kép khi thật sự cần thiết, không được để cả câu giải thích bằng tiếng Nhật."""

_JAPANESE_CHAR_RE = re.compile(r"[぀-ヿ一-鿿]")

# A short quoted Japanese term/structure inside an otherwise-Vietnamese
# sentence (e.g. "Cần dùng cấu trúc 'ことになる' để...") is fine and expected;
# only flag a field where Japanese characters make up most of the text,
# which means the LLM wrote the whole explanation in Japanese instead.
_LEAK_RATIO_THRESHOLD = 0.3
_MAX_ATTEMPTS = 3


def _build_diff_hint(diffs: List[str]) -> str:
    changed = [d for d in diffs if d.startswith("- ") or d.startswith("+ ")]
    return "".join(changed) if changed else "(không có khác biệt)"


def _japanese_ratio(text: str) -> float:
    text = (text or "").strip()
    if not text:
        return 0.0
    japanese_chars = len(_JAPANESE_CHAR_RE.findall(text))
    return japanese_chars / len(text)


def _max_leak_ratio(errors: List[dict]) -> float:
    if not errors:
        return 0.0
    return max(
        max(
            _japanese_ratio(item.get("error_type", "")),
            _japanese_ratio(item.get("why_wrong", "")),
            _japanese_ratio(item.get("why_fixed", "")),
        )
        for item in errors
    )


def _call_and_parse(prompt: str) -> List[dict]:
    try:
        # temperature=0: this call classifies whether a diff is a genuine
        # grammar error, not free-form writing — the same sentence must get
        # the same verdict every time, whether graded from the standalone
        # /correct page or from a chatbot message.
        raw = call_openrouter(
            [{"role": "user", "content": prompt}], os.environ["OPENROUTER_API_KEY"], temperature=0
        )
    except Exception as e:
        print(f"[grammar explanation] OpenRouter call failed: {e}")
        return []

    cleaned = re.sub(r"```json|```", "", raw).strip()
    try:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        data = json.loads(match.group() if match else cleaned)
        errors = data.get("errors", [])
        if isinstance(errors, list):
            return errors
    except Exception as e:
        print(f"[grammar explanation] Failed to parse LLM response: {e}\nResponse: {raw}")
    return []


def generate_explanation(original: str, corrected: str, diffs: List[str]) -> List[dict]:
    """Best-effort: returns [] (never raises) if the sentence is unchanged,
    the API key is missing, or every attempt fails to parse.

    The LLM occasionally ignores the Vietnamese-only instruction and leaves
    whole Japanese sentences inside why_wrong/why_fixed, so up to
    `_MAX_ATTEMPTS` calls are made, stopping as soon as one comes back clean
    and otherwise keeping the attempt with the least Japanese leakage.
    """
    if original == corrected or not os.environ.get("OPENROUTER_API_KEY"):
        return []

    prompt = EXPLANATION_PROMPT.format(
        original=original,
        corrected=corrected,
        diff_hint=_build_diff_hint(diffs),
    )

    best_errors: List[dict] = []
    best_ratio = 1.0
    current_prompt = prompt
    for _ in range(_MAX_ATTEMPTS):
        errors = _call_and_parse(current_prompt)
        if not errors:
            continue
        ratio = _max_leak_ratio(errors)
        if ratio < best_ratio:
            best_errors, best_ratio = errors, ratio
        if ratio <= _LEAK_RATIO_THRESHOLD:
            return errors
        current_prompt = prompt + RETRY_SUFFIX

    return best_errors
