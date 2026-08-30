"""User-facing vocabulary learning: browse published sets with personal
progress, pull a flashcard batch (by set, cross-set due-today, or bookmarked),
grade a review (drives the SM-2-lite schedule + new/reviewing/learned status),
bookmark words into a personal deck, and generate an AI mini-story from a
batch of words. Separate from review.py (admin curation of draft sets).
"""
import json
import re
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.dependencies import UserResponse, get_current_user
from app.models.database import get_db
from app.models.user import User
from app.models.vocabulary import VocabularyItem, VocabularyItemProgress, VocabularyReviewLog, VocabularySet
from app.schemas.jlpt import JlptLevel
from app.schemas.vocabulary import (
    BookmarkToggleResponse, CrossSetBatchRequest, MiniStoryRequest, MiniStoryResponse,
    ReviewSubmitRequest, ReviewSubmitResponse, StudyBatchRequest, StudyOverviewOut,
    UpdateDailyGoalRequest, VocabularyLearningItemOut, VocabularySetLearningDetailOut, VocabularySetProgressOut,
)
from app.services.chat_ai import call_openrouter, require_api_key

router = APIRouter(prefix="/learn", tags=["vocabulary-learning"])

DAILY_GOAL_WORDS = 20
MIN_DAILY_GOAL = 1
MAX_DAILY_GOAL = 500
# A word graded 'good'/'easy' with a resulting gap this long or more counts as
# genuinely learned rather than still being actively drilled.
LEARNED_INTERVAL_THRESHOLD_DAYS = 21


def _published_set_query(db: Session):
    return db.query(VocabularySet).filter(
        VocabularySet.status == 'published', VocabularySet.is_locked.is_(False),
    )


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
    due_today_count = db.query(func.count(VocabularyItemProgress.id)).filter(
        VocabularyItemProgress.user_id == current_user.id,
        VocabularyItemProgress.status == 'reviewing',
        VocabularyItemProgress.due_at <= now,
    ).scalar() or 0

    since = now - timedelta(days=60)
    logs = db.query(VocabularyReviewLog.item_id, VocabularyReviewLog.reviewed_at).filter(
        VocabularyReviewLog.user_id == current_user.id, VocabularyReviewLog.reviewed_at >= since,
    ).all()

    today = now.date()
    study_dates = {row.reviewed_at.date() for row in logs}
    studied_today_count = len({row.item_id for row in logs if row.reviewed_at.date() == today})

    streak_days = 0
    cursor = None
    if today in study_dates:
        cursor = today
    elif (today - timedelta(days=1)) in study_dates:
        cursor = today - timedelta(days=1)
    while cursor is not None and cursor in study_dates:
        streak_days += 1
        cursor -= timedelta(days=1)

    return StudyOverviewOut(
        streak_days=streak_days, due_today_count=due_today_count,
        studied_today_count=studied_today_count, daily_goal=daily_goal,
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
    rows = (
        db.query(VocabularyItemProgress, VocabularyItem)
        .join(VocabularyItem, VocabularyItem.id == VocabularyItemProgress.item_id)
        .join(VocabularySet, VocabularySet.id == VocabularyItem.set_id)
        .filter(
            VocabularyItemProgress.user_id == current_user.id,
            VocabularyItemProgress.status == 'reviewing',
            VocabularyItemProgress.due_at <= now,
            VocabularySet.status == 'published', VocabularySet.is_locked.is_(False),
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
            VocabularySet.status == 'published', VocabularySet.is_locked.is_(False),
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
            VocabularySet.status == 'published', VocabularySet.is_locked.is_(False),
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
    item = db.query(VocabularyItem).filter(VocabularyItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ vựng")

    progress = _get_or_create_progress(db, current_user.id, item_id)
    _apply_rating(progress, payload.rating)
    db.add(VocabularyReviewLog(
        user_id=current_user.id, item_id=item_id, rating=payload.rating, reviewed_at=datetime.utcnow(),
    ))
    db.commit()
    db.refresh(progress)
    return ReviewSubmitResponse(item_id=item_id, status=progress.status, due_at=progress.due_at)


@router.post("/items/{item_id}/bookmark", response_model=BookmarkToggleResponse)
def toggle_bookmark(
    item_id: int, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    item = db.query(VocabularyItem).filter(VocabularyItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ vựng")

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


@router.post("/mini-story", response_model=MiniStoryResponse)
def generate_mini_story(
    payload: MiniStoryRequest, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    if not payload.item_ids:
        raise HTTPException(status_code=400, detail="Cần chọn ít nhất 1 từ")

    items = db.query(VocabularyItem).filter(VocabularyItem.id.in_(payload.item_ids)).all()
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
