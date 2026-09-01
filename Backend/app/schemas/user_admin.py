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
    streak_days: int = 0
    last_activity_at: Optional[datetime] = None
    total_study_minutes: int = 0
    vocab_xp: int = 0
    level: int = 1
    level_xp_floor: int = 0  # total XP at which the current level started
    level_xp_ceil: int = 100  # total XP needed to reach the next level
    daily_vocab_goal: Optional[int] = None
    profile_updated_at: Optional[datetime] = None  # UserInformation.updated_at — last profile edit, real timestamp (not a full audit trail)


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


class AdminPasswordResetResponse(BaseModel):
    temporary_password: str
