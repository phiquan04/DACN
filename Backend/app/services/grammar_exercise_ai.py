"""AI generation of grammar practice exercises (cloze + MCQ), one pair per
GrammarPoint, generated once and cached as GrammarExercise rows rather than
generated live per learner — same "generate once, cache the result"
philosophy as app/services/vocabulary_ocr.py's example-sentence generation
and app/services/dictionary_ai.py's example/synonym caches.

Same JSON-only-response / regex-strip-markdown-fences / json.JSONDecodeError
-> ValueError pattern as app/services/grammar_ocr.py, and the same
"a failed batch is skipped, not fatal" tolerance — a grammar point whose
batch failed simply ends up with zero exercises, which practice.py's
/practice/due query naturally excludes (nothing to serve) rather than
crashing the whole publish.

Batching: unlike the PDF import pipeline (1 page/batch, because OCR text
chunks are long and unpredictable), the input here is already a handful of
short, structured fields per point (pattern/meaning_vi/usage_note/examples)
with tight, predictable output per point (one cloze + one mcq), so several
points batch safely into one call. POINTS_PER_BATCH=8 was chosen empirically
(see module-level comment below) as comfortably inside gpt-4o-mini-class
output limits for this schema.
"""
import time
from typing import Dict, List

from app.models.grammar_content import GrammarPoint
from app.services.openrouter_client import call_openrouter_json

POINTS_PER_BATCH = 8  # ~8 points x (cloze+mcq, each a few short strings) stays well
                       # under the 16k max_tokens cap that PAGES_PER_BATCH=1 in
                       # grammar_ocr.py guards against for the much larger OCR-text case

# Same rationale as grammar_ocr.py's BATCH_SPACING_SECONDS — publishing a set
# with many points fires several of these batch calls in a row, which alone
# is enough to trip the free-tier model's per-minute rate limit.
BATCH_SPACING_SECONDS = 2.0


def _example_text(point: GrammarPoint) -> str:
    examples = point.examples or []
    if not examples:
        return "(không có câu ví dụ nào)"
    return "\n".join(
        f"  - {e.get('japanese', '')} ({e.get('vietnamese', '')})" for e in examples
    )


def _build_prompt(points: List[GrammarPoint]) -> str:
    points_block = "\n\n".join(
        f"""[index={idx}] pattern: {p.pattern}
meaning_vi: {p.meaning_vi}
usage_note: {p.usage_note or '(không có)'}
examples:
{_example_text(p)}"""
        for idx, p in enumerate(points)
    )

    return f"""Bạn là chuyên gia biên soạn bài tập luyện ngữ pháp tiếng Nhật cho người học JLPT.

Với MỖI mẫu ngữ pháp dưới đây (đánh số bằng "index"), hãy tạo ĐÚNG 2 bài tập:

1. "cloze" — bài điền vào chỗ trống:
   - Ưu tiên lấy một câu ví dụ có sẵn của mẫu ngữ pháp (trong "examples") làm câu gốc; nếu không có câu ví dụ nào, tự soạn một câu tiếng Nhật tự nhiên có dùng đúng mẫu ngữ pháp đó.
   - Xác định vị trí mẫu ngữ pháp xuất hiện trong câu, thay đúng phần đó bằng dấu ___ (3 dấu gạch dưới).
   - "prompt": câu tiếng Nhật đã có dấu ___ thay cho mẫu ngữ pháp.
   - "correct_answer": CHÍNH XÁC phần văn bản đã bị thay thế (để so khớp chuỗi khi chấm điểm).

2. "mcq" — bài trắc nghiệm 4 lựa chọn:
   - "prompt": một câu hỏi hoặc câu có chỗ trống, hỏi lựa chọn nào dùng đúng mẫu ngữ pháp này trong ngữ cảnh phù hợp (bằng tiếng Việt hoặc có thể kèm câu tiếng Nhật có chỗ trống).
   - "choices": mảng ĐÚNG 4 chuỗi lựa chọn, gồm 1 đáp án đúng (dùng đúng mẫu ngữ pháp) và 3 phương án gây nhiễu hợp lý (mẫu ngữ pháp gần giống, dễ nhầm), thứ tự các lựa chọn XÁO TRỘN ngẫu nhiên (không luôn để đáp án đúng ở vị trí đầu).
   - "correct_answer": CHÍNH XÁC chuỗi trùng với một trong 4 phần tử của "choices" là đáp án đúng.

QUAN TRỌNG: Chỉ trả về JSON thuần túy, không markdown, không giải thích thêm. Trả về đủ cho TẤT CẢ index được liệt kê bên dưới, mỗi index xuất hiện đúng 1 lần.

Format JSON:
{{
  "exercises": [
    {{
      "index": 0,
      "cloze": {{"prompt": "旅行の前に、荷物を___。", "correct_answer": "準備しておきます"}},
      "mcq": {{
        "prompt": "Câu nào dùng đúng mẫu ngữ pháp「ておく」?",
        "choices": ["準備しておきます", "準備してあります", "準備していきます", "準備しています"],
        "correct_answer": "準備しておきます"
      }}
    }}
  ]
}}

===CÁC MẪU NGỮ PHÁP===
{points_block}"""


def _call_ai_for_batch(points: List[GrammarPoint]) -> dict:
    return call_openrouter_json(_build_prompt(points), temperature=0.4)


def _valid_cloze(cloze: dict) -> bool:
    return bool(cloze) and bool((cloze.get('prompt') or '').strip()) and bool((cloze.get('correct_answer') or '').strip())


def _valid_mcq(mcq: dict) -> bool:
    if not mcq:
        return False
    prompt = (mcq.get('prompt') or '').strip()
    correct = (mcq.get('correct_answer') or '').strip()
    choices = mcq.get('choices') or []
    choices = [c for c in choices if isinstance(c, str) and c.strip()]
    return bool(prompt) and bool(correct) and len(choices) == 4 and correct in choices


def generate_exercises_for_points(points: List[GrammarPoint]) -> Dict[int, List[dict]]:
    """Generates cloze+mcq exercise data for each of `points`, batching
    POINTS_PER_BATCH points per AI call. Returns {grammar_point_id: [exercise
    dict, ...]} — a point missing from the result means its batch failed or
    the AI returned something unusable for it (skipped, not fatal, mirroring
    parse_grammar_with_ai's per-batch tolerance in grammar_ocr.py). Each
    exercise dict has keys: type ('cloze'|'mcq'), prompt, correct_answer,
    choices (list[str] or None). Pure function — does not touch the DB; the
    caller (review.py's publish_set) is responsible for constructing and
    saving GrammarExercise rows from the returned data.
    """
    result: Dict[int, List[dict]] = {}

    for i in range(0, len(points), POINTS_PER_BATCH):
        batch = points[i:i + POINTS_PER_BATCH]
        if i > 0:
            time.sleep(BATCH_SPACING_SECONDS)
        try:
            parsed = _call_ai_for_batch(batch)
        except Exception as e:
            print(f"⚠️  Bỏ qua batch bài tập ngữ pháp {i + 1}-{i + len(batch)}: {e}", flush=True)
            continue

        for entry in parsed.get('exercises', []):
            idx = entry.get('index')
            if not isinstance(idx, int) or not (0 <= idx < len(batch)):
                continue
            point = batch[idx]
            exercises = []

            cloze = entry.get('cloze') or {}
            if _valid_cloze(cloze):
                exercises.append({
                    'type': 'cloze',
                    'prompt': cloze['prompt'].strip(),
                    'correct_answer': cloze['correct_answer'].strip(),
                    'choices': None,
                })

            mcq = entry.get('mcq') or {}
            if _valid_mcq(mcq):
                exercises.append({
                    'type': 'mcq',
                    'prompt': mcq['prompt'].strip(),
                    'correct_answer': mcq['correct_answer'].strip(),
                    'choices': [c.strip() for c in mcq['choices']],
                })

            if exercises:
                result[point.id] = exercises

    return result
