"""User-facing JLPT exams: browse published exams, take one, submit answers
for scoring, and view attempt history / average score per level.

Deliberately on its own top-level paths (/published-exams, /attempts) rather
than nested under /exams/{exam_id} like the admin routes in review.py — a
literal path such as /exams/published would collide with review.py's
GET /exams/{exam_id} (Starlette matches routes by path shape before FastAPI
validates the {exam_id} type, so whichever router happened to be registered
first would silently win). Distinct top-level paths avoid depending on
router registration order.
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload

from app.dependencies import get_current_user, get_optional_user_id, UserResponse
from app.models.database import get_db
from app.models.jlpt import (
    JlptExam, JlptLevelStructure, JlptQuestion, JlptSection, JlptTestAttempt, JlptTestAttemptAnswer,
)
from app.models.profile import UserInformation
from app.models.user import User
from app.schemas.jlpt import (
    AttemptDetailOut, AttemptHistoryItem, ExamRankingEntryOut, ExamRankingOut, JlptLevel, LevelAverage,
    PublishedExamSummary, SubmitAttemptIn, SubmitAttemptOut, TakeExamOut,
)
from app.services.audit_log import log_event
from app.services.jlpt_scoring import JLPT_PASS_TOTALS, build_score_breakdown, raw_section_counts

router = APIRouter(tags=["jlpt-attempts"])

# How many top scorers "Bảng xếp hạng" shows before falling back to a
# separate "vị trí của bạn" row for the current user.
RANKING_TOP_N = 10


@router.get("/published-exams", response_model=List[PublishedExamSummary])
def list_published_exams(
    level: Optional[JlptLevel] = None,
    db: Session = Depends(get_db),
    current_user_id: Optional[int] = Depends(get_optional_user_id),
):
    query = (
        db.query(JlptExam)
        .options(selectinload(JlptExam.questions), joinedload(JlptExam.level_structure))
        .filter(JlptExam.status == 'published')
    )
    if level:
        query = query.filter(JlptExam.level == level)
    exams = query.order_by(JlptExam.year.desc(), JlptExam.month.desc()).all()

    best_by_exam = {}
    if current_user_id and exams:
        exam_ids = [e.id for e in exams]
        attempts = (
            db.query(JlptTestAttempt)
            .filter(
                JlptTestAttempt.user_id == current_user_id,
                JlptTestAttempt.exam_id.in_(exam_ids),
                JlptTestAttempt.status == 'completed',
            )
            .all()
        )
        for a in attempts:
            entry = best_by_exam.setdefault(a.exam_id, {"best_score": None, "best_total": None, "attempt_count": 0})
            entry["attempt_count"] += 1
            if a.total_questions and (entry["best_score"] is None or (a.score or 0) > entry["best_score"]):
                entry["best_score"] = a.score or 0
                entry["best_total"] = a.total_questions

    return [
        {
            "id": e.id, "title": e.title, "level": e.level,
            "year": e.year, "month": e.month,
            "total_time_minutes": e.level_structure.total_time_minutes if e.level_structure else None,
            "question_count": len(e.questions),
            **best_by_exam.get(e.id, {"best_score": None, "best_total": None, "attempt_count": 0}),
        }
        for e in exams
    ]


def _load_exam_for_taking(db: Session, exam_id: int, require_published: bool) -> Optional[JlptExam]:
    query = (
        db.query(JlptExam)
        .options(
            selectinload(JlptExam.questions).selectinload(JlptQuestion.choices),
            selectinload(JlptExam.questions).selectinload(JlptQuestion.passage),
            joinedload(JlptExam.level_structure)
            .joinedload(JlptLevelStructure.sections)
            .joinedload(JlptSection.mondai_templates),
        )
        .filter(JlptExam.id == exam_id)
    )
    if require_published:
        query = query.filter(JlptExam.status == 'published')
    return query.first()


def _build_take_exam_out(exam: JlptExam) -> dict:
    questions_by_mondai = {}
    for q in exam.questions:
        questions_by_mondai.setdefault(q.mondai_template_id, []).append(q)

    sections_out = []
    for section in sorted(exam.level_structure.sections, key=lambda s: s.order_no):
        mondai_out = []
        for m in sorted(section.mondai_templates, key=lambda m: m.mondai_no):
            qs = sorted(questions_by_mondai.get(m.id, []), key=lambda q: q.question_no)
            if not qs:
                continue
            mondai_out.append({
                "mondai_no": m.mondai_no, "name": m.name, "description": m.description,
                "tips": m.tips, "time_minutes": m.time_minutes, "question_count": m.question_count,
                "questions": [
                    {
                        "id": q.id, "question_no": q.question_no, "question_text": q.question_text,
                        "passage_text": q.passage.passage_text if q.passage else None,
                        "choices": [
                            {"choice_no": c.choice_no, "choice_text": c.choice_text}
                            for c in sorted(q.choices, key=lambda c: c.choice_no)
                        ],
                    }
                    for q in qs
                ],
            })
        if mondai_out:
            sections_out.append({
                "section_type": section.section_type, "name": section.name,
                "time_minutes": section.time_minutes, "mondai": mondai_out,
            })

    return {
        "id": exam.id, "title": exam.title, "level": exam.level,
        "total_time_minutes": exam.level_structure.total_time_minutes if exam.level_structure else None,
        "sections": sections_out,
    }


@router.get("/published-exams/{exam_id}", response_model=TakeExamOut)
def get_exam_to_take(exam_id: int, db: Session = Depends(get_db)):
    exam = _load_exam_for_taking(db, exam_id, require_published=True)
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi")
    return _build_take_exam_out(exam)


@router.get("/published-exams/{exam_id}/ranking", response_model=ExamRankingOut)
def get_exam_ranking(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user_id: Optional[int] = Depends(get_optional_user_id),
):
    exam = db.query(JlptExam).filter(JlptExam.id == exam_id, JlptExam.status == 'published').first()
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi")

    attempts = (
        db.query(JlptTestAttempt)
        .filter(JlptTestAttempt.exam_id == exam_id, JlptTestAttempt.status == 'completed')
        .order_by(JlptTestAttempt.submitted_at.asc())
        .all()
    )

    # One row per user: their highest-scoring attempt, ties broken by whoever
    # reached that score first (attempts were pulled oldest-first above, and
    # strict `>` here keeps the earliest attempt on an equal score).
    best_by_user: dict = {}
    for a in attempts:
        current = best_by_user.get(a.user_id)
        if current is None or (a.score or 0) > (current.score or 0):
            best_by_user[a.user_id] = a

    ranked = sorted(
        best_by_user.values(),
        key=lambda a: (-(a.score or 0), a.submitted_at or datetime.max),
    )

    users_by_id = {}
    if ranked:
        rows = (
            db.query(User, UserInformation)
            .outerjoin(UserInformation, UserInformation.user_id == User.id)
            .filter(User.id.in_([a.user_id for a in ranked]))
            .all()
        )
        users_by_id = {u.id: (u, info) for u, info in rows}

    def duration_minutes(a: JlptTestAttempt) -> Optional[int]:
        # created_at doubles as started_at (see JlptTestAttempt docstring).
        if not a.submitted_at or not a.created_at:
            return None
        return max(0, round((a.submitted_at - a.created_at).total_seconds() / 60))

    def to_entry(rank: int, a: JlptTestAttempt) -> dict:
        user, info = users_by_id.get(a.user_id, (None, None))
        return {
            "rank": rank,
            "user_id": a.user_id,
            "username": user.username if user else "Người dùng ẩn danh",
            "avatar_url": info.avatar_url if info else None,
            "is_verified": bool(user.email_verified) if user else False,
            "score": a.score or 0,
            "total_questions": a.total_questions or 0,
            "percent": round((a.score or 0) / a.total_questions * 100, 1) if a.total_questions else 0.0,
            "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
            "duration_minutes": duration_minutes(a),
            "is_me": a.user_id == current_user_id,
        }

    top = ranked[:RANKING_TOP_N]
    entries = [to_entry(i + 1, a) for i, a in enumerate(top)]

    me = None
    if current_user_id and current_user_id not in {a.user_id for a in top}:
        for idx, a in enumerate(ranked):
            if a.user_id == current_user_id:
                me = to_entry(idx + 1, a)
                break

    return {
        "entries": entries, "me": me,
        "total_attempts": len(attempts),
        "pass_total": JLPT_PASS_TOTALS.get(exam.level),
    }


@router.post("/published-exams/{exam_id}/submit", response_model=SubmitAttemptOut)
def submit_attempt(
    exam_id: int,
    payload: SubmitAttemptIn,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    exam = (
        db.query(JlptExam)
        .options(selectinload(JlptExam.questions).selectinload(JlptQuestion.choices))
        .filter(JlptExam.id == exam_id, JlptExam.status == 'published')
        .first()
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi")

    exam_question_ids = {q.id for q in exam.questions}
    answer_by_question = {
        a.question_id: a.selected_choice_no
        for a in payload.answers
        if a.question_id in exam_question_ids
    }

    submitted_at = datetime.now(timezone.utc)
    attempt = JlptTestAttempt(
        user_id=current_user.id, exam_id=exam.id, status='completed',
        submitted_at=submitted_at,
    )
    # created_at doubles as started_at (see the model docstring), but this
    # row only comes into existence now — left at its default it would equal
    # submitted_at and every attempt would report a 0-minute duration. Back-
    # date it by the time the client says the exam was open.
    if payload.elapsed_seconds is not None:
        attempt.created_at = submitted_at - timedelta(seconds=payload.elapsed_seconds)
    db.add(attempt)

    graded = []
    score = 0
    for q in sorted(exam.questions, key=lambda q: q.question_no):
        selected = answer_by_question.get(q.id)
        is_correct = selected is not None and q.correct_no is not None and selected == q.correct_no
        if is_correct:
            score += 1
        db.add(JlptTestAttemptAnswer(
            attempt=attempt, question_id=q.id, selected_choice_no=selected, is_correct=is_correct,
        ))
        graded.append({
            "question_id": q.id, "selected_choice_no": selected,
            "correct_no": q.correct_no, "is_correct": is_correct, "explanation": q.explanation,
        })

    total = len(exam.questions)
    attempt.score = score
    attempt.total_questions = total

    log_event(
        db, subject_user_id=current_user.id, action="jlpt.test_completed",
        description=f"Hoàn thành bài kiểm tra JLPT {exam.level} — {score}/{total} câu đúng",
        actor_user_id=current_user.id, actor_role="user",
        extra_data={"exam_id": exam.id, "score": score, "total": total},
    )

    db.commit()
    db.refresh(attempt)

    breakdown = build_score_breakdown(exam.level, raw_section_counts(db, attempt.answers))

    return {
        "attempt_id": attempt.id, "exam_id": exam.id, "score": score, "total_questions": total,
        "percent": round(score / total * 100, 1) if total else 0.0,
        "answers": graded,
        "total": breakdown["total"], "total_max": breakdown["total_max"],
        "pass_total": breakdown["pass_total"], "is_pass": breakdown["is_pass"],
        "sections": breakdown["sections"],
    }


@router.get("/attempts/me", response_model=List[AttemptHistoryItem])
def list_my_attempts(
    level: Optional[JlptLevel] = None,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    query = (
        db.query(JlptTestAttempt)
        .join(JlptExam)
        .options(joinedload(JlptTestAttempt.exam), selectinload(JlptTestAttempt.answers))
        .filter(JlptTestAttempt.user_id == current_user.id, JlptTestAttempt.status == 'completed')
    )
    if level:
        query = query.filter(JlptExam.level == level)
    attempts = query.order_by(JlptTestAttempt.submitted_at.desc()).all()

    def is_pass(a: JlptTestAttempt) -> Optional[bool]:
        counts = raw_section_counts(db, a.answers)
        if not counts:
            return None
        return build_score_breakdown(a.exam.level, counts)["is_pass"]

    return [
        {
            "attempt_id": a.id, "exam_id": a.exam_id, "exam_title": a.exam.title, "level": a.exam.level,
            "score": a.score or 0, "total_questions": a.total_questions or 0,
            "percent": round((a.score or 0) / a.total_questions * 100, 1) if a.total_questions else 0.0,
            "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
            "is_pass": is_pass(a),
        }
        for a in attempts
    ]


@router.get("/attempts/{attempt_id:int}", response_model=AttemptDetailOut)
def get_attempt_detail(
    attempt_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    attempt = (
        db.query(JlptTestAttempt)
        .options(selectinload(JlptTestAttempt.answers))
        .filter(JlptTestAttempt.id == attempt_id, JlptTestAttempt.status == 'completed')
        .first()
    )
    if not attempt or attempt.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy lượt làm bài")

    # Not restricted to status == 'published': a learner should still be able
    # to review an attempt even if the exam was unpublished afterwards.
    exam = _load_exam_for_taking(db, attempt.exam_id, require_published=False)
    if not exam or not exam.level_structure:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi")

    answer_by_question = {a.question_id: a for a in attempt.answers}
    graded = [
        {
            "question_id": q.id,
            "selected_choice_no": answer_by_question[q.id].selected_choice_no if q.id in answer_by_question else None,
            "correct_no": q.correct_no,
            "is_correct": bool(answer_by_question[q.id].is_correct) if q.id in answer_by_question else False,
            "explanation": q.explanation,
        }
        for q in sorted(exam.questions, key=lambda q: q.question_no)
    ]

    breakdown = build_score_breakdown(exam.level, raw_section_counts(db, attempt.answers))
    total = attempt.total_questions or 0

    return {
        "exam": _build_take_exam_out(exam),
        "result": {
            "attempt_id": attempt.id, "exam_id": exam.id,
            "score": attempt.score or 0, "total_questions": total,
            "percent": round((attempt.score or 0) / total * 100, 1) if total else 0.0,
            "answers": graded,
            "total": breakdown["total"], "total_max": breakdown["total_max"],
            "pass_total": breakdown["pass_total"], "is_pass": breakdown["is_pass"],
            "sections": breakdown["sections"],
        },
    }


@router.get("/attempts/average", response_model=List[LevelAverage])
def average_score_by_level(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    attempts = (
        db.query(JlptTestAttempt)
        .join(JlptExam)
        .options(joinedload(JlptTestAttempt.exam))
        .filter(JlptTestAttempt.user_id == current_user.id, JlptTestAttempt.status == 'completed')
        .all()
    )
    by_level = {}
    for a in attempts:
        if not a.total_questions:
            continue
        by_level.setdefault(a.exam.level, []).append((a.score or 0) / a.total_questions * 100)

    return [
        {"level": level, "attempt_count": len(percents), "average_percent": round(sum(percents) / len(percents), 1)}
        for level, percents in sorted(by_level.items())
    ]
