"""Writes AuditLog rows for admin actions and learner activity — see
app/models/audit_log.py for what the table captures and why. `log_event`
only `db.add()`s the row; it never commits, so the write always lands in the
same transaction as the action that triggered it (and is rolled back with it
if that action fails).
"""
import json
from datetime import date, datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_event(
    db: Session,
    *,
    subject_user_id: int,
    action: str,
    description: str,
    actor_user_id: Optional[int] = None,
    actor_role: Optional[str] = None,
    extra_data: Optional[dict] = None,
) -> None:
    db.add(AuditLog(
        actor_user_id=actor_user_id,
        actor_role=actor_role,
        subject_user_id=subject_user_id,
        action=action,
        description=description,
        extra_data=json.dumps(extra_data, ensure_ascii=False) if extra_data else None,
    ))


def has_logged_today(db: Session, *, subject_user_id: int, action: str, today: date) -> bool:
    """Idempotency check for once-per-day events (e.g. reaching the daily vocab goal)."""
    day_start = datetime.combine(today, datetime.min.time())
    return db.query(AuditLog.id).filter(
        AuditLog.subject_user_id == subject_user_id,
        AuditLog.action == action,
        AuditLog.created_at >= day_start,
    ).first() is not None
