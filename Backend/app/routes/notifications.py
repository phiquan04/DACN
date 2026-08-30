"""Generic in-app notification API, replacing the frontend's old placeholder
demo dropdown. The only producer today is vocabulary/learning.py (level-ups
and newly earned achievements) — this module just exposes the read-side
(list / unread count / mark read) so other features can start writing
Notification rows the same way later.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import UserResponse, get_current_user
from app.models.database import get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationOut, UnreadCountOut

router = APIRouter(prefix="/notifications", tags=["notifications"])

LIST_LIMIT = 30


def _notification_out(n: Notification) -> NotificationOut:
    return NotificationOut(
        id=n.id, type=n.type, title=n.title, message=n.message, link=n.link,
        is_read=n.is_read, created_at=n.created_at,
    )


@router.get("", response_model=List[NotificationOut])
def list_notifications(db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(LIST_LIMIT)
        .all()
    )
    return [_notification_out(n) for n in rows]


@router.get("/unread-count", response_model=UnreadCountOut)
def get_unread_count(db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    count = db.query(func.count(Notification.id)).filter(
        Notification.user_id == current_user.id, Notification.is_read.is_(False),
    ).scalar() or 0
    return UnreadCountOut(unread_count=count)


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: int, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    n = db.query(Notification).filter(
        Notification.id == notification_id, Notification.user_id == current_user.id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông báo")
    n.is_read = True
    db.commit()
    db.refresh(n)
    return _notification_out(n)


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    db.query(Notification).filter(
        Notification.user_id == current_user.id, Notification.is_read.is_(False),
    ).update({Notification.is_read: True})
    db.commit()
    return {"ok": True}
