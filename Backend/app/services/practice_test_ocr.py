"""PDF text/vision extraction and AI parsing for JLPT exam import.

Two-stage extraction: try the PDF's text layer first (pdfplumber); if that
comes back too short (scanned/image-only pages), fall back to rendering each
page and running it through a vision-capable LLM (OpenRouter). The extracted
exam + answer-key text is then handed to an LLM again to structure it into
questions/choices/answers JSON.
"""
import base64
import io
import json
import os
import re
import tempfile
import time

import fitz
import numpy as np
import pdfplumber
import requests as req
from PIL import Image, ImageEnhance

NOISE_PATTERNS = [
    r'小程序[：:].+', r'日[语語]轻松考', r'打开小程序.+',
    r'真题[、，,].+', r'有解析.+', r'想要高效.+',
    r'使用小程序.+', r'日[语語]能力考', r'模拟题',
    r'练习题', r'可收藏', r'可分享',
    r'申し訳ありません.+',
    r"I'?m sorry.+",
    r'解释[：:].+',               # giải thích tiếng Trung lẫn vào
    r'正解[：:].+',
]
_noise_re = re.compile('|'.join(NOISE_PATTERNS))


def has_hiragana_or_katakana(text: str) -> bool:
    return any('぀' <= ch <= 'ゟ' or '゠' <= ch <= 'ヿ' for ch in text)


def is_chinese_line(line: str) -> bool:
    cjk = sum(1 for ch in line if '一' <= ch <= '鿿')
    total = len([ch for ch in line if not ch.isspace()])
    return total > 0 and cjk / total > 0.5 and not has_hiragana_or_katakana(line)


def clean_text(raw: str) -> str:
    cleaned = []
    for line in raw.splitlines():
        s = line.strip()
        if not s:
            continue
        if _noise_re.search(s):
            continue
        if is_chinese_line(s):
            continue
        cleaned.append(s)
    return '\n'.join(cleaned)


def remove_watermark_overlay(img: Image.Image) -> Image.Image:
    img_rgb = img.convert('RGB')
    arr = np.array(img_rgb, dtype=np.int16)

    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    # Phát hiện pixel có màu (không phải xám/đen/trắng)
    # Pixel "có màu" khi độ lệch giữa các kênh lớn
    max_ch = np.maximum(np.maximum(r, g), b)
    min_ch = np.minimum(np.minimum(r, g), b)
    saturation = (max_ch - min_ch).astype(np.uint8)

    # Mask: pixel có saturation > 40 → là watermark màu → tô trắng
    colored_mask = saturation > 40
    result = np.array(img_rgb)
    result[colored_mask] = [255, 255, 255]

    # Tăng contrast để text đen rõ hơn
    out = Image.fromarray(result)
    out = ImageEnhance.Contrast(out).enhance(2.0)
    return out


def pil_to_base64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=92)
    return base64.b64encode(buf.getvalue()).decode('utf-8')


def ocr_page_with_vision(pil_img: Image.Image, api_key: str, page_type: str = 'exam') -> str:
    """
    OCR một trang bằng GPT-4o-mini vision.
    page_type: 'exam' hoặc 'answer'
    """
    # Xử lý ảnh trước
    processed = remove_watermark_overlay(pil_img)
    b64 = pil_to_base64(processed)

    if page_type == 'answer':
        instruction = (
            "This is an answer key page for a JLPT Japanese language test. "
            "Extract only the answer information in this exact format for each question:\n"
            "問題番号: [number] 正解: [1, 2, 3, or 4]\n"
            "Do NOT include Chinese text, explanations, or any other content. "
            "Output plain text only, no markdown."
        )
    elif page_type == 'vocab':
        instruction = (
            "This is a page from a Japanese vocabulary study book (word lists, often laid "
            "out as a table of kanji/word, hiragana reading, and a Vietnamese or English "
            "meaning, sometimes with example sentences). Extract ALL text exactly as written, "
            "preserving which word each reading/meaning belongs to as best you can. "
            "Ignore any Chinese watermarks, advertisements, or colored overlay text. "
            "Output plain text only, no markdown, no explanations."
        )
    else:
        instruction = (
            "This is a JLPT Japanese language test question page. "
            "Extract ALL Japanese text exactly as written. "
            "Include question numbers, question text, and all answer choices (1234). "
            "Ignore any Chinese watermarks, advertisements, or colored overlay text. "
            "Output plain text only, no markdown, no explanations."
        )

    response = req.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "minimax/minimax-m3:free",   # free tier — chậm hơn (~35s/trang) nhưng OCR chính xác
            "messages": [
                {
                    "role": "system",
                    "content": "You are an OCR assistant specialized in Japanese text extraction. You always extract text faithfully without refusal."
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{b64}"}
                        },
                        {"type": "text", "text": instruction}
                    ]
                }
            ],
            "max_tokens": 2000,
            "temperature": 0,
        },
        timeout=60
    )
    response.raise_for_status()
    result = response.json()['choices'][0]['message']['content'].strip()

    # Nếu model vẫn từ chối → trả chuỗi rỗng
    refusal_patterns = ['申し訳', "I'm sorry", "I cannot", "I can't", "cannot assist"]
    if any(p in result for p in refusal_patterns):
        print(f"    ⚠️  Model từ chối trang này", flush=True)
        return ''

    return result


def extract_text_from_pdf(file_storage, page_type: str = 'exam') -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY", "")

    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
        contents = file_storage.read() if hasattr(file_storage, 'read') else file_storage
        tmp.write(contents)
        tmp_path = tmp.name

    doc = None  # khai báo trước để finally an toàn
    try:
        # Bước 1: thử text layer
        text_parts = []
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages:
                text_parts.append(page.extract_text() or '')
        cleaned = clean_text('\n'.join(text_parts))

        # Bước 2: fallback Vision OCR
        if len(cleaned) < 200:
            print(f"⚠️  Text layer quá ít, chuyển sang Vision OCR ({page_type})...", flush=True)
            text_parts = []

            doc = fitz.open(tmp_path)
            pages_imgs = []

            # Render tất cả trang trước, rồi đóng doc ngay
            for page in doc:
                mat = fitz.Matrix(250 / 72, 250 / 72)
                pix = page.get_pixmap(matrix=mat)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                pages_imgs.append(img)

            doc.close()
            doc = None  # đã đóng, tránh close 2 lần

            # OCR từng trang sau khi đã đóng fitz
            for page_num, img in enumerate(pages_imgs):
                print(f"  OCR page {page_num + 1}...", flush=True)
                try:
                    page_text = ocr_page_with_vision(img, api_key, page_type=page_type)
                    cleaned_page = clean_text(page_text)
                except Exception as e:
                    print(f"  ⚠️  Page {page_num + 1} lỗi: {e}", flush=True)
                    cleaned_page = ''
                text_parts.append(cleaned_page)
                print(f"  Page {page_num + 1}: {len(cleaned_page)} chars", flush=True)

            cleaned = '\n'.join(text_parts)

        print(f"📄 TEXT LENGTH ({page_type}, after clean): {len(cleaned)}", flush=True)
        print(cleaned[:600], flush=True)
        return cleaned

    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass
        # Đợi một chút rồi mới xóa (Windows cần thời gian release handle)
        time.sleep(0.2)
        try:
            os.unlink(tmp_path)
        except Exception as e:
            print(f"⚠️  Không xóa được file tạm: {e}", flush=True)


def parse_exam_with_claude(exam_text: str, answer_text: str) -> dict:
    api_key = os.environ.get("OPENROUTER_API_KEY", "")

    prompt = f"""Dưới đây là nội dung đề thi JLPT và đáp án.
Hãy trích xuất toàn bộ câu hỏi và trả về JSON theo đúng format sau.
QUAN TRỌNG: Chỉ trả về JSON thuần túy, không có markdown, không giải thích.

Lưu ý đáp án: correct_no là số từ 1-4 tương ứng với lựa chọn đúng.
Nếu đáp án ghi "正解：3" thì correct_no = 3.

Format JSON:
{{
  "title": "2010年7月 日本語能力試験 N3",
  "level": "N3",
  "year": 2010,
  "month": 7,
  "questions": [
    {{
      "question_no": 1,
      "section": "言語知識",
      "question_text": "nội dung câu hỏi đầy đủ",
      "choices": [
        {{"choice_no": 1, "choice_text": "..."}},
        {{"choice_no": 2, "choice_text": "..."}},
        {{"choice_no": 3, "choice_text": "..."}},
        {{"choice_no": 4, "choice_text": "..."}}
      ],
      "correct_no": 2,
      "explanation": ""
    }}
  ]
}}

===ĐỀ THI===
{exam_text}

===ĐÁP ÁN===
{answer_text}"""

    response = req.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "minimax/minimax-m3:free",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 8000,
        },
        timeout=180
    )

    response.raise_for_status()
    raw = response.json()['choices'][0]['message']['content'].strip()
    clean = re.sub(r'```json|```', '', raw).strip()
    return json.loads(clean)


def _render_mondai_structure(mondai_templates: list) -> str:
    lines = []
    current_section = None
    for t in mondai_templates:
        if t['section_type'] != current_section:
            current_section = t['section_type']
            lines.append(f"- Phần {current_section}:")
        name_part = f" - {t['name']}" if t.get('name') else ''
        desc_part = f": {t['description']}" if t.get('description') else ''
        qc_part = f" (dự kiến {t['question_count']} câu)" if t.get('question_count') else ''
        lines.append(f"  + Mondai {t['mondai_no']}{name_part}{desc_part}{qc_part}")
    return '\n'.join(lines)


def parse_exam_with_mondai_structure(exam_text: str, answer_text: str, mondai_templates: list) -> dict:
    """Parse exam text into questions grouped by the level's pre-configured
    mondai structure (see app/routes/jlpt/structure.py). Each question comes
    back tagged with (section_type, mondai_no) matching that structure, plus
    an optional shared passage_text for reading-comprehension groups. When no
    answer key was supplied, correct_no is left null for every question so
    the admin fills it in during review."""
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    structure_text = _render_mondai_structure(mondai_templates)
    has_answer = bool(answer_text.strip())

    answer_instruction = (
        "Đáp án đã cho ở phần ===ĐÁP ÁN=== bên dưới, hãy điền đúng correct_no (số 1-4) cho từng câu theo đáp án đó."
        if has_answer else
        "KHÔNG có đáp án nào được cung cấp — để correct_no = null cho MỌI câu hỏi, admin sẽ tự nhập sau."
    )

    prompt = f"""Bạn là chuyên gia phân loại đề thi JLPT.

Dưới đây là CẤU TRÚC MONDAI chuẩn của level này (admin đã cấu hình sẵn). Mỗi câu hỏi trong đề PHẢI được gán đúng vào một mondai trong danh sách này, dựa vào tiêu đề 問題n hoặc nội dung/dạng của câu hỏi:

{structure_text}

{answer_instruction}

Nếu nhiều câu hỏi liên tiếp dùng chung một đoạn văn đọc hiểu, hãy điền đoạn văn đó (giống hệt nhau) vào "passage_text" của các câu đó; nếu câu hỏi không có đoạn văn dùng chung thì để "passage_text": null.

QUAN TRỌNG — BỎ QUA CÂU VÍ DỤ: mỗi mondai thường có một câu ví dụ mẫu đứng ngay trước câu 1, được đánh dấu bằng "例" hoặc "れい" thay vì một số thứ tự thật (1, 2, 3...). Câu này chỉ minh hoạ cách làm bài, KHÔNG phải câu hỏi thật của đề — TUYỆT ĐỐI không đưa nó vào mảng "questions", kể cả khi nó có đủ câu hỏi/đáp án/lựa chọn trông giống câu thật.

QUAN TRỌNG: Chỉ trả về JSON thuần túy, không markdown, không giải thích thêm.

Format JSON:
{{
  "title": "2019年7月 日本語能力試験",
  "year": 2019,
  "month": 7,
  "questions": [
    {{
      "question_no": 1,
      "section_type": "kotoba",
      "mondai_no": 1,
      "passage_text": null,
      "question_text": "nội dung câu hỏi đầy đủ",
      "choices": [
        {{"choice_no": 1, "choice_text": "..."}},
        {{"choice_no": 2, "choice_text": "..."}},
        {{"choice_no": 3, "choice_text": "..."}},
        {{"choice_no": 4, "choice_text": "..."}}
      ],
      "correct_no": 2,
      "explanation": ""
    }}
  ]
}}

===ĐỀ THI===
{exam_text}"""

    if has_answer:
        prompt += f"\n\n===ĐÁP ÁN===\n{answer_text}"

    response = req.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "openai/gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 8000,
        },
        timeout=180
    )

    response.raise_for_status()
    raw = response.json()['choices'][0]['message']['content'].strip()
    clean = re.sub(r'```json|```', '', raw).strip()
    return json.loads(clean)


def ai_preprocess_mondai_questions(
    questions: list,
    mondai_name: str,
    mondai_description: str,
    section_type: str,
    fill_missing_answers: bool,
) -> list:
    """Second, text-only AI pass over one mondai's already-imported draft
    questions (run on demand, before the admin opens the review screen):
    inserts <u>/<b> formatting tags where the JLPT convention calls for them
    (e.g. underlining the target word in a kotoba fill-in mondai), fills
    correct_no when no answer key was available, and writes a Vietnamese
    explanation. Operates on the plain OCR'd text already in the DB — no
    access to the original page image, so it can misjudge which word to
    underline; the admin still confirms every question afterwards.
    """
    api_key = os.environ.get("OPENROUTER_API_KEY", "")

    answer_instruction = (
        "Chưa có đáp án cho các câu này — hãy tự xác định correct_no (1-4) chính xác nhất dựa trên "
        "kiến thức tiếng Nhật của bạn."
        if fill_missing_answers else
        "Đáp án đúng (correct_no) đã có sẵn cho các câu này — GIỮ NGUYÊN, không được đổi."
    )

    prompt = f"""Bạn là biên tập viên đề thi JLPT. Dưới đây là các câu hỏi thuộc mondai "{mondai_name}"
({mondai_description or 'không có mô tả'}), phần {section_type}, đã được OCR từ đề gốc nhưng mất hết định dạng
(gạch chân, in đậm) do bước OCR chỉ trích xuất text thuần.

Với MỖI câu hỏi, hãy:
1. Nếu dạng câu hỏi yêu cầu chọn/xử lý một từ hoặc cụm từ được gạch chân/in đậm trong câu gốc (ví dụ mondai
   dạng "từ được gạch chân dưới đây gần nghĩa nhất với...", hoặc chỗ trống cần điền), hãy chèn thẻ
   <u>...</u> quanh đúng từ/cụm từ đó trong "question_text". CHỈ chèn khi bạn xác định được rõ ràng từ nào
   cần đánh dấu dựa vào chính nội dung câu hỏi — nếu không chắc chắn thì để nguyên, không đoán bừa.
2. {answer_instruction}
3. Viết "explanation" ngắn gọn bằng tiếng Việt giải thích vì sao đáp án đúng, đối chiếu với các lựa chọn sai.

QUAN TRỌNG: Không đổi nội dung tiếng Nhật của câu hỏi/lựa chọn, chỉ thêm thẻ <u> khi cần. Chỉ trả về JSON
thuần túy, không markdown, không giải thích thêm, đúng format:
{{
  "questions": [
    {{
      "id": 123,
      "question_text": "...",
      "choices": [
        {{"choice_no": 1, "choice_text": "..."}},
        {{"choice_no": 2, "choice_text": "..."}},
        {{"choice_no": 3, "choice_text": "..."}},
        {{"choice_no": 4, "choice_text": "..."}}
      ],
      "correct_no": 2,
      "explanation": "..."
    }}
  ]
}}

===CÂU HỎI===
{json.dumps(questions, ensure_ascii=False, indent=2)}"""

    response = req.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "openai/gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 8000,
        },
        timeout=180
    )

    response.raise_for_status()
    raw = response.json()['choices'][0]['message']['content'].strip()
    clean = re.sub(r'```json|```', '', raw).strip()
    return json.loads(clean).get('questions', [])
