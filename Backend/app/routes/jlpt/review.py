"""Admin review of an imported (draft) JLPT exam: inspect questions grouped
by mondai, correct OCR/AI mistakes, fill in answers/explanations, then
publish so the exam becomes visible to users (see structure.py for how the
mondai grouping is defined, imports.py for how a draft gets created)."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.dependencies import require_admin, UserResponse
from app.models.database import get_db
from app.models.jlpt import (
    JlptChoice, JlptExam, JlptLevelStructure, JlptMondaiTemplate, JlptPassage, JlptQuestion, JlptSection,
)
from app.schemas.jlpt import (
    ExamReviewOut, ExamSummary, JlptLevel, QuestionCreate, QuestionPatch, QuestionReviewOut,
)
from app.services import practice_test_ocr

router = APIRouter(prefix="/exams", tags=["jlpt-exams"])


def _renumber_exam(db: Session, exam_id: int) -> None:
    """Reassigns question_no sequentially (1..N) across the whole exam, in
    section -> mondai -> existing-order order — matching how a real JLPT
    paper numbers questions continuously across mondai/sections rather than
    restarting at 1 per mondai. Called after any add/delete/move so numbering
    never has gaps or duplicates."""
    questions = (
        db.query(JlptQuestion)
        .join(JlptMondaiTemplate, JlptQuestion.mondai_template_id == JlptMondaiTemplate.id)
        .join(JlptSection, JlptMondaiTemplate.section_id == JlptSection.id)
        .filter(JlptQuestion.exam_id == exam_id)
        .order_by(JlptSection.order_no, JlptMondaiTemplate.mondai_no, JlptQuestion.question_no, JlptQuestion.id)
        .all()
    )
    for i, q in enumerate(questions, start=1):
        q.question_no = i


def _question_out(q: JlptQuestion) -> dict:
    return {
        "id": q.id,
        "question_no": q.question_no,
        "question_text": q.question_text,
        "passage_text": q.passage.passage_text if q.passage else None,
        "choices": [
            {"id": c.id, "choice_no": c.choice_no, "choice_text": c.choice_text}
            for c in sorted(q.choices, key=lambda c: c.choice_no)
        ],
        "correct_no": q.correct_no,
        "explanation": q.explanation,
        "is_reviewed": q.is_reviewed,
        "updated_at": q.updated_at.isoformat() if q.updated_at else None,
    }


def _exam_summary(exam: JlptExam) -> dict:
    return {
        "id": exam.id, "title": exam.title, "level": exam.level,
        "status": exam.status, "year": exam.year, "month": exam.month,
        "has_answer_key": exam.has_answer_key,
        "question_count": len(exam.questions),
        "reviewed_count": sum(1 for q in exam.questions if q.is_reviewed),
    }


@router.get("", response_model=List[ExamSummary])
def list_exams(
    level: Optional[JlptLevel] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    query = db.query(JlptExam).options(selectinload(JlptExam.questions))
    if level:
        query = query.filter(JlptExam.level == level)
    if status_filter:
        query = query.filter(JlptExam.status == status_filter)
    exams = query.order_by(JlptExam.created_at.desc()).all()
    return [_exam_summary(e) for e in exams]


@router.get("/{exam_id}", response_model=ExamReviewOut)
def get_exam_for_review(
    exam_id: int,
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    exam = (
        db.query(JlptExam)
        .options(
            selectinload(JlptExam.questions).selectinload(JlptQuestion.choices),
            selectinload(JlptExam.questions).selectinload(JlptQuestion.passage),
            joinedload(JlptExam.level_structure)
            .joinedload(JlptLevelStructure.sections)
            .joinedload(JlptSection.mondai_templates),
        )
        .filter(JlptExam.id == exam_id)
        .first()
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi")

    questions_by_mondai = {}
    for q in exam.questions:
        questions_by_mondai.setdefault(q.mondai_template_id, []).append(q)

    sections_out = []
    for section in sorted(exam.level_structure.sections, key=lambda s: s.order_no):
        mondai_out = []
        for m in sorted(section.mondai_templates, key=lambda m: m.mondai_no):
            qs = sorted(questions_by_mondai.get(m.id, []), key=lambda q: q.question_no)
            mondai_out.append({
                "mondai_template_id": m.id, "mondai_no": m.mondai_no,
                "name": m.name, "description": m.description, "tips": m.tips,
                "questions": [_question_out(q) for q in qs],
            })
        sections_out.append({
            "section_type": section.section_type, "name": section.name, "mondai": mondai_out,
        })

    total = len(exam.questions)
    reviewed = sum(1 for q in exam.questions if q.is_reviewed)
    ready = total > 0 and all(q.correct_no is not None and q.is_reviewed for q in exam.questions)

    return {
        "id": exam.id, "title": exam.title, "level": exam.level,
        "year": exam.year, "month": exam.month, "status": exam.status,
        "has_answer_key": exam.has_answer_key,
        "sections": sections_out,
        "total_questions": total, "reviewed_count": reviewed, "ready_to_publish": ready,
    }


@router.post("/{exam_id}/ai-preprocess", response_model=ExamReviewOut)
def ai_preprocess_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    admin: UserResponse = Depends(require_admin),
):
    """Runs a second, text-only AI pass over every not-yet-reviewed question in
    this draft exam (grouped by mondai, one AI call per mondai): inserts
    <u>/<b> formatting tags the free-tier OCR step stripped out, fills
    correct_no when no answer key was imported, and writes an explanation.
    Only touches questions with is_reviewed=False, so it never overwrites
    what an admin already confirmed by hand. A mondai whose AI call fails is
    skipped (logged, not fatal) so the rest of the exam still gets processed."""
    exam = (
        db.query(JlptExam)
        .options(
            selectinload(JlptExam.questions).selectinload(JlptQuestion.choices),
            selectinload(JlptExam.questions)
            .selectinload(JlptQuestion.mondai_template)
            .joinedload(JlptMondaiTemplate.section),
        )
        .filter(JlptExam.id == exam_id)
        .first()
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi")
    if exam.status == 'published':
        raise HTTPException(status_code=400, detail="Đề đã publish, không thể chạy AI xử lý lại")

    pending = [q for q in exam.questions if not q.is_reviewed]
    if not pending:
        raise HTTPException(status_code=409, detail="Không còn câu nào chưa duyệt để AI xử lý")

    by_mondai = {}
    for q in pending:
        by_mondai.setdefault(q.mondai_template_id, []).append(q)

    failed_count = 0
    for qs in by_mondai.values():
        mondai = qs[0].mondai_template
        payload = [
            {
                "id": q.id,
                "question_text": q.question_text,
                "choices": [
                    {"choice_no": c.choice_no, "choice_text": c.choice_text}
                    for c in sorted(q.choices, key=lambda c: c.choice_no)
                ],
                "correct_no": q.correct_no,
            }
            for q in qs
        ]
        fill_missing = any(q.correct_no is None for q in qs)
        try:
            results = practice_test_ocr.ai_preprocess_mondai_questions(
                payload,
                mondai.name or f"Mondai {mondai.mondai_no}",
                mondai.description or '',
                mondai.section.section_type,
                fill_missing,
            )
        except Exception as e:
            print(f"[JLPT AI preprocess] Mondai {mondai.mondai_no} thất bại: {e}", flush=True)
            failed_count += 1
            continue

        q_by_id = {q.id: q for q in qs}
        for r in results:
            q = q_by_id.get(r.get('id'))
            if not q:
                continue
            if r.get('question_text'):
                q.question_text = r['question_text']
            if r.get('choices'):
                existing_by_no = {c.choice_no: c for c in q.choices}
                for c in r['choices']:
                    choice = existing_by_no.get(c.get('choice_no'))
                    if choice and c.get('choice_text'):
                        choice.choice_text = c['choice_text']
            if q.correct_no is None and r.get('correct_no') is not None:
                q.correct_no = r['correct_no']
            if not q.explanation and r.get('explanation'):
                q.explanation = r['explanation']

    if failed_count == len(by_mondai):
        db.rollback()
        raise HTTPException(status_code=502, detail="AI xử lý thất bại cho tất cả mondai, thử lại sau")

    db.commit()
    return get_exam_for_review(exam_id, db, admin)


@router.patch("/{exam_id}/questions/{question_id}", response_model=QuestionReviewOut)
def update_question(
    exam_id: int,
    question_id: int,
    payload: QuestionPatch,
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    question = (
        db.query(JlptQuestion)
        .filter(JlptQuestion.id == question_id, JlptQuestion.exam_id == exam_id)
        .first()
    )
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")

    fields = payload.model_dump(exclude_unset=True)
    moved = False

    if 'mondai_template_id' in fields:
        mondai = (
            db.query(JlptMondaiTemplate)
            .join(JlptSection)
            .filter(
                JlptMondaiTemplate.id == fields['mondai_template_id'],
                JlptSection.level_structure_id == question.exam.level_structure_id,
            )
            .first()
        )
        if not mondai:
            raise HTTPException(status_code=400, detail="Mondai không thuộc cấu trúc của level này")
        if mondai.id != question.mondai_template_id:
            moved = True
        question.mondai_template_id = mondai.id

    if 'question_text' in fields:
        question.question_text = fields['question_text']

    if 'correct_no' in fields:
        question.correct_no = fields['correct_no']

    if 'explanation' in fields:
        question.explanation = fields['explanation']

    if 'choices' in fields:
        for c in list(question.choices):
            db.delete(c)
        db.flush()
        for c in fields['choices']:
            db.add(JlptChoice(question=question, choice_no=c['choice_no'], choice_text=c['choice_text']))

    if 'passage_text' in fields:
        text = (fields['passage_text'] or '').strip()
        if not text:
            question.passage_id = None
        elif question.passage:
            question.passage.passage_text = text
        else:
            section_type = question.mondai_template.section.section_type
            passage = JlptPassage(
                exam_id=exam_id, section_type=section_type, order_no=0, passage_text=text,
            )
            db.add(passage)
            db.flush()
            question.passage_id = passage.id

    if 'is_reviewed' in fields:
        question.is_reviewed = fields['is_reviewed']
    elif fields:
        question.is_reviewed = True  # any other edit implies the admin looked at this question

    if moved:
        db.flush()
        _renumber_exam(db, exam_id)

    db.commit()
    db.refresh(question)
    return _question_out(question)


@router.post("/{exam_id}/questions", response_model=QuestionReviewOut)
def create_question(
    exam_id: int,
    payload: QuestionCreate,
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    exam = db.query(JlptExam).filter(JlptExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi")

    mondai = (
        db.query(JlptMondaiTemplate)
        .join(JlptSection)
        .filter(
            JlptMondaiTemplate.id == payload.mondai_template_id,
            JlptSection.level_structure_id == exam.level_structure_id,
        )
        .first()
    )
    if not mondai:
        raise HTTPException(status_code=400, detail="Mondai không thuộc cấu trúc của level này")

    passage_id = None
    passage_text = (payload.passage_text or '').strip()
    if passage_text:
        passage = JlptPassage(
            exam_id=exam_id, section_type=mondai.section.section_type, order_no=0, passage_text=passage_text,
        )
        db.add(passage)
        db.flush()
        passage_id = passage.id

    question = JlptQuestion(
        exam_id=exam_id,
        mondai_template_id=mondai.id,
        passage_id=passage_id,
        question_no=0,  # placeholder — _renumber_exam fixes it below
        question_text=payload.question_text,
        correct_no=payload.correct_no,
        explanation=payload.explanation,
        is_reviewed=False,
    )
    db.add(question)
    db.flush()
    for c in payload.choices:
        db.add(JlptChoice(question=question, choice_no=c.choice_no, choice_text=c.choice_text))

    db.flush()
    _renumber_exam(db, exam_id)
    db.commit()
    db.refresh(question)
    return _question_out(question)


@router.delete("/{exam_id}/questions/{question_id}")
def delete_question(
    exam_id: int,
    question_id: int,
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    question = (
        db.query(JlptQuestion)
        .filter(JlptQuestion.id == question_id, JlptQuestion.exam_id == exam_id)
        .first()
    )
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")

    try:
        db.delete(question)
        db.flush()
        _renumber_exam(db, exam_id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Không thể xóa: câu hỏi này đã có người làm bài (thuộc đề đã publish).",
        )
    return {"success": True}


@router.post("/{exam_id}/publish", response_model=ExamSummary)
def publish_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    exam = (
        db.query(JlptExam)
        .options(selectinload(JlptExam.questions))
        .filter(JlptExam.id == exam_id)
        .first()
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi")
    if exam.status == 'published':
        raise HTTPException(status_code=400, detail="Đề thi đã được publish rồi")
    if not exam.questions:
        raise HTTPException(status_code=409, detail="Đề thi chưa có câu hỏi nào")

    not_ready = sorted(
        q.question_no for q in exam.questions if q.correct_no is None or not q.is_reviewed
    )
    if not_ready:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Còn {len(not_ready)} câu chưa hoàn tất review "
                f"(chưa có đáp án đúng hoặc chưa xác nhận): câu {not_ready}"
            ),
        )

    exam.status = 'published'
    db.commit()
    db.refresh(exam)
    return _exam_summary(exam)


@router.delete("/{exam_id}")
def delete_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    exam = db.query(JlptExam).filter(JlptExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi")
    try:
        db.delete(exam)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Không thể xóa: đề thi này đã có người làm bài.")
    return {"success": True}
