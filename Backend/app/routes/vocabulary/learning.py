"""User-facing vocabulary learning: browse published sets with personal
progress, pull a flashcard batch (by set, cross-set due-today, or bookmarked),
grade a review (drives the SM-2-lite schedule + new/reviewing/learned status),
bookmark words into a personal deck, and generate an AI mini-story from a
batch of words. Separate from review.py (admin curation of draft sets).
"""
import json
import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.dependencies import UserResponse, get_current_user
from app.models.database import get_db
from app.models.notification import Notification
from app.models.profile import UserInformation
from app.models.user import User
from app.models.vocabulary import VocabularyItem, VocabularyItemProgress, VocabularyReviewLog, VocabularySet
from app.schemas.jlpt import JlptLevel
from app.schemas.vocabulary import (
    AchievementOut, BookmarkToggleResponse, CrossSetBatchRequest, HeatmapDayOut, MiniStoryRequest, MiniStoryResponse,
    ReviewSubmitRequest, ReviewSubmitResponse, StudyBatchRequest, StudyOverviewOut,
    UpdateDailyGoalRequest, VocabularyLearningItemOut, VocabularySetLearningDetailOut, VocabularySetProgressOut,
)
from app.services.audit_log import has_logged_today, log_event
from app.services.chat_ai import call_openrouter, require_api_key
from app.services.xp_leveling import level_info as _level_info, xp_threshold as _xp_threshold
from app.utils.rate_limit import rate_limit

router = APIRouter(prefix="/learn", tags=["vocabulary-learning"])

DAILY_GOAL_WORDS = 20
MIN_DAILY_GOAL = 1
MAX_DAILY_GOAL = 500
# A word graded 'good'/'easy' with a resulting gap this long or more counts as
# genuinely learned rather than still being actively drilled.
LEARNED_INTERVAL_THRESHOLD_DAYS = 21
# Rendered as a GitHub-style grid: 12 columns (weeks) x 7 rows (days).
HEATMAP_DAYS = 84
# How many distinct study-days back to look for the streak. Bounded (rather
# than a full table scan) but generous enough that no realistic streak badge
# threshold (see ACHIEVEMENT_DEFS) can ever be under-counted.
STREAK_LOOKBACK_DAYS = 400

RATING_XP = {'again': 1, 'hard': 5, 'good': 10, 'easy': 15}
LEARNED_BONUS_XP = 20  # awarded once, the review that first pushes a word into 'learned'
MAX_MINI_STORY_WORDS = 200  # same ceiling as a study batch (see get_study_batch's count cap)

# (code, name, description, metric, target) — metric keys into the dict built
# in get_achievements from streak/learned-word-count/level.
ACHIEVEMENT_DEFS = [
    ('streak_7', 'Kiên trì 7 ngày', 'Duy trì streak học liên tục 7 ngày', 'streak', 7),
    ('streak_30', 'Bền bỉ 30 ngày', 'Duy trì streak học liên tục 30 ngày', 'streak', 30),
    ('streak_100', 'Huyền thoại 100 ngày', 'Duy trì streak học liên tục 100 ngày', 'streak', 100),
    ('words_50', '50 từ đã thuộc', 'Học thuộc 50 từ vựng', 'learned', 50),
    ('words_200', '200 từ đã thuộc', 'Học thuộc 200 từ vựng', 'learned', 200),
    ('words_500', '500 từ đã thuộc', 'Học thuộc 500 từ vựng', 'learned', 500),
    ('level_5', 'Đạt cấp 5', 'Tích lũy kinh nghiệm lên cấp độ 5', 'level', 5),
    ('level_10', 'Đạt cấp 10', 'Tích lũy kinh nghiệm lên cấp độ 10', 'level', 10),
]


def _heatmap_start(today):
    """Earliest date of the heatmap window, pulled back to the most recent
    Sunday on/before (today - HEATMAP_DAYS + 1) so the grid always renders in
    full weeks instead of a ragged partial first column."""
    start = today - timedelta(days=HEATMAP_DAYS - 1)
    return start - timedelta(days=(start.weekday() + 1) % 7)


def _current_streak(db: Session, user_id: int, today) -> int:
    rows = (
        db.query(func.date(VocabularyReviewLog.reviewed_at).label('day'))
        .filter(
            VocabularyReviewLog.user_id == user_id,
            VocabularyReviewLog.reviewed_at >= datetime.combine(today - timedelta(days=STREAK_LOOKBACK_DAYS), datetime.min.time()),
        )
        .distinct()
        .all()
    )
    study_dates = {row.day for row in rows}

    streak = 0
    if today in study_dates:
        cursor = today
    elif (today - timedelta(days=1)) in study_dates:
        cursor = today - timedelta(days=1)
    else:
        return 0
    while cursor in study_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _check_and_notify_achievements(db: Session, user_id: int, level: int) -> None:
    """Creates a Notification for any achievement that just became earned.
    `related_code` is the idempotency key — an achievement already notified
    once is never notified again, so this is safe to call as often as
    needed (see its two call sites in submit_review)."""
    today = datetime.utcnow().date()
    streak = _current_streak(db, user_id, today)
    learned_count = db.query(func.count(VocabularyItemProgress.id)).filter(
        VocabularyItemProgress.user_id == user_id, VocabularyItemProgress.status == 'learned',
    ).scalar() or 0
    metrics = {'streak': streak, 'learned': learned_count, 'level': level}

    for code, name, description, metric, target in ACHIEVEMENT_DEFS:
        if metrics[metric] < target:
            continue
        already_notified = db.query(Notification.id).filter(
            Notification.user_id == user_id, Notification.type == 'achievement', Notification.related_code == code,
        ).first()
        if already_notified:
            continue
        db.add(Notification(
            user_id=user_id, type='achievement', title=f'Đạt huy hiệu: {name}',
            message=description, link='/vocabulary', related_code=code,
        ))
        log_event(
            db, subject_user_id=user_id, action='vocab.achievement_unlocked',
            description=f'Đạt huy hiệu: {name}', actor_user_id=user_id, actor_role='user',
            extra_data={'code': code},
        )


def _studied_today_count(db: Session, user_id: int, today) -> int:
    day_start = datetime.combine(today, datetime.min.time())
    return db.query(func.count(func.distinct(VocabularyReviewLog.item_id))).filter(
        VocabularyReviewLog.user_id == user_id, VocabularyReviewLog.reviewed_at >= day_start,
    ).scalar() or 0


def _published_set_query(db: Session):
    return db.query(VocabularySet).filter(
        VocabularySet.status == 'published', VocabularySet.is_locked.is_(False), VocabularySet.is_private.is_(False),
    )


def _visible_set_filters(user_id: int) -> tuple:
    """SQL conditions for "a set this user may study": published and unlocked,
    and either public or the user's own private set. Used wherever a word is
    reached by its id or through a progress row rather than through
    _published_set_query — a private set is created already 'published' (see
    models/vocabulary.py), so status alone doesn't keep it private."""
    return (
        VocabularySet.status == 'published',
        VocabularySet.is_locked.is_(False),
        or_(VocabularySet.is_private.is_(False), VocabularySet.created_by == user_id),
    )


def _get_visible_item(db: Session, user_id: int, item_id: int) -> VocabularyItem:
    """404s (rather than 403) for someone else's private word so its id isn't
    confirmed to exist."""
    item = (
        db.query(VocabularyItem)
        .join(VocabularySet, VocabularySet.id == VocabularyItem.set_id)
        .filter(VocabularyItem.id == item_id, *_visible_set_filters(user_id))
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ vựng")
    return item


def _learning_item_out(item: VocabularyItem, progress: Optional[VocabularyItemProgress]) -> VocabularyLearningItemOut:
    return VocabularyLearningItemOut(
        id=item.id, order_no=item.order_no, word=item.word, reading=item.reading, han_viet=item.han_viet,
        meaning_vi=item.meaning_vi, word_type=item.word_type,
        example_sentence_ja=item.example_sentence_ja, example_sentence_vi=item.example_sentence_vi,
        status=progress.status if progress else 'new',
        is_bookmarked=progress.is_bookmarked if progress else False,
        due_at=progress.due_at if progress else None,
    )


def _progress_map(db: Session, user_id: int, item_ids: List[int]) -> dict:
    if not item_ids:
        return {}
    rows = db.query(VocabularyItemProgress).filter(
        VocabularyItemProgress.user_id == user_id, VocabularyItemProgress.item_id.in_(item_ids),
    )
    return {p.item_id: p for p in rows}


def _touch_activity(db: Session, user_id: int, now: datetime) -> None:
    """Updates the profile's last_activity_at + streak_days snapshot after a
    review — called with the just-logged review already added to the session
    so _current_streak sees today's activity. Kept separate from vocab_xp
    (still the source of truth for level) since these fields exist for the
    admin user-management page, not the learning flow itself."""
    info = db.query(UserInformation).filter(UserInformation.user_id == user_id).first()
    if not info:
        info = UserInformation(user_id=user_id)
        db.add(info)
    info.last_activity_at = now
    info.streak_days = _current_streak(db, user_id, now.date())


def _get_or_create_progress(db: Session, user_id: int, item_id: int) -> VocabularyItemProgress:
    progress = db.query(VocabularyItemProgress).filter(
        VocabularyItemProgress.user_id == user_id, VocabularyItemProgress.item_id == item_id,
    ).first()
    if not progress:
        # Column(default=...) values are only applied by SQLAlchemy at flush
        # time, not on construction — _apply_rating runs before the flush, so
        # it needs these set explicitly rather than reading them as None.
        progress = VocabularyItemProgress(
            user_id=user_id, item_id=item_id, status='new', is_bookmarked=False,
            ease_factor=2.5, interval_days=0, review_count=0,
        )
        db.add(progress)
    return progress


def _apply_rating(progress: VocabularyItemProgress, rating: str) -> None:
    """SM-2-lite: adjusts the ease factor and picks the next interval from
    the rating, then re-derives status from the resulting interval so
    'đã thuộc' reflects an actually-long gap rather than a manual toggle."""
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


def _set_progress_out(vocab_set: VocabularySet, progress_by_item: dict) -> VocabularySetProgressOut:
    learned = reviewing = 0
    for item in vocab_set.items:
        p = progress_by_item.get(item.id)
        if p and p.status == 'learned':
            learned += 1
        elif p and p.status == 'reviewing':
            reviewing += 1
    return VocabularySetProgressOut(
        id=vocab_set.id, level=vocab_set.level, set_name=vocab_set.set_name, description=vocab_set.description,
        curriculum_id=vocab_set.curriculum_id,
        curriculum_name=vocab_set.curriculum.name if vocab_set.curriculum else None,
        category_id=vocab_set.category_id,
        category_name=vocab_set.category.name if vocab_set.category else None,
        item_count=vocab_set.item_count, learned_count=learned, reviewing_count=reviewing,
        new_count=max(0, len(vocab_set.items) - learned - reviewing),
    )


@router.get("/overview", response_model=StudyOverviewOut)
def get_study_overview(db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    user = db.query(User).filter(User.id == current_user.id).first()
    daily_goal = user.daily_vocab_goal if user and user.daily_vocab_goal else DAILY_GOAL_WORDS
    now = datetime.utcnow()
    # 'learned' words aren't excluded forever — once their long SM-2 interval
    # (due_at) actually elapses they count as due too, so mastery gets
    # periodically re-confirmed instead of never being checked again.
    due_today_count = db.query(func.count(VocabularyItemProgress.id)).filter(
        VocabularyItemProgress.user_id == current_user.id,
        VocabularyItemProgress.status.in_(('reviewing', 'learned')),
        VocabularyItemProgress.due_at <= now,
    ).scalar() or 0

    today = now.date()
    heatmap_start = _heatmap_start(today)
    logs = db.query(VocabularyReviewLog.item_id, VocabularyReviewLog.reviewed_at).filter(
        VocabularyReviewLog.user_id == current_user.id,
        VocabularyReviewLog.reviewed_at >= datetime.combine(heatmap_start, datetime.min.time()),
    ).all()

    items_by_date = defaultdict(set)
    for row in logs:
        items_by_date[row.reviewed_at.date()].add(row.item_id)
    studied_today_count = len(items_by_date.get(today, set()))

    streak_days = _current_streak(db, current_user.id, today)

    heatmap = []
    cursor = heatmap_start
    while cursor <= today:
        heatmap.append(HeatmapDayOut(date=cursor.isoformat(), count=len(items_by_date.get(cursor, set()))))
        cursor += timedelta(days=1)

    level, level_floor, level_ceil = _level_info(user.vocab_xp if user else 0)

    return StudyOverviewOut(
        streak_days=streak_days, due_today_count=due_today_count,
        studied_today_count=studied_today_count, daily_goal=daily_goal, heatmap=heatmap,
        xp=user.vocab_xp if user else 0, level=level, level_xp_floor=level_floor, level_xp_ceil=level_ceil,
    )


@router.patch("/settings/daily-goal", response_model=StudyOverviewOut)
def update_daily_goal(
    payload: UpdateDailyGoalRequest, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    if not (MIN_DAILY_GOAL <= payload.daily_goal <= MAX_DAILY_GOAL):
        raise HTTPException(status_code=400, detail=f"Mục tiêu phải từ {MIN_DAILY_GOAL} đến {MAX_DAILY_GOAL} từ")

    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    user.daily_vocab_goal = payload.daily_goal
    db.commit()

    return get_study_overview(db=db, current_user=current_user)


@router.get("/achievements", response_model=List[AchievementOut])
def get_achievements(db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    user = db.query(User).filter(User.id == current_user.id).first()
    today = datetime.utcnow().date()
    streak = _current_streak(db, current_user.id, today)
    learned_count = db.query(func.count(VocabularyItemProgress.id)).filter(
        VocabularyItemProgress.user_id == current_user.id, VocabularyItemProgress.status == 'learned',
    ).scalar() or 0
    level, _, _ = _level_info(user.vocab_xp if user else 0)

    metrics = {'streak': streak, 'learned': learned_count, 'level': level}
    return [
        AchievementOut(
            code=code, name=name, description=description,
            earned=metrics[metric] >= target, progress_current=min(metrics[metric], target), progress_target=target,
        )
        for code, name, description, metric, target in ACHIEVEMENT_DEFS
    ]


@router.get("/sets", response_model=List[VocabularySetProgressOut])
def list_library_sets(
    level: Optional[JlptLevel] = None,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    query = _published_set_query(db).options(
        selectinload(VocabularySet.items), selectinload(VocabularySet.curriculum), selectinload(VocabularySet.category),
    )
    if level:
        query = query.filter(VocabularySet.level == level)
    sets = query.order_by(VocabularySet.set_name).all()

    all_item_ids = [i.id for s in sets for i in s.items]
    progress_by_item = _progress_map(db, current_user.id, all_item_ids)
    return [_set_progress_out(s, progress_by_item) for s in sets]


@router.get("/sets/{set_id}", response_model=VocabularySetLearningDetailOut)
def get_set_for_learning(
    set_id: int, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    vocab_set = _published_set_query(db).options(
        selectinload(VocabularySet.items), selectinload(VocabularySet.curriculum), selectinload(VocabularySet.category),
    ).filter(VocabularySet.id == set_id).first()
    if not vocab_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ từ vựng")

    items = sorted(vocab_set.items, key=lambda i: i.order_no)
    progress_by_item = _progress_map(db, current_user.id, [i.id for i in items])
    return VocabularySetLearningDetailOut(
        **_set_progress_out(vocab_set, progress_by_item).model_dump(),
        items=[_learning_item_out(i, progress_by_item.get(i.id)) for i in items],
    )


@router.post("/sets/{set_id}/batch", response_model=List[VocabularyLearningItemOut])
def get_study_batch(
    set_id: int, payload: StudyBatchRequest,
    db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    vocab_set = _published_set_query(db).options(selectinload(VocabularySet.items)).filter(
        VocabularySet.id == set_id,
    ).first()
    if not vocab_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ từ vựng")

    count = max(1, min(payload.count, 200))
    items = sorted(vocab_set.items, key=lambda i: i.order_no)
    progress_by_item = _progress_map(db, current_user.id, [i.id for i in items])

    if payload.source == 'review':
        # Any word still 'reviewing' in this set counts here, regardless of
        # due_at or which mode it was last graded in — this mirrors the
        # reviewing_count hint shown next to this tab (_set_progress_out
        # doesn't filter by due date either), so a word due a few days from
        # now stays pickable instead of disappearing until its due date and
        # is available from every study mode, not just the one it was last
        # graded with.
        due = [i for i in items if (p := progress_by_item.get(i.id)) and p.status == 'reviewing']
        due.sort(key=lambda i: progress_by_item[i.id].due_at or datetime.max)
        selected = due[:count]
    else:
        # A progress row can exist for a word that's still 'new' (e.g. only
        # bookmarked so far, never graded) — check status, not row presence.
        selected = [
            i for i in items
            if (p := progress_by_item.get(i.id)) is None or p.status == 'new'
        ][:count]

    if not selected:
        raise HTTPException(status_code=404, detail="Không còn từ nào phù hợp để tạo bộ flashcard này")
    return [_learning_item_out(i, progress_by_item.get(i.id)) for i in selected]


@router.post("/due/batch", response_model=List[VocabularyLearningItemOut])
def get_due_batch(
    payload: CrossSetBatchRequest, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    now = datetime.utcnow()
    # Same relaxation as due_today_count above: a 'learned' word whose due_at
    # has passed is due for a retention check, not permanently retired from
    # review just because it once crossed the 'learned' threshold.
    rows = (
        db.query(VocabularyItemProgress, VocabularyItem)
        .join(VocabularyItem, VocabularyItem.id == VocabularyItemProgress.item_id)
        .join(VocabularySet, VocabularySet.id == VocabularyItem.set_id)
        .filter(
            VocabularyItemProgress.user_id == current_user.id,
            VocabularyItemProgress.status.in_(('reviewing', 'learned')),
            VocabularyItemProgress.due_at <= now,
            *_visible_set_filters(current_user.id),
        )
        .order_by(VocabularyItemProgress.due_at.asc())
        .limit(max(1, min(payload.count, 200)))
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Không có từ nào cần ôn lúc này")
    return [_learning_item_out(item, progress) for progress, item in rows]


@router.get("/bookmarked", response_model=List[VocabularyLearningItemOut])
def list_bookmarked(db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    rows = (
        db.query(VocabularyItemProgress, VocabularyItem)
        .join(VocabularyItem, VocabularyItem.id == VocabularyItemProgress.item_id)
        .join(VocabularySet, VocabularySet.id == VocabularyItem.set_id)
        .filter(
            VocabularyItemProgress.user_id == current_user.id,
            VocabularyItemProgress.is_bookmarked.is_(True),
            *_visible_set_filters(current_user.id),
        )
        .order_by(VocabularyItem.set_id, VocabularyItem.order_no)
        .all()
    )
    return [_learning_item_out(item, progress) for progress, item in rows]


@router.post("/bookmarked/batch", response_model=List[VocabularyLearningItemOut])
def get_bookmarked_batch(
    payload: CrossSetBatchRequest, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    rows = (
        db.query(VocabularyItemProgress, VocabularyItem)
        .join(VocabularyItem, VocabularyItem.id == VocabularyItemProgress.item_id)
        .join(VocabularySet, VocabularySet.id == VocabularyItem.set_id)
        .filter(
            VocabularyItemProgress.user_id == current_user.id,
            VocabularyItemProgress.is_bookmarked.is_(True),
            *_visible_set_filters(current_user.id),
        )
        .order_by(VocabularyItem.set_id, VocabularyItem.order_no)
        .limit(max(1, min(payload.count, 200)))
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Bạn chưa đánh dấu từ nào")
    return [_learning_item_out(item, progress) for progress, item in rows]


@router.post("/items/{item_id}/review", response_model=ReviewSubmitResponse)
def submit_review(
    item_id: int, payload: ReviewSubmitRequest,
    db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    _get_visible_item(db, current_user.id, item_id)

    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    progress = _get_or_create_progress(db, current_user.id, item_id)
    was_learned = progress.status == 'learned'
    old_level, _, _ = _level_info(user.vocab_xp)

    _apply_rating(progress, payload.rating)
    now = datetime.utcnow()
    db.add(VocabularyReviewLog(user_id=current_user.id, item_id=item_id, rating=payload.rating, reviewed_at=now))
    db.flush()  # so _current_streak (below, and inside _check_and_notify_achievements) sees today's review
    _touch_activity(db, current_user.id, now)

    just_learned = progress.status == 'learned' and not was_learned
    xp_gained = RATING_XP[payload.rating]
    if just_learned:
        xp_gained += LEARNED_BONUS_XP
    user.vocab_xp += xp_gained
    new_level, _, _ = _level_info(user.vocab_xp)
    leveled_up = new_level > old_level

    if leveled_up:
        db.add(Notification(
            user_id=current_user.id, type='level_up', title=f'Bạn đã lên cấp {new_level}!',
            message='Tiếp tục học từ vựng mỗi ngày để lên cấp cao hơn.', link='/vocabulary',
        ))
    # Only worth the extra streak/learned-count queries when something that
    # feeds an achievement could plausibly have just crossed a threshold —
    # most reviews (a plain 'again'/'hard' grade) never do.
    if just_learned or leveled_up:
        _check_and_notify_achievements(db, current_user.id, new_level)

    today = now.date()
    daily_goal = user.daily_vocab_goal if user.daily_vocab_goal else DAILY_GOAL_WORDS
    if _studied_today_count(db, current_user.id, today) >= daily_goal and not has_logged_today(
        db, subject_user_id=current_user.id, action='vocab.daily_goal_met', today=today,
    ):
        log_event(
            db, subject_user_id=current_user.id, action='vocab.daily_goal_met',
            description=f'Hoàn thành mục tiêu {daily_goal} từ vựng hôm nay',
            actor_user_id=current_user.id, actor_role='user',
        )

    db.commit()
    db.refresh(progress)
    return ReviewSubmitResponse(
        item_id=item_id, status=progress.status, due_at=progress.due_at,
        xp_gained=xp_gained, leveled_up=leveled_up, new_level=new_level,
    )


@router.post("/items/{item_id}/bookmark", response_model=BookmarkToggleResponse)
def toggle_bookmark(
    item_id: int, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    _get_visible_item(db, current_user.id, item_id)

    progress = _get_or_create_progress(db, current_user.id, item_id)
    progress.is_bookmarked = not progress.is_bookmarked
    db.commit()
    db.refresh(progress)
    return BookmarkToggleResponse(item_id=item_id, is_bookmarked=progress.is_bookmarked)


def _parse_story_json(raw: str) -> dict:
    cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {}


@router.post(
    "/mini-story", response_model=MiniStoryResponse,
    dependencies=[Depends(rate_limit("mini-story", limit=10, window_seconds=60))],
)
def generate_mini_story(
    payload: MiniStoryRequest, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    if not payload.item_ids:
        raise HTTPException(status_code=400, detail="Cần chọn ít nhất 1 từ")
    if len(payload.item_ids) > MAX_MINI_STORY_WORDS:
        raise HTTPException(status_code=400, detail=f"Chỉ chọn tối đa {MAX_MINI_STORY_WORDS} từ cho một đoạn văn")

    items = (
        db.query(VocabularyItem)
        .join(VocabularySet, VocabularySet.id == VocabularyItem.set_id)
        .filter(VocabularyItem.id.in_(payload.item_ids), *_visible_set_filters(current_user.id))
        .all()
    )
    if not items:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ vựng")

    api_key = require_api_key()
    word_list = ", ".join(f"{i.word}（{i.meaning_vi}）" for i in items)
    messages = [
        {
            "role": "system",
            "content": (
                "Bạn là trợ lý dạy tiếng Nhật. Viết một đoạn văn ngắn (4-6 câu) bằng tiếng Nhật, "
                "văn phong đơn giản phù hợp người học, dùng TẤT CẢ các từ vựng được cho (mỗi từ ít nhất 1 lần). "
                "Sau đó dịch đoạn văn đó sang tiếng Việt. "
                'Chỉ trả lời đúng định dạng JSON: {"story_ja": "...", "story_vi": "..."}, không thêm chữ nào khác.'
            ),
        },
        {"role": "user", "content": f"Các từ vựng cần dùng: {word_list}"},
    ]
    try:
        raw = call_openrouter(messages, api_key, temperature=0.8)
    except Exception:
        raise HTTPException(status_code=502, detail="Không thể tạo đoạn văn lúc này, vui lòng thử lại")

    data = _parse_story_json(raw)
    story_ja = (data.get("story_ja") or "").strip()
    story_vi = (data.get("story_vi") or "").strip()
    if not story_ja:
        raise HTTPException(status_code=502, detail="Không thể tạo đoạn văn lúc này, vui lòng thử lại")
    return MiniStoryResponse(story_ja=story_ja, story_vi=story_vi)
