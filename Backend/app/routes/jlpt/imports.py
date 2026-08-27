"""Admin import of a JLPT exam PDF (+ optional answer-key PDF). Reuses the
PDF/vision OCR from app.services.practice_test_ocr, then has the AI group
questions into the mondai already configured for the chosen level (see
structure.py) instead of leaving them as a flat, unclassified list.

The resulting exam is saved with status='draft' — it stays invisible to
users until an admin reviews/corrects it and publishes it (a later step).
"""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.dependencies import require_admin, UserResponse
from app.models.database import get_db
from app.models.jlpt import JlptChoice, JlptExam, JlptLevelStructure, JlptPassage, JlptQuestion, JlptSection
from app.schemas.jlpt import ImportExamResponse, JlptLevel
from app.services import practice_test_ocr

router = APIRouter(prefix="/exams", tags=["jlpt-exams"])


@router.post("/import", response_model=ImportExamResponse)
def import_exam(
    level: JlptLevel = Form(...),
    title: Optional[str] = Form(None),
    year: Optional[int] = Form(None),
    month: Optional[int] = Form(None),
    exam: UploadFile = File(...),
    answer: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    admin: UserResponse = Depends(require_admin),
):
    structure = (
        db.query(JlptLevelStructure)
        .options(joinedload(JlptLevelStructure.sections).joinedload(JlptSection.mondai_templates))
        .filter(JlptLevelStructure.level == level)
        .first()
    )
    if not structure or not structure.sections:
        raise HTTPException(
            status_code=400,
            detail=f"Chưa cấu hình cấu trúc mondai cho level {level}. Hãy setup cấu trúc trước khi import đề.",
        )

    mondai_templates = []
    id_lookup = {}
    for section in sorted(structure.sections, key=lambda s: s.order_no):
        for m in sorted(section.mondai_templates, key=lambda m: m.mondai_no):
            mondai_templates.append({
                "section_type": section.section_type,
                "mondai_no": m.mondai_no,
                "name": m.name,
                "description": m.description,
                "question_count": m.question_count,
            })
            id_lookup[(section.section_type, m.mondai_no)] = m.id
    if not mondai_templates:
        raise HTTPException(
            status_code=400,
            detail=f"Level {level} chưa có mondai nào trong cấu trúc. Hãy thêm mondai trước khi import đề.",
        )

    exam_text = practice_test_ocr.extract_text_from_pdf(exam.file.read(), page_type='exam')
    if not exam_text.strip():
        raise HTTPException(status_code=422, detail="Không đọc được text từ file đề thi")

    answer_text = ""
    if answer is not None:
        answer_bytes = answer.file.read()
        if answer_bytes:
            answer_text = practice_test_ocr.extract_text_from_pdf(answer_bytes, page_type='answer')

    try:
        parsed = practice_test_ocr.parse_exam_with_mondai_structure(exam_text, answer_text, mondai_templates)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI phân tích đề thi thất bại: {e}")

    parsed_questions = parsed.get('questions', [])
    if not parsed_questions:
        raise HTTPException(status_code=422, detail="AI không tách được câu hỏi nào từ đề thi")

    fallback_mondai_id = next(iter(id_lookup.values()))

    jlpt_exam = JlptExam(
        title=(title or parsed.get('title') or f"{level} {year or parsed.get('year') or ''}").strip(),
        level=level,
        level_structure_id=structure.id,
        year=year or parsed.get('year'),
        month=month or parsed.get('month'),
        status='draft',
        has_answer_key=bool(answer_text.strip()),
        created_by=admin.id,
    )
    db.add(jlpt_exam)

    passage_cache = {}
    unmapped_count = 0

    for q in parsed_questions:
        mondai_template_id = id_lookup.get((q.get('section_type'), q.get('mondai_no')))
        if mondai_template_id is None:
            mondai_template_id = fallback_mondai_id
            unmapped_count += 1

        passage = None
        passage_text = (q.get('passage_text') or '').strip()
        if passage_text:
            passage = passage_cache.get(passage_text)
            if not passage:
                passage = JlptPassage(
                    exam=jlpt_exam,
                    section_type=q.get('section_type') or 'dokkai',
                    order_no=len(passage_cache),
                    passage_text=passage_text,
                )
                db.add(passage)
                passage_cache[passage_text] = passage

        question = JlptQuestion(
            exam=jlpt_exam,
            mondai_template_id=mondai_template_id,
            passage=passage,
            question_no=q.get('question_no') or 0,
            question_text=q.get('question_text', ''),
            correct_no=q.get('correct_no'),
            explanation=q.get('explanation') or None,
            is_reviewed=False,
        )
        db.add(question)
        for c in q.get('choices', []):
            db.add(JlptChoice(question=question, choice_no=c.get('choice_no'), choice_text=c.get('choice_text', '')))

    db.commit()
    db.refresh(jlpt_exam)

    return ImportExamResponse(
        exam_id=jlpt_exam.id,
        title=jlpt_exam.title,
        level=jlpt_exam.level,
        status=jlpt_exam.status,
        question_count=len(parsed_questions),
        has_answer_key=jlpt_exam.has_answer_key,
        unmapped_count=unmapped_count,
    )
