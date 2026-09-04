"""Admin management of user accounts: browse/search all users, inspect one
user's full profile + learning stats, create/edit accounts, reset passwords,
and lock/unlock an account. Separate from routes/user.py (a user managing
their own profile)."""
import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.dependencies import UserResponse, require_admin
from app.models.chat import Conversation, Message
from app.models.database import get_db
from app.models.dictionary import SearchHistory
from app.models.grammar import GrammarCorrection
from app.models.jlpt import JlptTestAttempt
from app.models.profile import UserInformation
from app.models.transcription import TranscriptionSession
from app.models.user import Role, User
from app.models.vocabulary import VocabularyItemProgress, VocabularyReviewLog
from app.schemas.user_admin import (
    AdminPasswordResetResponse, AdminUserConversationStats, AdminUserCreateRequest, AdminUserDetail,
    AdminUserJlptStats, AdminUserLearningStats, AdminUserListeningDictionaryStats, AdminUserListPage,
    AdminUserLockRequest, AdminUserSummary, AdminUserUpdateRequest, AdminUserVocabularyStats,
)
from app.services.xp_leveling import level_info
from app.utils.auth import hash_password

router = APIRouter(prefix="/admin/users", tags=["admin-users"])

PAGE_SIZE = 20
PROFILE_FIELDS = {
    "first_name", "last_name", "phone", "country", "city", "date_of_birth", "gender",
    "current_jlpt_level", "target_jlpt_level",
}


def _summary(user: User) -> AdminUserSummary:
    info = user.information
    level, _, _ = level_info(user.vocab_xp)
    return AdminUserSummary(
        id=user.id, username=user.username, email=user.email,
        role=user.role.code if user.role else "user",
        is_active=user.is_active, locked_reason=user.locked_reason, locked_at=user.locked_at,
        last_login_at=user.last_login_at, created_at=user.created_at,
        first_name=info.first_name if info else None, last_name=info.last_name if info else None,
        avatar_url=info.avatar_url if info else None,
        current_jlpt_level=info.current_jlpt_level if info else None,
        vocab_xp=user.vocab_xp, level=level, streak_days=info.streak_days if info else 0,
    )


def _detail(user: User) -> AdminUserDetail:
    info = user.information
    _, level_floor, level_ceil = level_info(user.vocab_xp)
    return AdminUserDetail(
        **_summary(user).model_dump(),
        phone=info.phone if info else None,
        country=info.country if info else None,
        city=info.city if info else None,
        date_of_birth=info.date_of_birth if info else None,
        gender=info.gender if info else None,
        target_jlpt_level=info.target_jlpt_level if info else None,
        last_activity_at=info.last_activity_at if info else None,
        total_study_minutes=info.total_study_minutes if info else 0,
        level_xp_floor=level_floor, level_xp_ceil=level_ceil,
        daily_vocab_goal=user.daily_vocab_goal,
        profile_updated_at=info.updated_at if info else None,
    )


@router.post("", response_model=AdminUserDetail, status_code=201)
def create_user(
    payload: AdminUserCreateRequest, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email đã được sử dụng")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username đã được sử dụng")
    role = db.query(Role).filter(Role.code == payload.role).first()
    if not role:
        raise HTTPException(status_code=400, detail="Vai trò không hợp lệ")

    user = User(
        username=payload.username, email=payload.email,
        password_hash=hash_password(payload.password), is_active=True, role_id=role.id,
    )
    db.add(user)
    db.flush()  # assign user.id before the profile row references it

    if payload.first_name or payload.last_name:
        db.add(UserInformation(user_id=user.id, first_name=payload.first_name, last_name=payload.last_name))

    db.commit()
    db.refresh(user)
    return _detail(user)


@router.get("", response_model=AdminUserListPage)
def list_users(
    search: Optional[str] = None,
    role: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),  # 'active' | 'locked'
    jlpt_level: Optional[str] = None,  # 'N1'..'N5'
    page: int = 1,
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    page = max(1, page)
    query = db.query(User).options(joinedload(User.role), joinedload(User.information))

    if search:
        like = f"%{search.strip()}%"
        query = query.outerjoin(UserInformation, UserInformation.user_id == User.id).filter(
            or_(
                User.username.ilike(like), User.email.ilike(like),
                UserInformation.first_name.ilike(like), UserInformation.last_name.ilike(like),
            )
        )
    if role:
        query = query.filter(User.role.has(code=role))
    if status_filter == "locked":
        query = query.filter(User.is_active.is_(False))
    elif status_filter == "active":
        query = query.filter(User.is_active.is_(True))
    if jlpt_level:
        query = query.filter(User.information.has(current_jlpt_level=jlpt_level))

    total = query.count()
    users = (
        query.order_by(User.created_at.desc())
        .offset((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .all()
    )
    return AdminUserListPage(items=[_summary(u) for u in users], total=total, page=page, page_size=PAGE_SIZE)


@router.get("/{user_id}", response_model=AdminUserDetail)
def get_user(user_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    user = db.query(User).options(joinedload(User.role), joinedload(User.information)).filter(
        User.id == user_id,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    return _detail(user)


@router.patch("/{user_id}", response_model=AdminUserDetail)
def update_user(
    user_id: int, payload: AdminUserUpdateRequest,
    db: Session = Depends(get_db), admin: UserResponse = Depends(require_admin),
):
    user = db.query(User).options(joinedload(User.role), joinedload(User.information)).filter(
        User.id == user_id,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    data = payload.model_dump(exclude_unset=True)

    if "role" in data:
        if user_id == admin.id:
            raise HTTPException(status_code=400, detail="Không thể tự đổi vai trò của chính mình")
        role = db.query(Role).filter(Role.code == data["role"]).first()
        if not role:
            raise HTTPException(status_code=400, detail="Vai trò không hợp lệ")
        user.role_id = role.id

    if "daily_vocab_goal" in data:
        user.daily_vocab_goal = data["daily_vocab_goal"]

    profile_data = {k: v for k, v in data.items() if k in PROFILE_FIELDS}
    if profile_data:
        info = user.information
        if not info:
            info = UserInformation(user_id=user.id)
            db.add(info)
        for field, value in profile_data.items():
            setattr(info, field, value)

    db.commit()
    db.refresh(user)
    return _detail(user)


@router.post("/{user_id}/reset-password", response_model=AdminPasswordResetResponse)
def reset_password(user_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    temporary_password = secrets.token_urlsafe(9)
    user.password_hash = hash_password(temporary_password)
    db.commit()
    return AdminPasswordResetResponse(temporary_password=temporary_password)


@router.patch("/{user_id}/lock", response_model=AdminUserDetail)
def lock_user(
    user_id: int, payload: AdminUserLockRequest,
    db: Session = Depends(get_db), admin: UserResponse = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Không thể tự khóa tài khoản của chính mình")

    user = db.query(User).options(joinedload(User.role), joinedload(User.information)).filter(
        User.id == user_id,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    user.is_active = False
    user.locked_reason = payload.reason
    user.locked_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return _detail(user)


@router.get("/{user_id}/learning-stats", response_model=AdminUserLearningStats)
def get_user_learning_stats(user_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    if not db.query(User.id).filter(User.id == user_id).first():
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    vocab_by_status = dict(
        db.query(VocabularyItemProgress.status, func.count(VocabularyItemProgress.id))
        .filter(VocabularyItemProgress.user_id == user_id)
        .group_by(VocabularyItemProgress.status)
        .all()
    )
    total_reviews = db.query(func.count(VocabularyReviewLog.id)).filter(
        VocabularyReviewLog.user_id == user_id,
    ).scalar() or 0
    vocabulary = AdminUserVocabularyStats(
        learned=vocab_by_status.get("learned", 0),
        reviewing=vocab_by_status.get("reviewing", 0),
        new=vocab_by_status.get("new", 0),
        total_reviews=total_reviews,
    )

    attempts_total = db.query(func.count(JlptTestAttempt.id)).filter(
        JlptTestAttempt.user_id == user_id,
    ).scalar() or 0
    completed_row = (
        db.query(func.count(JlptTestAttempt.id), func.avg(JlptTestAttempt.score), func.max(JlptTestAttempt.score))
        .filter(JlptTestAttempt.user_id == user_id, JlptTestAttempt.status == "completed")
        .one()
    )
    last_attempt_at = db.query(func.max(JlptTestAttempt.submitted_at)).filter(
        JlptTestAttempt.user_id == user_id, JlptTestAttempt.status == "completed",
    ).scalar()
    jlpt = AdminUserJlptStats(
        attempts=attempts_total,
        completed=completed_row[0] or 0,
        average_score=round(completed_row[1], 1) if completed_row[1] is not None else None,
        best_score=completed_row[2],
        last_attempt_at=last_attempt_at,
    )

    conversations_count = db.query(func.count(Conversation.id)).filter(
        Conversation.user_id == user_id,
    ).scalar() or 0
    messages_sent = (
        db.query(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .filter(Conversation.user_id == user_id, Message.role == "user")
        .scalar() or 0
    )
    grammar_row = (
        db.query(func.count(GrammarCorrection.id), func.avg(GrammarCorrection.error_count))
        .filter(GrammarCorrection.user_id == user_id)
        .one()
    )
    conversation = AdminUserConversationStats(
        conversations=conversations_count,
        messages_sent=messages_sent,
        grammar_checks=grammar_row[0] or 0,
        average_errors=round(grammar_row[1], 1) if grammar_row[1] is not None else None,
    )

    transcription_total = db.query(func.count(TranscriptionSession.id)).filter(
        TranscriptionSession.user_id == user_id,
    ).scalar() or 0
    transcription_completed = db.query(func.count(TranscriptionSession.id)).filter(
        TranscriptionSession.user_id == user_id, TranscriptionSession.status == "completed",
    ).scalar() or 0
    dictionary_searches = db.query(func.count(SearchHistory.id)).filter(
        SearchHistory.user_id == user_id,
    ).scalar() or 0
    listening_dictionary = AdminUserListeningDictionaryStats(
        transcription_sessions=transcription_total,
        transcription_completed=transcription_completed,
        dictionary_searches=dictionary_searches,
    )

    return AdminUserLearningStats(
        vocabulary=vocabulary, jlpt=jlpt, conversation=conversation, listening_dictionary=listening_dictionary,
    )


@router.patch("/{user_id}/unlock", response_model=AdminUserDetail)
def unlock_user(user_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    user = db.query(User).options(joinedload(User.role), joinedload(User.information)).filter(
        User.id == user_id,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    user.is_active = True
    user.locked_reason = None
    user.locked_at = None
    db.commit()
    db.refresh(user)
    return _detail(user)
