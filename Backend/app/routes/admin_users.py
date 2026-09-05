"""Admin management of user accounts: browse/search all users, inspect one
user's full profile + learning stats, create/edit accounts, reset passwords,
and lock/unlock an account. Separate from routes/user.py (a user managing
their own profile)."""
import secrets
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, exists, func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.dependencies import UserResponse, require_admin
from app.models.audit_log import AuditLog
from app.models.chat import ChatScenario, Conversation, Message
from app.models.database import get_db
from app.models.dictionary import SearchHistory
from app.models.grammar import GrammarCorrection
from app.models.jlpt import (
    JlptExam, JlptMondaiTemplate, JlptQuestion, JlptSection, JlptTestAttempt, JlptTestAttemptAnswer,
    JlptUserExamPlan,
)
from app.models.profile import UserInformation
from app.models.transcription import TranscriptionSegment, TranscriptionSession
from app.models.user import Role, User
from app.models.vocabulary import VocabularyItem, VocabularyItemProgress, VocabularyReviewLog, VocabularySet
from app.schemas.chat import ConversationDetail, GrammarNote, MessageDetail
from app.schemas.user_admin import (
    AdminActivityEntry, AdminPasswordResetResponse, AdminUserConversationDetail, AdminUserConversationStats,
    AdminUserConversationSummary, AdminUserCreateRequest, AdminUserDetail, AdminUserGrammarErrorType,
    AdminUserJlptAnswerDetail, AdminUserJlptAttempt, AdminUserJlptAttemptDetail, AdminUserJlptChoice,
    AdminUserJlptDetail, AdminUserJlptLookupBucket, AdminUserJlptMondaiScore, AdminUserJlptNextTarget,
    AdminUserJlptProgressPoint, AdminUserJlptSectionScore, AdminUserJlptStats, AdminUserJlptWeakMondai,
    AdminUserLearningStats, AdminUserListeningDetail, AdminUserListeningDictionaryStats, AdminUserListeningVideo,
    AdminUserListPage, AdminUserLockRequest, AdminUserLookupEntry, AdminUserSrsBucket, AdminUserSummary,
    AdminUserTopWord, AdminUserUpdateRequest, AdminUserVocabularyDetail, AdminUserVocabularySetProgress,
    AdminUserVocabularyStats, AdminUserWeakWord,
)
from app.services.audit_log import log_event
from app.services.jlpt_scoring import build_score_breakdown, raw_section_counts
from app.services.xp_leveling import level_info
from app.utils.auth import hash_password

router = APIRouter(prefix="/admin/users", tags=["admin-users"])

PAGE_SIZE = 20
PROFILE_FIELDS = {
    "first_name", "last_name", "phone", "country", "city", "date_of_birth", "gender",
}
# Deliberately excludes current_jlpt_level, target_jlpt_level, and daily_vocab_goal —
# those are the learner's own configured learning settings and must stay
# self-service only; AdminUserUpdateRequest doesn't even accept them.


ONLINE_THRESHOLD_MINUTES = 3  # a user counts as 'active' (online right now) if a heartbeat landed within this window


def _account_status(user: User) -> str:
    """The 3-state status shown to admins: 'locked' overrides everything;
    otherwise 'active' means the user is online right now — a heartbeat
    (POST /auth/heartbeat, sent every ~60s while the app is open) landed
    within ONLINE_THRESHOLD_MINUTES — else 'inactive', which covers both an
    explicit logout (POST /auth/logout clears last_seen_at immediately) and
    simply closing the tab (heartbeats stop and the window expires)."""
    if not user.is_active:
        return "locked"
    if user.last_seen_at and datetime.utcnow() - user.last_seen_at <= timedelta(minutes=ONLINE_THRESHOLD_MINUTES):
        return "active"
    return "inactive"


def _summary(user: User) -> AdminUserSummary:
    info = user.information
    level, _, _ = level_info(user.vocab_xp)
    return AdminUserSummary(
        id=user.id, username=user.username, email=user.email,
        role=user.role.code if user.role else "user",
        is_active=user.is_active, account_status=_account_status(user),
        email_verified=bool(user.email_verified),
        locked_reason=user.locked_reason, locked_at=user.locked_at,
        last_login_at=user.last_login_at, created_at=user.created_at,
        first_name=info.first_name if info else None, last_name=info.last_name if info else None,
        avatar_url=info.avatar_url if info else None,
        current_jlpt_level=info.current_jlpt_level if info else None,
        vocab_xp=user.vocab_xp, level=level, streak_days=info.streak_days if info else 0,
    )


def _xp_percentile_top(db: Session, user: User) -> int:
    """This user's rank among all users by vocab_xp, expressed as "top N%"
    (lower = more XP than peers). Used for the "Top N% học viên" line on the
    profile header — recomputed on every fetch rather than stored, since XP
    changes constantly and the ranking is cheap to derive."""
    total = db.query(func.count(User.id)).scalar() or 1
    higher = db.query(func.count(User.id)).filter(User.vocab_xp > user.vocab_xp).scalar() or 0
    return max(1, round((higher + 1) / total * 100))


def _detail(db: Session, user: User) -> AdminUserDetail:
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
        xp_percentile_top=_xp_percentile_top(db, user),
        admin_note=user.admin_note,
    )


@router.post("", response_model=AdminUserDetail, status_code=201)
def create_user(
    payload: AdminUserCreateRequest, db: Session = Depends(get_db), admin: UserResponse = Depends(require_admin),
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

    log_event(
        db, subject_user_id=user.id, action="admin.user_created",
        description=f"Tài khoản được tạo bởi quản trị viên @{admin.username}",
        actor_user_id=admin.id, actor_role="admin",
    )

    db.commit()
    db.refresh(user)
    return _detail(db, user)


@router.get("", response_model=AdminUserListPage)
def list_users(
    search: Optional[str] = None,
    role: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),  # 'active' | 'inactive' | 'locked'
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
        online_since = datetime.utcnow() - timedelta(minutes=ONLINE_THRESHOLD_MINUTES)
        query = query.filter(User.is_active.is_(True), User.last_seen_at.isnot(None), User.last_seen_at >= online_since)
    elif status_filter == "inactive":
        online_since = datetime.utcnow() - timedelta(minutes=ONLINE_THRESHOLD_MINUTES)
        query = query.filter(
            User.is_active.is_(True),
            or_(User.last_seen_at.is_(None), User.last_seen_at < online_since),
        )
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
    return _detail(db, user)


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

    if "admin_note" in data:
        user.admin_note = data["admin_note"]

    profile_data = {k: v for k, v in data.items() if k in PROFILE_FIELDS}
    if profile_data:
        info = user.information
        if not info:
            info = UserInformation(user_id=user.id)
            db.add(info)
        for field, value in profile_data.items():
            setattr(info, field, value)

    if data:
        # A note-only save gets its own log line ("Ghi chú nội bộ được cập
        # nhật") instead of the generic "Thông tin tài khoản được cập nhật"
        # message, since it isn't a profile edit.
        if set(data.keys()) == {"admin_note"}:
            log_event(
                db, subject_user_id=user.id, action="admin.note_updated",
                description=f"Ghi chú nội bộ được cập nhật bởi quản trị viên @{admin.username}",
                actor_user_id=admin.id, actor_role="admin",
            )
        else:
            log_event(
                db, subject_user_id=user.id, action="admin.user_updated",
                description=f"Thông tin tài khoản được cập nhật bởi quản trị viên @{admin.username}",
                actor_user_id=admin.id, actor_role="admin", extra_data={"fields": sorted(data.keys())},
            )

    db.commit()
    db.refresh(user)
    return _detail(db, user)


@router.post("/{user_id}/reset-password", response_model=AdminPasswordResetResponse)
def reset_password(user_id: int, db: Session = Depends(get_db), admin: UserResponse = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    temporary_password = secrets.token_urlsafe(9)
    user.password_hash = hash_password(temporary_password)
    log_event(
        db, subject_user_id=user.id, action="admin.password_reset",
        description=f"Mật khẩu được đặt lại bởi quản trị viên @{admin.username}",
        actor_user_id=admin.id, actor_role="admin",
    )
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
    log_event(
        db, subject_user_id=user.id, action="admin.user_locked",
        description=f"Tài khoản bị khóa bởi quản trị viên @{admin.username}: {payload.reason}",
        actor_user_id=admin.id, actor_role="admin", extra_data={"reason": payload.reason},
    )
    db.commit()
    db.refresh(user)
    return _detail(db, user)


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
    today_start = datetime.combine(datetime.utcnow().date(), datetime.min.time())
    studied_today = db.query(func.count(func.distinct(VocabularyReviewLog.item_id))).filter(
        VocabularyReviewLog.user_id == user_id,
        VocabularyReviewLog.reviewed_at >= today_start,
    ).scalar() or 0
    vocabulary = AdminUserVocabularyStats(
        learned=vocab_by_status.get("learned", 0),
        reviewing=vocab_by_status.get("reviewing", 0),
        new=vocab_by_status.get("new", 0),
        total_reviews=total_reviews,
        studied_today=studied_today,
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


RECENT_ACTIVE_DAYS = 3  # a set touched within this window counts as "học tích cực"
NEW_SET_THRESHOLD_PERCENT = 15  # below this progress, a set is still "mới bắt đầu"
WEAK_WORD_MIN_AGAIN = 2  # a word needs at least this many 'again' ratings to count as "hay quên"
WEAK_WORD_LIMIT = 5


def _vocabulary_detail(db: Session, user: User) -> AdminUserVocabularyDetail:
    """Aggregates this user's vocabulary learning state for the admin
    "Từ vựng" tab: headline stats, per-set progress, and the words they most
    often grade 'again' (forgot). Every number here is derived straight from
    VocabularyItemProgress/VocabularyReviewLog — there's no per-user
    "enrollment" record, so a set counts as started once the user has graded
    at least one of its words."""
    now = datetime.utcnow()
    user_id = user.id

    status_counts = dict(
        db.query(VocabularyItemProgress.status, func.count(VocabularyItemProgress.id))
        .filter(VocabularyItemProgress.user_id == user_id)
        .group_by(VocabularyItemProgress.status)
        .all()
    )
    mastered = status_counts.get("learned", 0)
    total_touched = mastered + status_counts.get("reviewing", 0)
    mastered_percent = round(mastered / total_touched * 100) if total_touched else 0

    # Histogram of SRS interval length ("how far apart is this word's next
    # review") rather than the coarse status field, so a word graded 'hard'
    # repeatedly (still 'reviewing' but with a long interval) lands in the
    # right bucket. The last bucket's >= 21 boundary mirrors
    # LEARNED_INTERVAL_THRESHOLD_DAYS in vocabulary/learning.py.
    bucket_counts = db.query(
        func.sum(case((VocabularyItemProgress.interval_days <= 1, 1), else_=0)),
        func.sum(case((VocabularyItemProgress.interval_days.between(2, 6), 1), else_=0)),
        func.sum(case((VocabularyItemProgress.interval_days.between(7, 20), 1), else_=0)),
        func.sum(case((VocabularyItemProgress.interval_days >= 21, 1), else_=0)),
    ).filter(VocabularyItemProgress.user_id == user_id).one()
    new_count, short_term_count, mid_term_count, deep_count = (c or 0 for c in bucket_counts)
    srs_distribution = [
        AdminUserSrsBucket(label="Mới học", sublabel="Cấp độ 1 (0-1 ngày)", count=new_count, tone="info"),
        AdminUserSrsBucket(label="Ôn ngắn hạn", sublabel="Cấp độ 2-3 (2-6 ngày)", count=short_term_count, tone="pending"),
        AdminUserSrsBucket(label="Đang ghi nhớ", sublabel="Cấp độ 4 (7-20 ngày)", count=mid_term_count, tone="neutral"),
        AdminUserSrsBucket(label="Đã thuộc sâu", sublabel="Cấp độ 5 (≥ 21 ngày)", count=deep_count, tone="success"),
    ]

    today_start = datetime.combine(now.date(), datetime.min.time())
    studied_today = db.query(func.count(func.distinct(VocabularyReviewLog.item_id))).filter(
        VocabularyReviewLog.user_id == user_id, VocabularyReviewLog.reviewed_at >= today_start,
    ).scalar() or 0

    due_today = db.query(func.count(VocabularyItemProgress.id)).filter(
        VocabularyItemProgress.user_id == user_id,
        VocabularyItemProgress.status.in_(("reviewing", "learned")),
        VocabularyItemProgress.due_at <= now,
    ).scalar() or 0

    total_reviews = db.query(func.count(VocabularyReviewLog.id)).filter(
        VocabularyReviewLog.user_id == user_id,
    ).scalar() or 0
    correct_reviews = db.query(func.count(VocabularyReviewLog.id)).filter(
        VocabularyReviewLog.user_id == user_id, VocabularyReviewLog.rating.in_(("good", "easy")),
    ).scalar() or 0
    if total_reviews == 0:
        accuracy_percent, accuracy_label = None, "Chưa có dữ liệu"
    else:
        accuracy_percent = round(correct_reviews / total_reviews * 100, 1)
        if accuracy_percent >= 85:
            accuracy_label = "Hiệu suất rất cao"
        elif accuracy_percent >= 70:
            accuracy_label = "Hiệu suất tốt"
        elif accuracy_percent >= 50:
            accuracy_label = "Hiệu suất trung bình"
        else:
            accuracy_label = "Cần cải thiện"

    set_rows = (
        db.query(
            VocabularyItem.set_id,
            func.count(VocabularyItemProgress.id),
            func.sum(case((VocabularyItemProgress.status == "learned", 1), else_=0)),
            func.max(VocabularyItemProgress.last_reviewed_at),
        )
        .join(VocabularyItemProgress, VocabularyItemProgress.item_id == VocabularyItem.id)
        .filter(VocabularyItemProgress.user_id == user_id)
        .group_by(VocabularyItem.set_id)
        .all()
    )
    set_ids = [row[0] for row in set_rows]
    sets_by_id = {
        s.id: s for s in db.query(VocabularySet).options(joinedload(VocabularySet.curriculum)).filter(
            VocabularySet.id.in_(set_ids),
        )
    } if set_ids else {}

    sets: List[AdminUserVocabularySetProgress] = []
    for set_id, progress_count, mastered_count, last_reviewed_at in set_rows:
        vocab_set = sets_by_id.get(set_id)
        if not vocab_set:
            continue
        percent = round(progress_count / vocab_set.item_count * 100) if vocab_set.item_count else 0
        recently_active = last_reviewed_at is not None and (now - last_reviewed_at) <= timedelta(days=RECENT_ACTIVE_DAYS)
        if percent >= 100:
            status_label, status_tone = "Đã hoàn thành", "success"
        elif recently_active:
            status_label, status_tone = "Đang học tích cực", "success"
        elif percent < NEW_SET_THRESHOLD_PERCENT:
            status_label, status_tone = "Mới bắt đầu", "pending"
        else:
            status_label, status_tone = "Đang học", "info"
        sets.append(AdminUserVocabularySetProgress(
            id=vocab_set.id, set_name=vocab_set.set_name, level=vocab_set.level,
            curriculum_name=vocab_set.curriculum.name if vocab_set.curriculum else None,
            item_count=vocab_set.item_count, progress_count=progress_count, mastered_count=mastered_count or 0,
            percent=percent, status_label=status_label, status_tone=status_tone,
        ))
    sets.sort(key=lambda s: s.percent, reverse=True)

    weak_rows = (
        db.query(VocabularyItem, func.count(VocabularyReviewLog.id).label("again_count"))
        .join(VocabularyReviewLog, VocabularyReviewLog.item_id == VocabularyItem.id)
        .filter(VocabularyReviewLog.user_id == user_id, VocabularyReviewLog.rating == "again")
        .group_by(VocabularyItem.id)
        .having(func.count(VocabularyReviewLog.id) >= WEAK_WORD_MIN_AGAIN)
        .order_by(func.count(VocabularyReviewLog.id).desc())
        .limit(WEAK_WORD_LIMIT)
        .all()
    )
    weak_words = [
        AdminUserWeakWord(word=item.word, reading=item.reading, meaning_vi=item.meaning_vi, again_count=again_count)
        for item, again_count in weak_rows
    ]

    return AdminUserVocabularyDetail(
        total_touched=total_touched, studied_today=studied_today,
        mastered=mastered, mastered_percent=mastered_percent, due_today=due_today,
        accuracy_percent=accuracy_percent, accuracy_label=accuracy_label,
        sets=sets, weak_words=weak_words, srs_distribution=srs_distribution,
    )


@router.get("/{user_id}/vocabulary", response_model=AdminUserVocabularyDetail)
def get_user_vocabulary_detail(user_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    return _vocabulary_detail(db, user)


@router.post("/{user_id}/vocabulary/reset-srs", response_model=AdminUserVocabularyDetail)
def reset_user_vocabulary_srs(user_id: int, db: Session = Depends(get_db), admin: UserResponse = Depends(require_admin)):
    """Wipes this user's spaced-repetition state (VocabularyItemProgress) so
    every word goes back to unseen with a fresh schedule. Historical
    VocabularyReviewLog rows are append-only (see the model docstring) and
    are deliberately left alone — past accuracy/weak-word stats still stand,
    only the SRS scheduling itself is reset."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    reset_count = db.query(VocabularyItemProgress).filter(
        VocabularyItemProgress.user_id == user_id,
    ).delete(synchronize_session=False)
    log_event(
        db, subject_user_id=user.id, action="admin.vocab_srs_reset",
        description=f"Chu kỳ SRS từ vựng được đặt lại bởi quản trị viên @{admin.username}",
        actor_user_id=admin.id, actor_role="admin", extra_data={"reset_count": reset_count},
    )
    db.commit()
    return _vocabulary_detail(db, user)


JLPT_ATTEMPT_HISTORY_LIMIT = 10  # rows shown in "Lịch sử thi thử JLPT"
JLPT_PROGRESS_LIMIT = 6  # points on the score-progress chart
JLPT_WEAK_MONDAI_MIN_ATTEMPTS = 2  # a mondai needs at least this many graded questions to count
JLPT_WEAK_MONDAI_LIMIT = 3


def _jlpt_weak_mondai(db: Session, user_id: int, level: Optional[str]) -> List[AdminUserJlptWeakMondai]:
    """Which mondai (question groups) this user answers wrong most often,
    all-time — the admin equivalent of jlpt/dashboard.py's `_weak_mondai`,
    without its 30-day window since this view is a retrospective summary
    rather than "what to study this week"."""
    query = (
        db.query(
            JlptSection.name, JlptMondaiTemplate.mondai_no, JlptMondaiTemplate.name,
            JlptTestAttemptAnswer.is_correct,
        )
        .select_from(JlptTestAttemptAnswer)
        .join(JlptTestAttempt, JlptTestAttemptAnswer.attempt_id == JlptTestAttempt.id)
        .join(JlptExam, JlptTestAttempt.exam_id == JlptExam.id)
        .join(JlptQuestion, JlptTestAttemptAnswer.question_id == JlptQuestion.id)
        .join(JlptMondaiTemplate, JlptQuestion.mondai_template_id == JlptMondaiTemplate.id)
        .join(JlptSection, JlptMondaiTemplate.section_id == JlptSection.id)
        .filter(JlptTestAttempt.user_id == user_id, JlptTestAttempt.status == 'completed')
    )
    if level:
        query = query.filter(JlptExam.level == level)

    stats: dict = {}
    for section_name, mondai_no, mondai_name, is_correct in query.all():
        key = (section_name, mondai_no, mondai_name)
        entry = stats.setdefault(key, {"wrong": 0, "total": 0})
        entry["total"] += 1
        if not is_correct:
            entry["wrong"] += 1

    weak = [
        AdminUserJlptWeakMondai(
            section_name=key[0], mondai_no=key[1], mondai_name=key[2],
            wrong_count=entry["wrong"], total_count=entry["total"],
            percent_correct=round((entry["total"] - entry["wrong"]) / entry["total"] * 100, 1),
        )
        for key, entry in stats.items()
        if entry["total"] >= JLPT_WEAK_MONDAI_MIN_ATTEMPTS
    ]
    weak.sort(key=lambda w: w.percent_correct)
    return weak[:JLPT_WEAK_MONDAI_LIMIT]


def _jlpt_insight_message(
    scoped_breakdowns: List[dict], weak_mondai: List[AdminUserJlptWeakMondai],
) -> Optional[str]:
    """A short, rule-based summary of this user's JLPT performance — same
    "gap to pass + weakest section" reasoning as jlpt/dashboard.py's
    `_study_pace_message`, phrased for an admin reading someone else's
    progress rather than the learner's own study-pace nudge."""
    if not scoped_breakdowns:
        return None

    section_totals: dict = {}
    for breakdown in scoped_breakdowns:
        for s in breakdown["sections"]:
            entry = section_totals.setdefault(s["name"], [0, 0])
            entry[0] += s["score"]
            entry[1] += 1
    if not section_totals:
        return None

    averages = {name: total / count for name, (total, count) in section_totals.items()}
    best_name = max(averages, key=averages.get)
    worst_name = min(averages, key=averages.get)

    parts = [f"Học viên làm tốt nhất ở {best_name} (trung bình {averages[best_name]:.0f}/60 điểm)."]
    if worst_name != best_name:
        parts.append(f"Cần tập trung cải thiện {worst_name} (trung bình {averages[worst_name]:.0f}/60 điểm).")
    if weak_mondai:
        w = weak_mondai[0]
        mondai_label = f"Mondai {w.mondai_no}" + (f" ({w.mondai_name})" if w.mondai_name else "")
        parts.append(f"{mondai_label} trong {w.section_name} có tỷ lệ đúng thấp nhất ({w.percent_correct:.0f}%).")
    return " ".join(parts)


def _mondai_tier(percent: int) -> tuple:
    if percent >= 90:
        return "Rất tốt", "success"
    if percent >= 75:
        return "Tốt", "info"
    if percent >= 60:
        return "Khá", "pending"
    return "Cần cải thiện", "danger"


def _latest_mondai_breakdown(db: Session, attempt: JlptTestAttempt) -> List[AdminUserJlptMondaiScore]:
    """Correct/total per mondai on one specific attempt (the learner's most
    recent one) — unlike `_jlpt_weak_mondai`, this covers every mondai they
    saw on that attempt, not just the ones they struggle with."""
    question_ids = {a.question_id for a in attempt.answers}
    if not question_ids:
        return []

    rows = (
        db.query(JlptSection.order_no, JlptSection.name, JlptMondaiTemplate.mondai_no, JlptMondaiTemplate.name, JlptQuestion.id)
        .join(JlptMondaiTemplate, JlptQuestion.mondai_template_id == JlptMondaiTemplate.id)
        .join(JlptSection, JlptMondaiTemplate.section_id == JlptSection.id)
        .filter(JlptQuestion.id.in_(question_ids))
        .all()
    )
    mondai_by_question = {
        qid: (order_no, section_name, mondai_no, mondai_name)
        for order_no, section_name, mondai_no, mondai_name, qid in rows
    }

    stats: dict = {}
    for a in attempt.answers:
        key = mondai_by_question.get(a.question_id)
        if not key:
            continue
        entry = stats.setdefault(key, {"correct": 0, "total": 0})
        entry["total"] += 1
        if a.is_correct:
            entry["correct"] += 1

    out = []
    for (order_no, section_name, mondai_no, mondai_name), entry in sorted(stats.items(), key=lambda kv: (kv[0][0], kv[0][2])):
        percent = round(entry["correct"] / entry["total"] * 100) if entry["total"] else 0
        tier_label, tier_tone = _mondai_tier(percent)
        out.append(AdminUserJlptMondaiScore(
            section_name=section_name, mondai_no=mondai_no, name=mondai_name,
            correct=entry["correct"], total=entry["total"],
            percent=percent, tier_label=tier_label, tier_tone=tier_tone,
        ))
    return out


def _jlpt_next_target(db: Session, user: User) -> Optional[AdminUserJlptNextTarget]:
    """The real-world sitting the learner picked for their own
    target_jlpt_level (see JlptUserExamPlan) — None when they haven't chosen
    one, which the admin UI renders as an empty state rather than guessing
    a date."""
    target_level = user.information.target_jlpt_level if user.information else None
    if not target_level:
        return None

    plan = (
        db.query(JlptUserExamPlan)
        .options(joinedload(JlptUserExamPlan.schedule))
        .filter(JlptUserExamPlan.user_id == user.id, JlptUserExamPlan.level == target_level)
        .first()
    )
    if not plan:
        return None

    exam_date = plan.schedule.exam_date
    today = date.today()
    months_left = max(0, (exam_date.year - today.year) * 12 + (exam_date.month - today.month))
    return AdminUserJlptNextTarget(level=target_level, exam_date=exam_date, months_left=months_left)


def _jlpt_detail(db: Session, user: User) -> AdminUserJlptDetail:
    attempts_all = (
        db.query(JlptTestAttempt)
        .join(JlptExam)
        .options(joinedload(JlptTestAttempt.exam), selectinload(JlptTestAttempt.answers))
        .filter(JlptTestAttempt.user_id == user.id, JlptTestAttempt.status == 'completed')
        .order_by(JlptTestAttempt.submitted_at.desc())
        .all()
    )

    breakdown_by_attempt = {
        a.id: build_score_breakdown(a.exam.level, raw_section_counts(db, a.answers))
        for a in attempts_all
    }

    attempts_out = []
    for a in attempts_all[:JLPT_ATTEMPT_HISTORY_LIMIT]:
        breakdown = breakdown_by_attempt[a.id]
        duration_minutes = (
            max(0, round((a.submitted_at - a.created_at).total_seconds() / 60))
            if a.submitted_at and a.created_at else None
        )
        attempts_out.append(AdminUserJlptAttempt(
            attempt_id=a.id, exam_id=a.exam_id, exam_title=a.exam.title, level=a.exam.level,
            submitted_at=a.submitted_at, duration_minutes=duration_minutes,
            total=breakdown["total"], total_max=breakdown["total_max"],
            pass_total=breakdown["pass_total"], is_pass=breakdown["is_pass"],
            sections=[AdminUserJlptSectionScore(**s) for s in breakdown["sections"]],
        ))

    # Aggregate stats cover EVERY completed attempt regardless of exam level
    # — they need to match what the history table above actually shows.
    # An earlier version scoped these to one JLPT level (to keep a stray N5
    # warm-up from diluting an N2 average), but that made "tỷ lệ đạt ước
    # tính" silently count only same-level attempts while the table kept
    # showing all of them — e.g. 2 passes out of 4 visible rows reading as
    # "100%" because the 2 failing rows were a different level and got
    # dropped from the denominator. Simple and honest beats that.
    chronological = sorted(attempts_all, key=lambda a: a.submitted_at)
    all_breakdowns = [breakdown_by_attempt[a.id] for a in chronological]

    totals = [b["total"] for b in all_breakdowns]
    average_total = round(sum(totals) / len(totals), 1) if totals else None
    best_total = max(totals) if totals else None
    pass_estimate_percent = (
        round(sum(1 for b in all_breakdowns if b["is_pass"]) / len(all_breakdowns) * 100)
        if all_breakdowns else None
    )
    delta_total = totals[-1] - totals[-2] if len(totals) >= 2 else None

    progress = [
        AdminUserJlptProgressPoint(
            attempt_id=a.id, label=a.submitted_at.strftime("%d/%m") if a.submitted_at else "",
            submitted_at=a.submitted_at, total=breakdown_by_attempt[a.id]["total"],
        )
        for a in chronological[-JLPT_PROGRESS_LIMIT:]
    ]

    weak_mondai = _jlpt_weak_mondai(db, user.id, level=None)
    insight_message = _jlpt_insight_message(all_breakdowns, weak_mondai)

    # The mondai breakdown below is inherently single-attempt (there's no
    # sane way to merge two different exams' mondai into one bar), so it
    # still only looks at the single most recent attempt — `latest_level`
    # just labels which level that was, it no longer filters anything above.
    latest_attempt_label = None
    latest_level = None
    latest_mondai_breakdown: List[AdminUserJlptMondaiScore] = []
    if chronological:
        latest_attempt = chronological[-1]
        latest_attempt_label = latest_attempt.exam.title
        latest_level = latest_attempt.exam.level
        latest_mondai_breakdown = _latest_mondai_breakdown(db, latest_attempt)

    next_target = _jlpt_next_target(db, user)

    return AdminUserJlptDetail(
        attempts=attempts_out, attempts_total=len(attempts_all), scope_level=latest_level,
        average_total=average_total, best_total=best_total, pass_estimate_percent=pass_estimate_percent,
        delta_total=delta_total, progress=progress, weak_mondai=weak_mondai,
        latest_attempt_label=latest_attempt_label, latest_mondai_breakdown=latest_mondai_breakdown,
        next_target=next_target, insight_message=insight_message,
    )


@router.get("/{user_id}/jlpt", response_model=AdminUserJlptDetail)
def get_user_jlpt_detail(user_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    user = db.query(User).options(joinedload(User.information)).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    return _jlpt_detail(db, user)


@router.get("/{user_id}/jlpt/attempts/{attempt_id}", response_model=AdminUserJlptAttemptDetail)
def get_user_jlpt_attempt_detail(
    user_id: int, attempt_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    """The full graded Q&A for one completed attempt — "Xem bài làm". Mirrors
    what the learner sees right after submitting (attempts.py's
    submit_attempt response), looked up after the fact instead of only
    available in that one response."""
    attempt = (
        db.query(JlptTestAttempt)
        .options(joinedload(JlptTestAttempt.exam), selectinload(JlptTestAttempt.answers))
        .filter(
            JlptTestAttempt.id == attempt_id, JlptTestAttempt.user_id == user_id,
            JlptTestAttempt.status == 'completed',
        )
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Không tìm thấy lượt thi")

    question_ids = [a.question_id for a in attempt.answers]
    questions = (
        db.query(JlptQuestion)
        .options(
            selectinload(JlptQuestion.choices),
            joinedload(JlptQuestion.passage),
            joinedload(JlptQuestion.mondai_template).joinedload(JlptMondaiTemplate.section),
        )
        .filter(JlptQuestion.id.in_(question_ids))
        .all()
    )
    questions_by_id = {q.id: q for q in questions}
    answer_by_question_id = {a.question_id: a for a in attempt.answers}

    answers_out = []
    for q in sorted(questions_by_id.values(), key=lambda q: q.question_no):
        a = answer_by_question_id[q.id]
        answers_out.append(AdminUserJlptAnswerDetail(
            question_no=q.question_no, question_text=q.question_text,
            passage_text=q.passage.passage_text if q.passage else None,
            choices=[
                AdminUserJlptChoice(choice_no=c.choice_no, choice_text=c.choice_text)
                for c in sorted(q.choices, key=lambda c: c.choice_no)
            ],
            selected_choice_no=a.selected_choice_no, correct_no=q.correct_no, is_correct=bool(a.is_correct),
            explanation=q.explanation, section_name=q.mondai_template.section.name,
            mondai_no=q.mondai_template.mondai_no, mondai_name=q.mondai_template.name,
        ))

    return AdminUserJlptAttemptDetail(
        attempt_id=attempt.id, exam_title=attempt.exam.title, level=attempt.exam.level,
        submitted_at=attempt.submitted_at, score=attempt.score or 0, total_questions=attempt.total_questions or 0,
        answers=answers_out,
    )


LOOKUP_HISTORY_LIMIT = 10  # rows shown in "Lịch sử tra cứu gần đây"
TOP_WORD_LIMIT = 5
TOP_WORD_MIN_COUNT = 2  # a word needs at least this many lookups to count as "tra nhiều lần"
VIDEO_LIST_LIMIT = 8

VIDEO_STATUS_META = {
    "completed": ("Hoàn thành", "success"),
    "processing": ("Đang xử lý", "pending"),
    "pending": ("Đang chờ", "pending"),
    "failed": ("Thất bại", "danger"),
}
JLPT_LOOKUP_BUCKET_TONE = {"N1": "danger", "N2": "info", "N3": "pending", "N4": "success", "N5": "neutral"}
JLPT_LEVEL_ORDER = ["N1", "N2", "N3", "N4", "N5"]
UNKNOWN_JLPT_LABEL = "Không rõ"


def _listening_detail(db: Session, user: User) -> AdminUserListeningDetail:
    """Aggregates this user's dictionary-lookup and video-listening activity
    for the admin "Nghe & Từ điển" tab. Everything here is derived straight
    from SearchHistory/TranscriptionSession — there's no notebook-with-
    named-groups feature and no shadowing/dictation scoring in this
    codebase, so this tab deliberately doesn't show either."""
    user_id = user.id

    total_lookups = db.query(func.count(SearchHistory.id)).filter(SearchHistory.user_id == user_id).scalar() or 0
    unique_words = db.query(func.count(func.distinct(SearchHistory.word))).filter(
        SearchHistory.user_id == user_id,
    ).scalar() or 0
    today_start = datetime.combine(datetime.utcnow().date(), datetime.min.time())
    lookups_today = db.query(func.count(SearchHistory.id)).filter(
        SearchHistory.user_id == user_id, SearchHistory.created_at >= today_start,
    ).scalar() or 0

    recent_rows = (
        db.query(SearchHistory)
        .filter(SearchHistory.user_id == user_id)
        .order_by(SearchHistory.created_at.desc())
        .limit(LOOKUP_HISTORY_LIMIT)
        .all()
    )
    recent_lookups = [
        AdminUserLookupEntry(
            id=r.id, word=r.word, reading=r.reading, meaning=r.meaning,
            jlpt=r.jlpt if r.jlpt in JLPT_LEVEL_ORDER else None, created_at=r.created_at,
        )
        for r in recent_rows
    ]

    top_rows = (
        db.query(
            SearchHistory.word, SearchHistory.reading, SearchHistory.meaning, SearchHistory.jlpt,
            func.count(SearchHistory.id), func.max(SearchHistory.created_at),
        )
        .filter(SearchHistory.user_id == user_id)
        .group_by(SearchHistory.word, SearchHistory.reading, SearchHistory.meaning, SearchHistory.jlpt)
        .having(func.count(SearchHistory.id) >= TOP_WORD_MIN_COUNT)
        .order_by(func.count(SearchHistory.id).desc())
        .limit(TOP_WORD_LIMIT)
        .all()
    )
    top_words = [
        AdminUserTopWord(
            word=word, reading=reading, meaning=meaning,
            jlpt=jlpt if jlpt in JLPT_LEVEL_ORDER else None, search_count=count, last_searched_at=last_at,
        )
        for word, reading, meaning, jlpt, count, last_at in top_rows
    ]

    # SearchHistory.jlpt holds whatever the dictionary lookup returned, which
    # for many words is the literal string "N/A" rather than NULL — so
    # "unknown" is "any value outside N1..N5", not just a None check.
    jlpt_counts = dict(
        db.query(SearchHistory.jlpt, func.count(SearchHistory.id))
        .filter(SearchHistory.user_id == user_id)
        .group_by(SearchHistory.jlpt)
        .all()
    )
    jlpt_distribution = [
        AdminUserJlptLookupBucket(level=level, count=jlpt_counts[level], tone=JLPT_LOOKUP_BUCKET_TONE[level])
        for level in JLPT_LEVEL_ORDER
        if jlpt_counts.get(level)
    ]
    unknown_count = sum(count for level, count in jlpt_counts.items() if level not in JLPT_LEVEL_ORDER)
    if unknown_count:
        jlpt_distribution.append(AdminUserJlptLookupBucket(level=UNKNOWN_JLPT_LABEL, count=unknown_count, tone="neutral"))

    video_sessions_total = db.query(func.count(TranscriptionSession.id)).filter(
        TranscriptionSession.user_id == user_id,
    ).scalar() or 0
    video_sessions_completed = db.query(func.count(TranscriptionSession.id)).filter(
        TranscriptionSession.user_id == user_id, TranscriptionSession.status == "completed",
    ).scalar() or 0
    # duration_ms often isn't populated (older sessions never had it set) —
    # fall back to the session's own segments' last end_time so the stat
    # doesn't just silently read 0 for those.
    completed_durations = (
        db.query(TranscriptionSession.id, TranscriptionSession.duration_ms)
        .filter(TranscriptionSession.user_id == user_id, TranscriptionSession.status == "completed")
        .all()
    )
    total_listening_ms = sum(ms for _sid, ms in completed_durations if ms)
    missing_duration_ids = [sid for sid, ms in completed_durations if not ms]
    fallback_seconds = 0.0
    if missing_duration_ids:
        fallback_seconds = sum(
            end or 0 for _sid, end in (
                db.query(TranscriptionSegment.session_id, func.max(TranscriptionSegment.end_time))
                .filter(TranscriptionSegment.session_id.in_(missing_duration_ids))
                .group_by(TranscriptionSegment.session_id)
                .all()
            )
        )
    total_listening_minutes = round(total_listening_ms / 60000 + fallback_seconds / 60)

    video_rows = (
        db.query(TranscriptionSession)
        .filter(TranscriptionSession.user_id == user_id)
        .order_by(TranscriptionSession.created_at.desc())
        .limit(VIDEO_LIST_LIMIT)
        .all()
    )
    videos = []
    for v in video_rows:
        status_label, status_tone = VIDEO_STATUS_META.get(v.status, (v.status, "neutral"))
        videos.append(AdminUserListeningVideo(
            id=v.id, video_title=v.video_title, thumbnail=v.thumbnail, channel_title=v.channel_title,
            source_type=v.source_type, status=v.status, status_label=status_label, status_tone=status_tone,
            segment_count=v.segment_count, duration_ms=v.duration_ms, created_at=v.created_at,
        ))

    return AdminUserListeningDetail(
        total_lookups=total_lookups, unique_words=unique_words, lookups_today=lookups_today,
        video_sessions_total=video_sessions_total, video_sessions_completed=video_sessions_completed,
        total_listening_minutes=total_listening_minutes,
        recent_lookups=recent_lookups, top_words=top_words, jlpt_distribution=jlpt_distribution, videos=videos,
    )


@router.get("/{user_id}/listening", response_model=AdminUserListeningDetail)
def get_user_listening_detail(user_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    return _listening_detail(db, user)


@router.delete("/{user_id}/listening/search-history", response_model=AdminUserListeningDetail)
def clear_user_search_history(user_id: int, db: Session = Depends(get_db), admin: UserResponse = Depends(require_admin)):
    """Wipes this user's dictionary lookup history (SearchHistory). Distinct
    from the vocabulary SRS reset — this only clears what they've searched,
    not any learning progress."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    deleted_count = db.query(SearchHistory).filter(SearchHistory.user_id == user_id).delete(synchronize_session=False)
    log_event(
        db, subject_user_id=user.id, action="admin.search_history_cleared",
        description=f"Lịch sử tra từ điển được xóa bởi quản trị viên @{admin.username}",
        actor_user_id=admin.id, actor_role="admin", extra_data={"deleted_count": deleted_count},
    )
    db.commit()
    return _listening_detail(db, user)


CONVERSATION_HISTORY_LIMIT = 8  # rows shown in "Lịch sử luyện đàm thoại với AI"
CONVERSATION_ERROR_TYPE_LIMIT = 5
CONVERSATION_GAP_CAP_SECONDS = 5 * 60  # a gap longer than this between messages doesn't count as active chatting time


def _conversation_detail(db: Session, user: User) -> AdminUserConversationDetail:
    """Aggregates this user's AI-conversation and conversation-linked grammar
    data for the admin "Hội thoại & Ngữ pháp" tab. There's no stored
    "naturalness score" or per-skill AI rating anywhere in this codebase (the
    chatbot is text-only), so this tab only ever shows numbers derived from
    real Conversation/Message/GrammarCorrection rows — the error-type
    breakdown reuses the same `explanation.error_type` classification the
    learner-facing /correct/stats endpoint groups by."""
    user_id = user.id

    total_conversations = db.query(func.count(Conversation.id)).filter(Conversation.user_id == user_id).scalar() or 0

    # Raw per-message timestamps for every one of this user's conversations —
    # used both for each row's turn count/first-last timestamps in the
    # history list, and for the total duration stat below. A conversation
    # thread can be reopened days later (it has no "submit" event like a
    # JLPT attempt does), so plain (last message - first message) wildly
    # overstates real chatting time; instead each gap between consecutive
    # messages is capped at CONVERSATION_GAP_CAP_SECONDS before summing, the
    # same "active time from an event stream" heuristic session-duration
    # analytics commonly use.
    message_rows = (
        db.query(Message.conversation_id, Message.role, Message.created_at)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .filter(Conversation.user_id == user_id)
        .order_by(Message.conversation_id, Message.created_at)
        .all()
    )
    turns_by_conversation: dict = {}
    timestamps_by_conversation: dict = {}
    for cid, role, created_at in message_rows:
        if role == "user":
            turns_by_conversation[cid] = turns_by_conversation.get(cid, 0) + 1
        if created_at:
            timestamps_by_conversation.setdefault(cid, []).append(created_at)
    agg_by_conversation = {
        cid: (turns_by_conversation.get(cid, 0), ts[0], ts[-1])
        for cid, ts in timestamps_by_conversation.items()
    }
    total_messages_sent = sum(turns_by_conversation.values())
    total_duration_seconds = sum(
        min(CONVERSATION_GAP_CAP_SECONDS, (b - a).total_seconds())
        for ts in timestamps_by_conversation.values()
        for a, b in zip(ts, ts[1:])
    )

    # Conversation-linked grammar corrections only (message_id set) — the
    # standalone /correct page's own history is a separate feature and out
    # of this tab's scope.
    #
    # `GrammarCorrection.error_count` is a low-level character-diff count
    # (see grade_text in grammar_service.py: it counts ndiff `+`/`-` lines,
    # not real grammar errors), so it disagrees with `has_errors`/the
    # transcript UI, which are both based on whether the LLM actually
    # explained a problem. Counting `len(explanation)` here instead keeps
    # this tab's "X lỗi ngữ pháp" numbers consistent with what "Xem
    # transcript" actually shows for the same conversation.
    grammar_rows = (
        db.query(GrammarCorrection.explanation, Message.conversation_id)
        .join(Message, GrammarCorrection.message_id == Message.id)
        .filter(GrammarCorrection.user_id == user_id, GrammarCorrection.message_id.isnot(None))
        .all()
    )
    grammar_checks = len(grammar_rows)
    explained_error_counts = [len(exp or []) for exp, _cid in grammar_rows]
    total_errors = sum(explained_error_counts)
    correct_message_rate = (
        round(sum(1 for ec in explained_error_counts if ec == 0) / grammar_checks * 100, 1)
        if grammar_checks else None
    )
    error_count_by_conversation: dict = {}
    for (_exp, cid), ec in zip(grammar_rows, explained_error_counts):
        error_count_by_conversation[cid] = error_count_by_conversation.get(cid, 0) + ec

    assistant_total = db.query(func.count(Message.id)).join(
        Conversation, Message.conversation_id == Conversation.id,
    ).filter(Conversation.user_id == user_id, Message.role == "assistant").scalar() or 0
    off_topic_count = db.query(func.count(Message.id)).join(
        Conversation, Message.conversation_id == Conversation.id,
    ).filter(
        Conversation.user_id == user_id, Message.role == "assistant", Message.is_off_topic.is_(True),
    ).scalar() or 0
    off_topic_rate = round(off_topic_count / assistant_total * 100, 1) if assistant_total else None

    type_counts: dict = {}
    type_examples: dict = {}
    for explanation, _cid in grammar_rows:
        for err in explanation or []:
            if not isinstance(err, dict):
                continue
            error_type = err.get("error_type")
            if not error_type:
                continue
            type_counts[error_type] = type_counts.get(error_type, 0) + 1
            type_examples.setdefault(error_type, err)
    total_error_instances = sum(type_counts.values())
    top_error_types = [
        AdminUserGrammarErrorType(
            error_type=error_type, count=count,
            percent=round(count / total_error_instances * 100, 1) if total_error_instances else 0.0,
            example_original=type_examples[error_type].get("original_fragment"),
            example_corrected=type_examples[error_type].get("corrected_fragment"),
            example_why_wrong=type_examples[error_type].get("why_wrong"),
        )
        for error_type, count in sorted(type_counts.items(), key=lambda kv: kv[1], reverse=True)[:CONVERSATION_ERROR_TYPE_LIMIT]
    ]

    conv_rows = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .filter(exists().where((Message.conversation_id == Conversation.id) & (Message.role == "user")))
        .order_by(Conversation.updated_at.desc())
        .limit(CONVERSATION_HISTORY_LIMIT)
        .all()
    )
    scenario_ids = {c.scenario_id for c in conv_rows if c.scenario_id}
    scenarios_by_id = {
        s.id: s for s in db.query(ChatScenario).filter(ChatScenario.id.in_(scenario_ids))
    } if scenario_ids else {}

    conversations = []
    for c in conv_rows:
        turns, first, last = agg_by_conversation.get(c.id, (0, c.created_at, c.updated_at))
        scenario = scenarios_by_id.get(c.scenario_id) if c.scenario_id else None
        conversations.append(AdminUserConversationSummary(
            id=c.id, title=c.title, scenario_title=scenario.title if scenario else None,
            scenario_level=scenario.level if scenario else None,
            message_count=turns, error_count=error_count_by_conversation.get(c.id, 0),
            started_at=first or c.created_at, last_message_at=last or c.updated_at,
        ))

    insight_message = None
    if top_error_types:
        top = top_error_types[0]
        insight_message = (
            f'Học viên mắc lỗi "{top.error_type}" nhiều nhất trong hội thoại '
            f"({top.count} lần, chiếm {top.percent:.0f}% tổng số lỗi ngữ pháp được ghi nhận)."
        )
        if off_topic_rate:
            insight_message += f" {off_topic_rate:.0f}% phản hồi của AI ghi nhận học viên trả lời lạc đề."

    return AdminUserConversationDetail(
        total_conversations=total_conversations, total_messages_sent=total_messages_sent,
        total_duration_minutes=round(total_duration_seconds / 60),
        grammar_checks=grammar_checks, total_errors=total_errors,
        correct_message_rate=correct_message_rate, off_topic_rate=off_topic_rate,
        conversations=conversations, top_error_types=top_error_types, insight_message=insight_message,
    )


@router.get("/{user_id}/conversation", response_model=AdminUserConversationDetail)
def get_user_conversation_detail(user_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    return _conversation_detail(db, user)


@router.get("/{user_id}/conversation/{conversation_id}", response_model=ConversationDetail)
def get_user_conversation_transcript(
    user_id: int, conversation_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    """Full message transcript for one conversation — "Xem transcript".
    Mirrors routes/chat.py's own get_conversation (learner-facing), scoped to
    the target user_id instead of the caller."""
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id, Conversation.user_id == user_id,
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc hội thoại")

    scenario = (
        db.query(ChatScenario).filter(ChatScenario.id == conversation.scenario_id).first()
        if conversation.scenario_id else None
    )
    messages = (
        db.query(Message).filter(Message.conversation_id == conversation.id).order_by(Message.id).all()
    )

    message_details = []
    for m in messages:
        grammar = None
        if m.correction:
            grammar = GrammarNote(
                corrected_text=m.correction.corrected_text, diffs=m.correction.errors or [],
                error_count=m.correction.error_count or 0, has_errors=bool(m.correction.explanation),
                explanation=m.correction.explanation or [],
            )
        message_details.append(MessageDetail(
            id=m.id, role=m.role, content=m.content, feedback=m.feedback, is_off_topic=m.is_off_topic,
            grammar=grammar, created_at=m.created_at.isoformat() + "Z" if m.created_at else "",
        ))

    return ConversationDetail(
        id=conversation.id, title=conversation.title, scenario_id=conversation.scenario_id,
        scenario_title=scenario.title if scenario else None,
        situation_context=conversation.situation_context, messages=message_details,
    )


@router.delete("/{user_id}/conversation/grammar-history", response_model=AdminUserConversationDetail)
def clear_user_conversation_grammar_history(
    user_id: int, db: Session = Depends(get_db), admin: UserResponse = Depends(require_admin),
):
    """Wipes this user's conversation-linked grammar-correction history
    (GrammarCorrection rows with message_id set) — "Đặt lại dữ liệu ngữ pháp
    cần ôn". The messages/conversations themselves are untouched; only the
    grading data resets, same scoping the vocabulary SRS reset uses for its
    own domain."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    deleted_count = db.query(GrammarCorrection).filter(
        GrammarCorrection.user_id == user_id, GrammarCorrection.message_id.isnot(None),
    ).delete(synchronize_session=False)
    log_event(
        db, subject_user_id=user.id, action="admin.conversation_grammar_reset",
        description=f"Dữ liệu ngữ pháp hội thoại được đặt lại bởi quản trị viên @{admin.username}",
        actor_user_id=admin.id, actor_role="admin", extra_data={"deleted_count": deleted_count},
    )
    db.commit()
    return _conversation_detail(db, user)


@router.get("/{user_id}/activity", response_model=List[AdminActivityEntry])
def get_user_activity(
    user_id: int, limit: int = Query(6, ge=1, le=50),
    db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    """Recent audit-log entries for this user — both admin actions on their
    account and their own learning activity (login, daily goal, achievements,
    AI conversations, JLPT tests). Feeds "Hoạt động gần đây" on the overview
    tab today, and will back the dedicated audit log tab later."""
    if not db.query(User.id).filter(User.id == user_id).first():
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    rows = (
        db.query(AuditLog)
        .filter(AuditLog.subject_user_id == user_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        AdminActivityEntry(
            id=r.id, action=r.action, description=r.description,
            actor_role=r.actor_role, created_at=r.created_at,
        )
        for r in rows
    ]


@router.patch("/{user_id}/unlock", response_model=AdminUserDetail)
def unlock_user(user_id: int, db: Session = Depends(get_db), admin: UserResponse = Depends(require_admin)):
    user = db.query(User).options(joinedload(User.role), joinedload(User.information)).filter(
        User.id == user_id,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    user.is_active = True
    user.locked_reason = None
    user.locked_at = None
    log_event(
        db, subject_user_id=user.id, action="admin.user_unlocked",
        description=f"Tài khoản được mở khóa bởi quản trị viên @{admin.username}",
        actor_user_id=admin.id, actor_role="admin",
    )
    db.commit()
    db.refresh(user)
    return _detail(db, user)
