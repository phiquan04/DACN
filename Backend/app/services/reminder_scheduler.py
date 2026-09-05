"""Background job that emails learners a study reminder at the times they
registered from their profile page (see app/routes/user.py's
/user/reminder-settings). Runs in-process via APScheduler — this app has no
Celery/cron infrastructure, so a BackgroundScheduler started alongside the
FastAPI app (see main.py) is the simplest way to get a periodic job.

Reminder times are stored and compared as naive local time-of-day (like the
rest of this codebase's non-audit timestamps), so this assumes the backend
runs in the learners' own timezone.
"""
import logging
from datetime import datetime
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler

from app.models.database import SessionLocal
from app.models.reminder import ReminderTime
from app.models.user import User
from app.services.email_sender import send_email

logger = logging.getLogger(__name__)

CHECK_INTERVAL_SECONDS = 60


def _render_email(username: str) -> str:
    return f"""\
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#122B52">
  <h2 style="font-size:20px;font-weight:600;margin:0 0 12px">Đến giờ học tiếng Nhật rồi!</h2>
  <p style="font-size:14px;line-height:1.6;color:#536B8D;margin:0">
    Chào {username}, đây là lời nhắc bạn đã đặt trên Manabi AI. Dành vài phút ôn từ vựng,
    ngữ pháp hoặc luyện hội thoại AI ngay bây giờ nhé!
  </p>
</div>"""


def _check_and_send() -> None:
    """Runs every minute: emails everyone whose reminder time-of-day matches
    the current clock time (to the minute) and who hasn't already been
    emailed for that slot today."""
    now = datetime.now()
    today = now.date()
    current_time = now.time().replace(second=0, microsecond=0)

    db = SessionLocal()
    try:
        due = (
            db.query(ReminderTime)
            .join(User, User.id == ReminderTime.user_id)
            .filter(
                User.reminder_emails_enabled.is_(True),
                User.is_active.is_(True),
                ReminderTime.time_of_day == current_time,
            )
            .filter((ReminderTime.last_sent_on.is_(None)) | (ReminderTime.last_sent_on < today))
            .all()
        )
        for reminder in due:
            user = db.query(User).filter(User.id == reminder.user_id).first()
            if not user:
                continue
            sent = send_email(
                to=user.email,
                subject="Đến giờ học tiếng Nhật rồi!",
                html_body=_render_email(user.username),
            )
            if sent:
                reminder.last_sent_on = today
                db.commit()
            else:
                db.rollback()
    finally:
        db.close()


_scheduler: Optional[BackgroundScheduler] = None


def start_reminder_scheduler() -> None:
    """Idempotent: safe to call more than once — only the first call actually
    starts a scheduler."""
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(_check_and_send, "interval", seconds=CHECK_INTERVAL_SECONDS, id="reminder_emails")
    _scheduler.start()
    logger.info("Reminder email scheduler started")


def stop_reminder_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
