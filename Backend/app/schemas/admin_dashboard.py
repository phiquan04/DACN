from datetime import datetime
from typing import List

from pydantic import BaseModel


class LevelDistributionItem(BaseModel):
    level: str  # 'N1'..'N5' or 'chua_xac_dinh'
    count: int
    percent: float


class ActivityPoint(BaseModel):
    iso_date: str
    new_users: int


class ActionItem(BaseModel):
    kind: str  # 'vocabulary_set' | 'jlpt_exam' | 'chat_scenario'
    id: int
    title: str
    subtitle: str
    badge: str
    created_at: datetime


class ResourceBar(BaseModel):
    label: str
    current: int
    total: int


class AdminOverviewOut(BaseModel):
    total_users: int
    new_users_7d: int
    active_users_7d: int
    pending_vocabulary_sets: int
    pending_jlpt_exams: int
    chats_today: int
    level_distribution: List[LevelDistributionItem]
    activity_last_7_days: List[ActivityPoint]
    action_items: List[ActionItem]
    resources: List[ResourceBar]
