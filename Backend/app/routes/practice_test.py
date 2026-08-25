import json

import psycopg2
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services import practice_test_ocr, practice_test_repository

router = APIRouter()


@router.post('/import-exam')
def import_exam(exam: UploadFile = File(...), answer: UploadFile = File(...)):
    """Import exam PDFs and parse them"""
    try:
        print("Extracting text from PDFs...", flush=True)
        exam_bytes = exam.file.read()
        answer_bytes = answer.file.read()

        exam_text = practice_test_ocr.extract_text_from_pdf(exam_bytes, page_type='exam')
        answer_text = practice_test_ocr.extract_text_from_pdf(answer_bytes, page_type='answer')

        if not exam_text.strip():
            raise HTTPException(status_code=422, detail='Không đọc được text từ file đề thi')

        print("Parsing with AI...", flush=True)
        parsed = practice_test_ocr.parse_exam_with_claude(exam_text, answer_text)

        question_count = len(parsed.get('questions', []))
        print(f"Parsed {question_count} questions", flush=True)

        print("Saving to database...", flush=True)
        exam_id = practice_test_repository.save_exam_to_db(parsed)

        print(f"Saved exam_id={exam_id}", flush=True)
        return {
            'success': True,
            'exam_id': exam_id,
            'title': parsed.get('title'),
            'questions_imported': question_count
        }

    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f'AI trả về JSON không hợp lệ: {str(e)}')
    except psycopg2.Error as e:
        print(f"DB error: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f'Database error: {str(e)}')
    except Exception as e:
        import traceback
        print(traceback.format_exc(), flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/exams')
def get_exams():
    """Get all exams"""
    try:
        exams = practice_test_repository.list_exams()
        return {'exams': exams}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/exams/{exam_id}/questions')
def get_exam_questions(exam_id: int):
    """Get all questions for an exam"""
    try:
        questions = practice_test_repository.get_exam_questions(exam_id)
        return {'exam_id': exam_id, 'questions': questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
