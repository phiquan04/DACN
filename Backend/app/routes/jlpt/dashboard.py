"""User-facing JLPT dashboard: the "kỳ thi sắp tới" / "điểm dự kiến" / "dạng
câu hỏi hay sai" cards at the top of the practice page. See
app/services/jlpt_scoring.py for the scaled-score approximation these are
built from, and JlptExamSchedule/JlptUserExamPlan in app/models/jlpt.py for
what "kỳ thi sắp tới" tracks (the app's own target-exam plan, not a real
JLPT registration integration).
"""
import math
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.dependencies import get_current_user, UserResponse
from app.models.database import get_db
from app.models.jlpt import (
    JlptExam, JlptExamSchedule, JlptMondaiTemplate, JlptQuestion, JlptSection,
    JlptTestAttempt, JlptTestAttemptAnswer, JlptUserExamPlan,
)
from app.schemas.jlpt import (
    DashboardOut, ExamPlanIn, ExamPlanOut, ExamScheduleOut, JlptLevel,
    UpcomingExamOut, WeakMondaiOut,
)
from app.services.jlpt_scoring import JLPT_PASS_TOTALS, build_score_breakdown, raw_section_counts

router = APIRouter(tags=["jlpt-dashboard"])

WEAK_MONDAI_WINDOW_DAYS = 30
WEAK_MONDAI_MIN_ATTEMPTS = 3
WEAK_MONDAI_LIMIT = 3
# Rough assumption for the study-pace hint: average scaled-score points a
# learner gains per completed practice exam. Not measured — a deliberately
# conservative constant so the "N đề/tuần" suggestion stays a loose guide.
ASSUMED_POINTS_PER_EXAM = 15


def _schedule_out(s: JlptExamSchedule) -> dict:
    return {
        "id": s.id, "level": s.level,
        "exam_date": s.exam_date.isoformat(), "registration_deadline": s.registration_deadline.isoformat(),
    }


@router.get("/schedules", response_model=List[ExamScheduleOut])
def list_schedules(level: Optional[JlptLevel] = None, db: Session = Depends(get_db)):
    today = date.today()
    query = db.query(JlptExamSchedule).filter(JlptExamSchedule.exam_date >= today)
    if level:
        query = query.filter((JlptExamSchedule.level == level) | (JlptExamSchedule.level.is_(None)))
    schedules = query.order_by(JlptExamSchedule.exam_date.asc()).all()
    return [_schedule_out(s) for s in schedules]


@router.get("/exam-plan", response_model=ExamPlanOut)
def get_exam_plan(
    level: JlptLevel,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    plan = (
        db.query(JlptUserExamPlan)
        .options(joinedload(JlptUserExamPlan.schedule))
        .filter(JlptUserExamPlan.user_id == current_user.id, JlptUserExamPlan.level == level)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Chưa chọn kỳ thi mục tiêu cho level này")
    return {
        "id": plan.id, "level": plan.level, "location": plan.location,
        "schedule": _schedule_out(plan.schedule),
    }


@router.put("/exam-plan", response_model=ExamPlanOut)
def upsert_exam_plan(
    payload: ExamPlanIn,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    schedule = db.query(JlptExamSchedule).filter(JlptExamSchedule.id == payload.schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Không tìm thấy kỳ thi này")

    plan = (
        db.query(JlptUserExamPlan)
        .filter(JlptUserExamPlan.user_id == current_user.id, JlptUserExamPlan.level == payload.level)
        .first()
    )
    if not plan:
        plan = JlptUserExamPlan(user_id=current_user.id, level=payload.level)
        db.add(plan)
    plan.schedule_id = payload.schedule_id
    plan.location = payload.location
    db.commit()
    db.refresh(plan)

    return {
        "id": plan.id, "level": plan.level, "location": plan.location,
        "schedule": _schedule_out(schedule),
    }


def _best_predicted_breakdown(db: Session, user_id: int, level: str) -> Optional[dict]:
    """The scaled-score breakdown of the user's best completed attempt on
    this level (by total scaled score), used as "how you'd currently score.\""""
    attempts = (
        db.query(JlptTestAttempt)
        .join(JlptExam)
        .filter(
            JlptTestAttempt.user_id == user_id, JlptTestAttempt.status == 'completed',
            JlptExam.level == level,
        )
        .options(joinedload(JlptTestAttempt.answers))
        .all()
    )
    if not attempts:
        return None

    best = None
    for attempt in attempts:
        breakdown = build_score_breakdown(level, raw_section_counts(db, attempt.answers))
        if best is None or breakdown["total"] > best["total"]:
            best = breakdown
    return best


def _weak_mondai(db: Session, user_id: int, level: str) -> List[dict]:
    since = datetime.utcnow() - timedelta(days=WEAK_MONDAI_WINDOW_DAYS)
    rows = (
        db.query(
            JlptSection.section_type, JlptSection.name,
            JlptMondaiTemplate.mondai_no, JlptMondaiTemplate.name,
            JlptTestAttemptAnswer.is_correct,
        )
        .select_from(JlptTestAttemptAnswer)
        .join(JlptTestAttempt, JlptTestAttemptAnswer.attempt_id == JlptTestAttempt.id)
        .join(JlptExam, JlptTestAttempt.exam_id == JlptExam.id)
        .join(JlptQuestion, JlptTestAttemptAnswer.question_id == JlptQuestion.id)
        .join(JlptMondaiTemplate, JlptQuestion.mondai_template_id == JlptMondaiTemplate.id)
        .join(JlptSection, JlptMondaiTemplate.section_id == JlptSection.id)
        .filter(
            JlptTestAttempt.user_id == user_id, JlptTestAttempt.status == 'completed',
            JlptExam.level == level, JlptTestAttempt.submitted_at >= since,
        )
        .all()
    )

    stats: dict = {}
    for section_type, section_name, mondai_no, mondai_name, is_correct in rows:
        key = (section_type, section_name, mondai_no, mondai_name)
        entry = stats.setdefault(key, {"wrong": 0, "total": 0})
        entry["total"] += 1
        if not is_correct:
            entry["wrong"] += 1

    weak = [
        {
            "section_type": key[0], "section_name": key[1], "mondai_no": key[2], "mondai_name": key[3],
            "wrong_count": entry["wrong"], "total_count": entry["total"],
            "percent_correct": round((entry["total"] - entry["wrong"]) / entry["total"] * 100, 1),
        }
        for key, entry in stats.items()
        if entry["total"] >= WEAK_MONDAI_MIN_ATTEMPTS
    ]
    weak.sort(key=lambda w: w["percent_correct"])
    return weak[:WEAK_MONDAI_LIMIT]


def _study_pace_message(predicted: Optional[dict], pass_total: int, weeks_left: int) -> str:
    current_total = predicted["total"] if predicted else 0
    gap = max(0, pass_total - current_total)

    if gap == 0:
        base = "Bạn đang trên đà đạt mốc đậu — hãy duy trì tốc độ luyện đề hiện tại."
    else:
        exams_per_week = max(1, math.ceil(gap / ASSUMED_POINTS_PER_EXAM / max(1, weeks_left)))
        base = f"Với tốc độ hiện tại bạn cần khoảng {exams_per_week} đề/tuần để đạt {pass_total} điểm."

    if predicted and predicted["sections"]:
        weakest = min(predicted["sections"], key=lambda s: s["score"] - s["floor"])
        if not weakest["above_floor"]:
            base += f" Ưu tiên {weakest['name']} — phần đang dưới điểm sàn."
        elif weakest["score"] - weakest["floor"] <= 3:
            base += f" Ưu tiên {weakest['name']} — phần đang sát điểm sàn."

    return base


@router.get("/dashboard", response_model=DashboardOut)
def get_dashboard(
    level: JlptLevel,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    predicted = _best_predicted_breakdown(db, current_user.id, level)
    weak_mondai = _weak_mondai(db, current_user.id, level)

    plan = (
        db.query(JlptUserExamPlan)
        .options(joinedload(JlptUserExamPlan.schedule))
        .filter(JlptUserExamPlan.user_id == current_user.id, JlptUserExamPlan.level == level)
        .first()
    )
    upcoming_exam = None
    if plan:
        days_left = (plan.schedule.exam_date - date.today()).days
        weeks_left = max(1, days_left // 7)
        pass_total = JLPT_PASS_TOTALS.get(level, 90)
        upcoming_exam = {
            "schedule": _schedule_out(plan.schedule),
            "location": plan.location,
            "days_left": max(0, days_left),
            "study_pace_message": _study_pace_message(predicted, pass_total, weeks_left),
        }

    return {"predicted": predicted, "weak_mondai": weak_mondai, "upcoming_exam": upcoming_exam}
