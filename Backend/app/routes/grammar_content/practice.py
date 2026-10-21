"""Learner-facing grammar practice: pull a batch of due auto-graded
exercises (cloze / mcq, generated once at publish time — see
app/services/grammar_exercise_ai.py and this file's publish hook in
review.py) and submit answers, which drives the same SM-2-lite schedule
vocabulary flashcards use (see app/routes/vocabulary/learning.py's
_apply_rating, copied here verbatim). Unlike vocabulary flashcards, grammar
practice has no manual again/hard/good/easy buttons — the rating is derived
automatically from correctness: correct -> 'good', incorrect -> 'again'.
A correct MCQ (recognition) and a correct cloze (recall) are graded with the
same 'good' rating for simplicity; recall is arguably "harder" than
recognition, but the difference is not judged large enough to warrant a
5th two-tier rating scheme for a first version of this feature.
"""
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.dependencies import UserResponse, get_current_user
from app.models.database import get_db
from app.models.grammar_content import GrammarPoint, GrammarSet
from app.models.grammar_exercise import GrammarExercise, GrammarPointProgress
from app.schemas.grammar_practice import GrammarExerciseOut, SubmitAnswerRequest, SubmitAnswerResponse

router = APIRouter(prefix="/practice", tags=["grammar-practice"])

# A word graded 'good' with a resulting gap this long or more counts as
# genuinely learned rather than still being actively drilled — same
# threshold vocabulary/learning.py uses.
LEARNED_INTERVAL_THRESHOLD_DAYS = 21


def _get_or_create_progress(db: Session, user_id: int, grammar_point_id: int) -> GrammarPointProgress:
    progress = db.query(GrammarPointProgress).filter(
        GrammarPointProgress.user_id == user_id, GrammarPointProgress.grammar_point_id == grammar_point_id,
    ).first()
    if not progress:
        # Column(default=...) values are only applied by SQLAlchemy at flush
        # time, not on construction — _apply_rating runs before the flush, so
        # it needs these set explicitly rather than reading them as None.
        progress = GrammarPointProgress(
            user_id=user_id, grammar_point_id=grammar_point_id, status='new',
            ease_factor=2.5, interval_days=0, review_count=0,
        )
        db.add(progress)
    return progress


def _apply_rating(progress: GrammarPointProgress, rating: str) -> None:
    """SM-2-lite, copied verbatim from vocabulary/learning.py's _apply_rating
    (see that function's docstring) — grammar practice only ever calls this
    with 'good' (correct answer) or 'again' (incorrect answer), but the
    'hard'/'easy' branches are kept so this stays a faithful mirror rather
    than a subtly-diverging fork."""
    now = datetime.utcnow()
    if rating == 'again':
        progress.ease_factor = max(1.3, progress.ease_factor - 0.2)
        progress.interval_days = 0
        progress.due_at = now + timedelta(minutes=10)
        progress.status = 'reviewing'
    elif rating == 'hard':
        progress.ease_factor = max(1.3, progress.ease_factor - 0.15)
        progress.interval_days = max(1, round(progress.interval_days * 1.2)) if progress.interval_days > 0 else 1
        progress.due_at = now + timedelta(days=progress.interval_days)
        progress.status = 'reviewing'
    elif rating == 'good':
        progress.interval_days = round(progress.interval_days * progress.ease_factor) if progress.interval_days > 0 else 4
        progress.due_at = now + timedelta(days=progress.interval_days)
        progress.status = 'learned' if progress.interval_days >= LEARNED_INTERVAL_THRESHOLD_DAYS else 'reviewing'
    else:  # 'easy'
        progress.ease_factor = min(3.0, progress.ease_factor + 0.15)
        base = progress.interval_days if progress.interval_days > 0 else 7
        progress.interval_days = round(base * progress.ease_factor * 1.3)
        progress.due_at = now + timedelta(days=progress.interval_days)
        progress.status = 'learned' if progress.interval_days >= LEARNED_INTERVAL_THRESHOLD_DAYS else 'reviewing'
    progress.review_count += 1
    progress.last_reviewed_at = now


def _pick_exercise(point_id: int, exercises_by_point: dict) -> Optional[GrammarExercise]:
    """A point can have both a cloze and an mcq exercise; practice serves
    one at a time. Deterministic alternation by point id (even -> cloze
    preferred, odd -> mcq preferred) spreads exercise types roughly evenly
    across a batch and keeps repeated calls for the same point consistent,
    rather than a random pick that would jitter between requests for no
    benefit. Falls back to whichever type the point actually has."""
    options = exercises_by_point.get(point_id) or []
    if not options:
        return None
    preferred_type = 'cloze' if point_id % 2 == 0 else 'mcq'
    preferred = next((e for e in options if e.type == preferred_type), None)
    return preferred or options[0]


def _exercise_out(exercise: GrammarExercise, pattern: str) -> GrammarExerciseOut:
    return GrammarExerciseOut(
        id=exercise.id, grammar_point_id=exercise.grammar_point_id, grammar_pattern=pattern,
        type=exercise.type, prompt=exercise.prompt, choices=exercise.choices,
    )


@router.get("/due", response_model=List[GrammarExerciseOut])
def get_due_exercises(
    limit: int = 20,
    set_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    now = datetime.utcnow()
    limit = max(1, min(limit, 100))

    query = (
        db.query(GrammarPoint, GrammarPointProgress)
        .join(GrammarSet, GrammarSet.id == GrammarPoint.set_id)
        .outerjoin(
            GrammarPointProgress,
            and_(
                GrammarPointProgress.grammar_point_id == GrammarPoint.id,
                GrammarPointProgress.user_id == current_user.id,
            ),
        )
        .filter(GrammarSet.status == 'published', GrammarSet.is_locked.is_(False))
        .filter(or_(GrammarPointProgress.id.is_(None), GrammarPointProgress.due_at <= now))
    )
    if set_id:
        query = query.filter(GrammarPoint.set_id == set_id)

    # Over-fetch: some due points may not have any generated exercise yet
    # (best-effort generation at publish time, see review.py), so pulling
    # exactly `limit` rows could under-fill the batch after filtering those
    # out below.
    rows = query.order_by(GrammarPointProgress.due_at.asc().nullsfirst()).limit(limit * 3).all()
    if not rows:
        return []

    point_ids = [point.id for point, _ in rows]
    exercise_rows = db.query(GrammarExercise).filter(GrammarExercise.grammar_point_id.in_(point_ids)).all()
    exercises_by_point: dict = {}
    for ex in exercise_rows:
        exercises_by_point.setdefault(ex.grammar_point_id, []).append(ex)

    results = []
    for point, _progress in rows:
        exercise = _pick_exercise(point.id, exercises_by_point)
        if not exercise:
            continue
        results.append(_exercise_out(exercise, point.pattern))
        if len(results) >= limit:
            break
    return results


@router.post("/exercises/{exercise_id}/submit", response_model=SubmitAnswerResponse)
def submit_answer(
    exercise_id: int, payload: SubmitAnswerRequest,
    db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    exercise = db.query(GrammarExercise).filter(GrammarExercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài tập")

    is_correct = payload.answer.strip().casefold() == exercise.correct_answer.strip().casefold()
    rating = 'good' if is_correct else 'again'

    progress = _get_or_create_progress(db, current_user.id, exercise.grammar_point_id)
    _apply_rating(progress, rating)
    db.commit()
    db.refresh(progress)

    return SubmitAnswerResponse(
        correct=is_correct, correct_answer=exercise.correct_answer,
        grammar_point_id=exercise.grammar_point_id, status=progress.status, due_at=progress.due_at,
    )
