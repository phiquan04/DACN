"""PDF text/vision extraction and AI parsing for vocabulary set import.

Unlike a JLPT exam (a few dozen questions), a vocabulary book can list well
over a thousand words in one PDF — far more than any single LLM call can
structure into JSON in one response (gpt-4o-mini's own output cap is 16384
tokens, good for maybe 60-80 words' worth of fields). So extraction here
keeps page boundaries (extract_pages_from_pdf), and parsing batches a few
pages at a time into separate AI calls, merging the results — each Mimikara
Oboeru-style page lays out its ~30 words' kanji/reading/meaning columns as
one self-contained unit, so batching on page boundaries (rather than an
arbitrary line count) avoids splitting a word's data across two AI calls.

Source vocabulary PDFs commonly list word+reading+meaning but omit example
sentences — when a field is missing from the source text, the LLM fills it
in and flags it via is_meaning_ai_generated/is_example_ai_generated so the
admin knows which fields to double-check during review.
"""
import json
import os
import re
import tempfile
import time
from typing import List

import fitz
import pdfplumber
import requests as req
from PIL import Image

from app.services.practice_test_ocr import clean_text, ocr_page_with_vision

PAGES_PER_BATCH = 1  # ~30 words/page in a typical textbook layout, each with 7 verbose JSON fields —
                      # even 2 pages/batch runs close to gpt-4o-mini's 16k output cap (the exact failure
                      # this batching exists to avoid), so 1 page/batch trades import speed for headroom


def extract_pages_from_pdf(file_bytes: bytes) -> List[str]:
    """Same two-stage extraction as practice_test_ocr.extract_text_from_pdf
    (PDF text layer first, vision OCR fallback for scanned pages), but
    returns one cleaned string per page instead of joining everything into a
    single blob — see module docstring for why page boundaries matter here.
    """
    api_key = os.environ.get("OPENROUTER_API_KEY", "")

    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    doc = None
    try:
        with pdfplumber.open(tmp_path) as pdf:
            pages_text = [clean_text(page.extract_text() or '') for page in pdf.pages]

        if len('\n'.join(pages_text)) < 200:
            print("⚠️  Text layer quá ít, chuyển sang Vision OCR (vocab)...", flush=True)

            doc = fitz.open(tmp_path)
            pages_imgs = []
            for page in doc:
                mat = fitz.Matrix(250 / 72, 250 / 72)
                pix = page.get_pixmap(matrix=mat)
                pages_imgs.append(Image.frombytes("RGB", [pix.width, pix.height], pix.samples))
            doc.close()
            doc = None

            pages_text = []
            for page_num, img in enumerate(pages_imgs):
                print(f"  OCR page {page_num + 1}...", flush=True)
                try:
                    pages_text.append(clean_text(ocr_page_with_vision(img, api_key, page_type='vocab')))
                except Exception as e:
                    print(f"  ⚠️  Page {page_num + 1} lỗi: {e}", flush=True)
                    pages_text.append('')

        print(f"📄 PAGES EXTRACTED (vocab): {len(pages_text)}, total chars: {sum(len(p) for p in pages_text)}", flush=True)
        return pages_text

    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass
        time.sleep(0.2)
        try:
            os.unlink(tmp_path)
        except Exception as e:
            print(f"⚠️  Không xóa được file tạm: {e}", flush=True)


def _parse_vocabulary_chunk(chunk_text: str, level: str) -> dict:
    api_key = os.environ.get("OPENROUTER_API_KEY", "")

    prompt = f"""Bạn là chuyên gia biên soạn tài liệu từ vựng tiếng Nhật, đang xử lý tài liệu trình độ JLPT {level}.

Dưới đây là nội dung trích xuất từ MỘT PHẦN của file PDF từ vựng (vài trang liên tiếp). Do PDF gốc thường trình bày dạng bảng (kanji - âm Hán Việt - cách đọc - nghĩa), khi trích xuất thành text các cột có thể bị dồn lại không theo đúng hàng — hãy tự suy luận lại để ghép đúng kanji với âm Hán Việt, cách đọc và nghĩa tương ứng dựa vào ngữ cảnh và thứ tự xuất hiện.

Với mỗi từ, trả về:
- word: kanji hoặc chữ gốc
- reading: cách đọc hiragana
- han_viet: âm Hán Việt của từng chữ kanji trong từ, phân tách bằng dấu phẩy (VD: "NHÂN, SINH" cho 人生), viết hoa toàn bộ. Nếu nguồn có sẵn thì lấy từ nguồn; nếu nguồn KHÔNG có cột âm Hán Việt thì bạn tự suy ra âm Hán Việt chuẩn của từng chữ kanji dựa trên kiến thức của bạn. Chỉ để null nếu từ viết bằng hiragana/katakana thuần, hoàn toàn không có kanji
- meaning_vi: nghĩa tiếng Việt
- word_type: loại từ nếu suy luận được (danh từ/động từ/tính từ/phó từ...), null nếu không chắc
- example_sentence_ja: một câu ví dụ tiếng Nhật dùng từ này, phù hợp trình độ {level}
- example_sentence_vi: bản dịch tiếng Việt của câu ví dụ
- is_meaning_ai_generated: true nếu nghĩa tiếng Việt KHÔNG có sẵn trong text nguồn (bạn phải tự dịch), false nếu lấy trực tiếp từ nguồn
- is_example_ai_generated: true nếu câu ví dụ KHÔNG có sẵn trong text nguồn (bạn phải tự sinh ra), false nếu lấy trực tiếp từ nguồn — trường hợp phổ biến vì nhiều tài liệu từ vựng không kèm câu ví dụ

QUAN TRỌNG: Chỉ trả về JSON thuần túy, không markdown, không giải thích thêm.

Format JSON:
{{
  "items": [
    {{
      "word": "資源",
      "reading": "しげん",
      "han_viet": "TƯ, NGUYÊN",
      "meaning_vi": "Tài nguyên",
      "word_type": "danh từ",
      "example_sentence_ja": "地球の資源には限りがある。",
      "example_sentence_vi": "Tài nguyên của Trái Đất là có hạn.",
      "is_meaning_ai_generated": false,
      "is_example_ai_generated": true
    }}
  ]
}}

===NỘI DUNG TRÍCH XUẤT===
{chunk_text}"""

    response = req.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "nvidia/nemotron-3-super-120b-a12b:free",  # free tier, text-only (no vision needed here)
            "reasoning": {"enabled": False},  # otherwise it leaks chain-of-thought into content, breaking JSON parsing
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "max_tokens": 16000,
        },
        timeout=180,
    )
    response.raise_for_status()
    raw = response.json()['choices'][0]['message']['content'].strip()
    clean = re.sub(r'```json|```', '', raw).strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError as e:
        raise ValueError(f"AI trả về JSON không hợp lệ cho một phần của file: {e}") from e


BATCH_RETRY_ATTEMPTS = 3
BATCH_RETRY_DELAY_SECONDS = 5  # free-tier providers are often transiently overloaded/rate-limited


def parse_vocabulary_with_ai(pages: List[str], level: str) -> dict:
    """Batches PAGES_PER_BATCH pages per AI call and merges the results. A
    batch is retried a few times (transient 429/503 upstream overload on the
    free tier is common) before being skipped rather than failing the whole
    import — its words are simply missing from the result, same as an
    individual word the AI couldn't confidently parse (see imports.py), and
    the admin can add anything missed by hand during review."""
    all_items = []
    failed_batch_count = 0

    for i in range(0, len(pages), PAGES_PER_BATCH):
        batch_text = '\n'.join(p for p in pages[i:i + PAGES_PER_BATCH] if p.strip())
        if not batch_text.strip():
            continue

        last_error = None
        for attempt in range(1, BATCH_RETRY_ATTEMPTS + 1):
            try:
                result = _parse_vocabulary_chunk(batch_text, level)
                all_items.extend(result.get('items', []))
                last_error = None
                break
            except Exception as e:
                last_error = e
                if attempt < BATCH_RETRY_ATTEMPTS:
                    print(f"⚠️  Batch trang {i + 1}-{min(i + PAGES_PER_BATCH, len(pages))} lỗi (lần {attempt}/{BATCH_RETRY_ATTEMPTS}): {e} — thử lại sau {BATCH_RETRY_DELAY_SECONDS}s", flush=True)
                    time.sleep(BATCH_RETRY_DELAY_SECONDS)

        if last_error is not None:
            print(f"⚠️  Bỏ qua batch trang {i + 1}-{min(i + PAGES_PER_BATCH, len(pages))} sau {BATCH_RETRY_ATTEMPTS} lần thử: {last_error}", flush=True)
            failed_batch_count += 1

    return {'items': all_items, 'failed_batch_count': failed_batch_count}
