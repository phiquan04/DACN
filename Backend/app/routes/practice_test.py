import os
import tempfile
import re
import json
import base64
import psycopg2
import pdfplumber
from flask import Blueprint, request, jsonify
import requests as req
from psycopg2.extras import execute_values
from PIL import Image, ImageFilter, ImageEnhance
import fitz
import io
import numpy as np

practice_bp = Blueprint('practice_test', __name__)

NOISE_PATTERNS = [
    r'小程序[：:].+', r'日[语語]轻松考', r'打开小程序.+',
    r'真题[、，,].+', r'有解析.+', r'想要高效.+',
    r'使用小程序.+', r'日[语語]能力考', r'模拟题',
    r'练习题', r'可收藏', r'可分享',
    r'申し訳ありません.+',        # model từ chối
    r"I'?m sorry.+",
    r'解释[：:].+',               # giải thích tiếng Trung lẫn vào
    r'正解[：:].+',
]
_noise_re = re.compile('|'.join(NOISE_PATTERNS))


def has_hiragana_or_katakana(text: str) -> bool:
    return any('\u3040' <= ch <= '\u309f' or '\u30a0' <= ch <= '\u30ff' for ch in text)


def is_chinese_line(line: str) -> bool:
    cjk = sum(1 for ch in line if '\u4e00' <= ch <= '\u9fff')
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
    """
    Xóa watermark bằng cách phát hiện vùng có màu sắc đặc biệt (thường là đỏ/xanh)
    và tô trắng, giữ lại vùng text đen trên nền trắng.
    """
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
        file_storage.save(tmp.name)
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
        import time
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


def save_exam_to_db(data: dict) -> int:
    conn = psycopg2.connect(os.environ.get("DATABASE_URL"))
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO exams (title, level, year, month)
                       VALUES (%s, %s, %s, %s) RETURNING id""",
                    (data['title'], data.get('level'), data.get('year'), data.get('month'))
                )
                exam_id = cur.fetchone()[0]

                for q in data['questions']:
                    cur.execute(
                        """INSERT INTO questions (exam_id, section, question_no, question_text)
                           VALUES (%s, %s, %s, %s) RETURNING id""",
                        (exam_id, q.get('section'), q['question_no'], q['question_text'])
                    )
                    q_id = cur.fetchone()[0]

                    execute_values(cur,
                        "INSERT INTO choices (question_id, choice_no, choice_text) VALUES %s",
                        [(q_id, c['choice_no'], c['choice_text']) for c in q.get('choices', [])]
                    )

                    cur.execute(
                        """INSERT INTO answers (question_id, correct_no, explanation)
                           VALUES (%s, %s, %s)""",
                        (q_id, q.get('correct_no'), q.get('explanation'))
                    )
        return exam_id
    finally:
        conn.close()


@practice_bp.route('/import-exam', methods=['POST'])
def import_exam():
    try:
        if 'exam' not in request.files or 'answer' not in request.files:
            return jsonify({'error': "Cần upload 2 file: 'exam' và 'answer'"}), 400

        exam_file = request.files['exam']
        answer_file = request.files['answer']

        print("Extracting text from PDFs...", flush=True)
        exam_text = extract_text_from_pdf(exam_file, page_type='exam')
        answer_text = extract_text_from_pdf(answer_file, page_type='answer')

        if not exam_text.strip():
            return jsonify({'error': 'Không đọc được text từ file đề thi'}), 422

        print("Parsing with AI...", flush=True)
        parsed = parse_exam_with_claude(exam_text, answer_text)

        question_count = len(parsed.get('questions', []))
        print(f"Parsed {question_count} questions", flush=True)

        print("Saving to database...", flush=True)
        exam_id = save_exam_to_db(parsed)

        print(f"Saved exam_id={exam_id}", flush=True)
        return jsonify({
            'success': True,
            'exam_id': exam_id,
            'title': parsed.get('title'),
            'questions_imported': question_count
        }), 201

    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}", flush=True)
        return jsonify({'error': f'AI trả về JSON không hợp lệ: {str(e)}'}), 500
    except psycopg2.Error as e:
        print(f"DB error: {e}", flush=True)
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        import traceback
        print(traceback.format_exc(), flush=True)
        return jsonify({'error': str(e)}), 500


@practice_bp.route('/exams', methods=['GET'])
def get_exams():
    try:
        conn = psycopg2.connect(os.environ.get("DATABASE_URL"))
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT e.id, e.title, e.level, e.year, e.month,
                           COUNT(q.id) as question_count
                    FROM exams e
                    LEFT JOIN questions q ON q.exam_id = e.id
                    GROUP BY e.id
                    ORDER BY e.year DESC, e.month DESC
                """)
                rows = cur.fetchall()
        conn.close()
        exams = [
            {'id': r[0], 'title': r[1], 'level': r[2],
             'year': r[3], 'month': r[4], 'question_count': r[5]}
            for r in rows
        ]
        return jsonify({'exams': exams})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@practice_bp.route('/exams/<int:exam_id>/questions', methods=['GET'])
def get_exam_questions(exam_id):
    try:
        conn = psycopg2.connect(os.environ.get("DATABASE_URL"))
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT q.id, q.question_no, q.section, q.question_text,
                           a.correct_no, a.explanation
                    FROM questions q
                    LEFT JOIN answers a ON a.question_id = q.id
                    WHERE q.exam_id = %s
                    ORDER BY q.question_no
                """, (exam_id,))
                questions = cur.fetchall()

                result = []
                for row in questions:
                    q_id = row[0]
                    cur.execute(
                        "SELECT choice_no, choice_text FROM choices WHERE question_id = %s ORDER BY choice_no",
                        (q_id,)
                    )
                    choices = [{'choice_no': c[0], 'choice_text': c[1]} for c in cur.fetchall()]
                    result.append({
                        'id': q_id,
                        'question_no': row[1],
                        'section': row[2],
                        'question_text': row[3],
                        'choices': choices,
                        'correct_no': row[4],
                        'explanation': row[5]
                    })
        conn.close()
        return jsonify({'exam_id': exam_id, 'questions': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500