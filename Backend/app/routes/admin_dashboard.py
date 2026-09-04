"""Admin overview dashboard: the stat cards, new-user trend, JLPT level
spread and review backlog shown on the admin console's landing page
(Tổng quan). All numbers are computed live from the same tables the other
admin screens manage — nothing here is sample data."""
from datetime import date, datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import UserResponse, require_admin
from app.models.chat import ChatScenario, Message
from app.models.database import get_db
from app.models.jlpt import JlptExam
from app.models.profile import UserInformation
from app.models.user import User
from app.models.vocabulary import VocabularyItem, VocabularySet
from app.schemas.admin_dashboard import (
    ActionItem, ActivityPoint, AdminOverviewOut, LevelDistributionItem, ResourceBar,
)

router = APIRouter(prefix="/admin/dashboard", tags=["admin-dashboard"])

JLPT_LEVELS = ["N1", "N2", "N3", "N4", "N5"]
ACTION_ITEMS_LIMIT = 5


@router.get("/overview", response_model=AdminOverviewOut)
def get_overview(db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    now = datetime.utcnow()
    today_start = datetime.combine(date.today(), datetime.min.time())
    week_ago = now - timedelta(days=7)

    total_users = db.query(User).count()
    new_users_7d = db.query(User).filter(User.created_at >= week_ago).count()
    active_users_7d = db.query(UserInformation).filter(UserInformation.last_activity_at >= week_ago).count()
    pending_vocabulary_sets = db.query(VocabularySet).filter(VocabularySet.status == "draft").count()
    pending_jlpt_exams = db.query(JlptExam).filter(JlptExam.status == "draft").count()
    chats_today = (
        db.query(Message)
        .filter(Message.role == "user", Message.created_at >= today_start)
        .count()
    )

    level_counts = dict(
        db.query(UserInformation.current_jlpt_level, func.count(UserInformation.id))
        .filter(UserInformation.current_jlpt_level.in_(JLPT_LEVELS))
        .group_by(UserInformation.current_jlpt_level)
        .all()
    )
    classified_total = sum(level_counts.values()) or 1
    level_distribution: List[LevelDistributionItem] = [
        LevelDistributionItem(
            level=level, count=level_counts.get(level, 0),
            percent=round(level_counts.get(level, 0) / classified_total * 100, 1),
        )
        for level in JLPT_LEVELS
    ]

    activity_last_7_days: List[ActivityPoint] = []
    for i in range(6, -1, -1):
        day = date.today() - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)
        count = db.query(User).filter(User.created_at >= day_start, User.created_at < day_end).count()
        activity_last_7_days.append(ActivityPoint(iso_date=day.isoformat(), new_users=count))

    action_items: List[ActionItem] = []
    for s in (
        db.query(VocabularySet).filter(VocabularySet.status == "draft")
        .order_by(VocabularySet.created_at.desc()).limit(ACTION_ITEMS_LIMIT).all()
    ):
        action_items.append(ActionItem(
            kind="vocabulary_set", id=s.id, title=s.set_name, subtitle="Kho từ vựng",
            badge="Chờ duyệt", created_at=s.created_at,
        ))
    for e in (
        db.query(JlptExam).filter(JlptExam.status == "draft")
        .order_by(JlptExam.created_at.desc()).limit(ACTION_ITEMS_LIMIT).all()
    ):
        action_items.append(ActionItem(
            kind="jlpt_exam", id=e.id, title=e.title, subtitle="Ngân hàng đề JLPT",
            badge="Chờ duyệt", created_at=e.created_at,
        ))
    for c in (
        db.query(ChatScenario).filter(ChatScenario.is_active.is_(False))
        .order_by(ChatScenario.created_at.desc()).limit(ACTION_ITEMS_LIMIT).all()
    ):
        action_items.append(ActionItem(
            kind="chat_scenario", id=c.id, title=c.title, subtitle="Kịch bản chat",
            badge="Tạm ngưng", created_at=c.created_at,
        ))
    action_items.sort(key=lambda a: a.created_at, reverse=True)
    action_items = action_items[:ACTION_ITEMS_LIMIT]

    total_vocab_items = db.query(VocabularyItem).count()
    reviewed_vocab_items = db.query(VocabularyItem).filter(VocabularyItem.is_reviewed.is_(True)).count()
    total_scenarios = db.query(ChatScenario).count()
    active_scenarios = db.query(ChatScenario).filter(ChatScenario.is_active.is_(True)).count()
    total_exams = db.query(JlptExam).count()
    published_exams = db.query(JlptExam).filter(JlptExam.status == "published").count()

    resources = [
        ResourceBar(label="Từ vựng đã duyệt", current=reviewed_vocab_items, total=total_vocab_items),
        ResourceBar(label="Kịch bản chat đang dùng", current=active_scenarios, total=total_scenarios),
        ResourceBar(label="Đề JLPT đã duyệt", current=published_exams, total=total_exams),
    ]

    return AdminOverviewOut(
        total_users=total_users, new_users_7d=new_users_7d, active_users_7d=active_users_7d,
        pending_vocabulary_sets=pending_vocabulary_sets, pending_jlpt_exams=pending_jlpt_exams,
        chats_today=chats_today, level_distribution=level_distribution,
        activity_last_7_days=activity_last_7_days, action_items=action_items, resources=resources,
    )
