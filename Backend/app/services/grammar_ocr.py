"""PDF text/vision extraction and AI parsing for grammar set import — the
same pipeline as app/services/vocabulary_ocr.py (see that module's docstring
for the batching rationale), swapped to grammar points instead of words.

A JLPT grammar textbook page usually holds far fewer entries than a
vocabulary page (a handful of grammar patterns vs. ~30 words), but each
grammar point carries an extra verbose field (usage_note, an explanation of
how/when the pattern is used) on top of the pattern/meaning/example fields
vocabulary items have — so per-item output is heavier even though there are
fewer items per page. PAGES_PER_BATCH is kept at the same floor vocabulary_ocr
already uses (1 page/batch) rather than lowered further, since 1 is already
the minimum unit that preserves "one page = one self-contained OCR unit".
"""
import time
from typing import List

from app.services.openrouter_client import call_openrouter_json
from app.services.vocabulary_ocr import extract_pages_from_pdf as _extract_pages_generic

# Spacing between successive batch calls, on top of call_openrouter_json's
# own 429 retry/backoff — the free-tier model's per-minute limit is low
# enough that firing 10-15 page-batches back-to-back for one PDF reliably
# triggers 429 on nearly every request, so a fixed gap between calls avoids
# hitting the limit in the first place instead of only reacting to it.
BATCH_SPACING_SECONDS = 2.0

PAGES_PER_BATCH = 1  # see module docstring — usage_note makes each grammar point's JSON
                      # verbose enough that even fewer items/page than vocab still risks
                      # the same gpt-4o-mini 16k output cap vocabulary_ocr.py guards against


def extract_pages_from_pdf(file_bytes: bytes) -> List[str]:
    """Grammar PDFs need the same two-stage (text-layer then vision-OCR)
    extraction as vocabulary PDFs — vocabulary_ocr.extract_pages_from_pdf is
    already fully generic (it just calls ocr_page_with_vision with
    page_type='vocab' for the vision fallback), so this thin wrapper reuses
    it directly rather than duplicating the PDF-handling logic. The vision
    fallback instruction differs slightly per page_type in
    practice_test_ocr.ocr_page_with_vision ('grammar' vs 'vocab'), but
    vocabulary_ocr's implementation hardcodes 'vocab' — close enough in
    practice (both are "extract all text, preserve structure") that a
    grammar PDF's OCR quality isn't meaningfully affected, so we accept the
    'vocab' vision prompt here rather than forking the whole function for
    one word-choice difference.
    """
    return _extract_pages_generic(file_bytes)


def _parse_grammar_chunk(chunk_text: str, level: str) -> dict:
    prompt = f"""Bạn là chuyên gia biên soạn tài liệu ngữ pháp tiếng Nhật, đang xử lý tài liệu trình độ JLPT {level}.

Dưới đây là nội dung trích xuất từ MỘT PHẦN của file PDF ngữ pháp (vài trang liên tiếp). Do PDF gốc thường trình bày mỗi mẫu ngữ pháp kèm giải thích cách dùng và câu ví dụ, khi trích xuất thành text có thể bị dồn lại không theo đúng khối — hãy tự suy luận lại để ghép đúng mẫu câu với cách dùng và câu ví dụ tương ứng dựa vào ngữ cảnh và thứ tự xuất hiện.

Với mỗi mẫu ngữ pháp, trả về:
- pattern: cấu trúc ngữ pháp gốc (VD: "ておく")
- meaning_vi: nghĩa/ý nghĩa tiếng Việt của mẫu ngữ pháp
- usage_note: giải thích cách dùng, khi nào dùng mẫu này (ngắn gọn, súc tích), null nếu nguồn không có và bạn không suy luận được gì đáng tin cậy
- examples: DANH SÁCH tất cả câu ví dụ đi kèm mẫu ngữ pháp này trong nguồn (có thể 0, 1, 2 hoặc nhiều câu — lấy hết, đừng chỉ chọn 1 câu). Mỗi phần tử là object {{"japanese": "...", "vietnamese": "..."}}. Nếu nguồn không có câu ví dụ nào, hãy tự sinh ra ĐÚNG 1 câu ví dụ phù hợp trình độ {level} và đánh dấu is_example_ai_generated=true.
- is_meaning_ai_generated: true nếu nghĩa tiếng Việt KHÔNG có sẵn trong text nguồn (bạn phải tự dịch), false nếu lấy trực tiếp từ nguồn
- is_example_ai_generated: true nếu TOÀN BỘ câu ví dụ trong "examples" đều do bạn tự sinh (nguồn không có câu nào), false nếu ít nhất 1 câu lấy trực tiếp từ nguồn

QUAN TRỌNG: Chỉ trả về JSON thuần túy, không markdown, không giải thích thêm.

Format JSON:
{{
  "items": [
    {{
      "pattern": "ておく",
      "meaning_vi": "Làm gì đó để chuẩn bị trước / để nguyên trạng thái đó",
      "usage_note": "Gắn sau thể て của động từ, diễn tả hành động được thực hiện trước để chuẩn bị cho việc gì đó sau này, hoặc giữ nguyên trạng thái hiện tại.",
      "examples": [
        {{"japanese": "旅行の前に、荷物を準備しておきます。", "vietnamese": "Trước khi đi du lịch, tôi chuẩn bị hành lý trước."}},
        {{"japanese": "ビールを冷やしておいてください。", "vietnamese": "Hãy để bia trong tủ lạnh cho mát trước nhé."}}
      ],
      "is_meaning_ai_generated": false,
      "is_example_ai_generated": false
    }}
  ]
}}

===NỘI DUNG TRÍCH XUẤT===
{chunk_text}"""

    return call_openrouter_json(prompt)


def parse_grammar_with_ai(pages: List[str], level: str) -> dict:
    """Batches PAGES_PER_BATCH pages per AI call and merges the results. A
    batch that fails (AI error, invalid JSON) is skipped rather than failing
    the whole import — its grammar points are simply missing from the
    result, same as an individual point the AI couldn't confidently parse
    (see imports.py), and the admin can add anything missed by hand during
    review."""
    all_items = []
    failed_batch_count = 0

    for i in range(0, len(pages), PAGES_PER_BATCH):
        batch_text = '\n'.join(p for p in pages[i:i + PAGES_PER_BATCH] if p.strip())
        if not batch_text.strip():
            continue
        if i > 0:
            time.sleep(BATCH_SPACING_SECONDS)
        try:
            result = _parse_grammar_chunk(batch_text, level)
            all_items.extend(result.get('items', []))
        except Exception as e:
            print(f"⚠️  Bỏ qua batch trang {i + 1}-{min(i + PAGES_PER_BATCH, len(pages))}: {e}", flush=True)
            failed_batch_count += 1

    return {'items': all_items, 'failed_batch_count': failed_batch_count}
