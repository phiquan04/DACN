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
            "model": "google/gemini-2.0-flash-exp:free",   # dùng 4o thay vì 4o-mini để tránh bị từ chối
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
            "model": "google/gemini-2.0-flash-exp:free",
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
