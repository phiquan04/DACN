from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class AdminUserSummary(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    locked_reason: Optional[str] = None
    locked_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    current_jlpt_level: Optional[str] = None
    vocab_xp: int = 0
    level: int = 1
    streak_days: int = 0


class AdminUserListPage(BaseModel):
    items: List[AdminUserSummary]
    total: int
    page: int
    page_size: int


class AdminUserDetail(AdminUserSummary):
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    target_jlpt_level: Optional[str] = None
    last_activity_at: Optional[datetime] = None
    total_study_minutes: int = 0
    level_xp_floor: int = 0  # total XP at which the current level started
    level_xp_ceil: int = 100  # total XP needed to reach the next level
    daily_vocab_goal: Optional[int] = None
    profile_updated_at: Optional[datetime] = None  # UserInformation.updated_at — last profile edit, real timestamp (not a full audit trail)
    xp_percentile_top: int = 100  # this user is in the top N% of all users by vocab_xp (lower = more XP than peers)
    admin_note: Optional[str] = None  # internal note, admin-only


class AdminUserLockRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=255)


class AdminUserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=80)
    email: str = Field(..., pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    password: str = Field(..., min_length=8)
    role: str = Field(default="user")
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class AdminUserUpdateRequest(BaseModel):
    """Partial update of an existing user's role + profile — everything an
    admin can edit except identity (username/email) and lock state (which
    go through their own dedicated endpoints)."""
    role: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    current_jlpt_level: Optional[str] = None
    target_jlpt_level: Optional[str] = None
    daily_vocab_goal: Optional[int] = None
    admin_note: Optional[str] = None


class AdminPasswordResetResponse(BaseModel):
    temporary_password: str


class AdminUserVocabularyStats(BaseModel):
    learned: int = 0
    reviewing: int = 0
    new: int = 0
    total_reviews: int = 0
    studied_today: int = 0  # distinct words reviewed today (UTC) — used for the daily-goal progress bar


class AdminUserJlptStats(BaseModel):
    attempts: int = 0
    completed: int = 0
    average_score: Optional[float] = None
    best_score: Optional[int] = None
    last_attempt_at: Optional[datetime] = None


class AdminUserConversationStats(BaseModel):
    conversations: int = 0
    messages_sent: int = 0
    grammar_checks: int = 0
    average_errors: Optional[float] = None


class AdminUserListeningDictionaryStats(BaseModel):
    transcription_sessions: int = 0
    transcription_completed: int = 0
    dictionary_searches: int = 0


class AdminUserLearningStats(BaseModel):
    vocabulary: AdminUserVocabularyStats
    jlpt: AdminUserJlptStats
    conversation: AdminUserConversationStats
    listening_dictionary: AdminUserListeningDictionaryStats


class AdminActivityEntry(BaseModel):
    """One row of the audit log — a real, persisted event (see
    app/models/audit_log.py), not a value derived from other tables."""
    id: int
    action: str
    description: str
    actor_role: Optional[str] = None
    created_at: datetime
