"""Generic in-app notification API, replacing the frontend's old placeholder
demo dropdown. Producers (vocabulary/learning.py, services/email_verification.py)
just insert Notification rows — this module exposes the read-side (list /
unread count / mark read) plus a Server-Sent Events stream that pushes new
notifications to open tabs as they're committed (see
app/services/notification_hub.py).
"""
import asyncio
import json
import time
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import UserResponse, get_current_user
from app.models.database import SessionLocal, get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationOut, UnreadCountOut
from app.services.notification_hub import CLOSE, TooManyStreams, notification_hub

router = APIRouter(prefix="/notifications", tags=["notifications"])

LIST_LIMIT = 30
# A comment line this often keeps proxies/load balancers from closing an
# otherwise idle stream.
HEARTBEAT_SECONDS = 20
# How often an open stream re-checks its token: catches expiry (access tokens
# last 30 min) and revocation (logout elsewhere, password change, account
# lock). The stream then ends and the client reconnects, refreshing its token.
REVALIDATE_SECONDS = 300


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


def _unread_count(db: Session, user_id: int) -> int:
    return db.query(func.count(Notification.id)).filter(
        Notification.user_id == user_id, Notification.is_read.is_(False),
    ).scalar() or 0


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# The stream can't use Depends(get_current_user)/Depends(get_db): a yield
# dependency stays open until the response finishes, which for a stream means
# holding a pooled DB connection for as long as the tab is open. Each DB touch
# below opens and closes its own short session instead.
def _authenticate(authorization: Optional[str]) -> UserResponse:
    db = SessionLocal()
    try:
        return get_current_user(authorization, db)
    finally:
        db.close()


def _fresh_unread_count(user_id: int) -> int:
    db = SessionLocal()
    try:
        return _unread_count(db, user_id)
    finally:
        db.close()


@router.get("/stream")
async def stream_notifications(authorization: Optional[str] = Header(None)):
    """Server-Sent Events. Events, each carrying the fresh unread count so the
    client just overwrites its badge (no drift from missed/duplicate events):
    - "ready"        {unread_count} — once, right after connecting
    - "notification" {notification, unread_count} — a new row was committed
    - "unread_count" {unread_count} — read state changed (e.g. in another tab)
    The browser's EventSource can't send an Authorization header, so the
    frontend reads this with fetch() instead (see notificationApi.ts)."""
    user = await run_in_threadpool(_authenticate, authorization)
    if not notification_hub.has_capacity(user.id):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Quá nhiều kết nối thông báo đang mở")

    async def event_stream():
        # Subscribe inside the generator, not before returning the response:
        # a client that disconnects before the body starts never runs the
        # generator, so its `finally` (the unsubscribe) would never run either.
        try:
            queue = notification_hub.subscribe(user.id)
        except TooManyStreams:
            return  # lost a race for the last slot since has_capacity()
        try:
            count = await run_in_threadpool(_fresh_unread_count, user.id)
            yield _sse("ready", {"unread_count": count})

            revalidate_at = time.monotonic() + REVALIDATE_SECONDS
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                else:
                    if item is CLOSE:
                        return
                    event_name, payload = item
                    count = await run_in_threadpool(_fresh_unread_count, user.id)
                    data = {"unread_count": count}
                    if payload is not None:
                        data["notification"] = payload
                    yield _sse(event_name, data)

                if time.monotonic() >= revalidate_at:
                    try:
                        await run_in_threadpool(_authenticate, authorization)
                    except HTTPException:
                        return
                    revalidate_at = time.monotonic() + REVALIDATE_SECONDS
        finally:
            notification_hub.unsubscribe(user.id, queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        # no-cache: never serve a stream from cache; X-Accel-Buffering: stop
        # nginx (if it ever proxies /api) from batching events.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/unread-count", response_model=UnreadCountOut)
def get_unread_count(db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return UnreadCountOut(unread_count=_unread_count(db, current_user.id))


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
    notification_hub.publish(current_user.id, "unread_count")
    return _notification_out(n)


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    db.query(Notification).filter(
        Notification.user_id == current_user.id, Notification.is_read.is_(False),
    ).update({Notification.is_read: True})
    db.commit()
    notification_hub.publish(current_user.id, "unread_count")
    return {"ok": True}
