"""Issuing and checking the email-verification OTP.

Flow: the learner asks for a code (POST /auth/verify-email/send), receives a
6-digit number by email, and types it back (POST /auth/verify-email/confirm).
On success `User.email_verified` flips to True, an audit-log row is written,
and every admin gets an in-app notification.

The plaintext code exists only long enough to be emailed — the row stores a
bcrypt hash (see models/email_verification.py). Three limits keep the code
from being brute-forced or spammed: a resend cooldown, a short expiry, and a
cap on wrong guesses per code.
"""
import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.models.email_verification import EmailVerificationCode
from app.models.notification import Notification
from app.models.user import Role, User
from app.services.audit_log import log_event
from app.services.email_sender import is_configured, send_email
from app.utils.auth import hash_password, verify_password

logger = logging.getLogger(__name__)

CODE_TTL_MINUTES = 10  # how long an issued code stays usable
RESEND_COOLDOWN_SECONDS = 60  # minimum gap between two "send me a code" requests
MAX_ATTEMPTS = 5  # wrong guesses before a code is burned and must be re-sent


def _generate_code() -> str:
    """A 6-digit code, zero-padded so every code is the same length.
    `secrets` (not `random`) because this is a credential."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _active_code(db: Session, user_id: int) -> Optional[EmailVerificationCode]:
    """The user's most recent code that is still usable (not consumed, not
    expired, not out of attempts), or None."""
    now = datetime.utcnow()
    return (
        db.query(EmailVerificationCode)
        .filter(
            EmailVerificationCode.user_id == user_id,
            EmailVerificationCode.consumed_at.is_(None),
            EmailVerificationCode.expires_at > now,
            EmailVerificationCode.attempts < MAX_ATTEMPTS,
        )
        .order_by(EmailVerificationCode.created_at.desc())
        .first()
    )


def _render_email(username: str, code: str) -> str:
    return f"""\
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#122B52">
  <h2 style="font-size:20px;font-weight:600;margin:0 0 12px">Xác minh địa chỉ email</h2>
  <p style="font-size:14px;line-height:1.6;color:#536B8D;margin:0 0 20px">
    Chào {username}, đây là mã xác minh email cho tài khoản Manabi AI của bạn.
    Nhập mã này vào ứng dụng để hoàn tất xác minh.
  </p>
  <p style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;
            background:#F3F6FA;border-radius:12px;padding:20px;margin:0 0 20px">{code}</p>
  <p style="font-size:13px;line-height:1.6;color:#8294AF;margin:0">
    Mã có hiệu lực trong {CODE_TTL_MINUTES} phút. Nếu bạn không yêu cầu mã này,
    bạn có thể bỏ qua email — tài khoản của bạn vẫn an toàn.
  </p>
</div>"""


def send_verification_code(db: Session, user: User) -> Tuple[bool, str]:
    """Issue a fresh code and email it. Returns (ok, message); the message is
    Vietnamese and safe to show the user. Does not commit — the caller owns
    the transaction."""
    if user.email_verified:
        return False, "Email này đã được xác minh."
    if not is_configured():
        return False, "Máy chủ chưa cấu hình gửi email. Vui lòng liên hệ quản trị viên."

    existing = _active_code(db, user.id)
    if existing:
        age = (datetime.utcnow() - existing.created_at).total_seconds()
        if age < RESEND_COOLDOWN_SECONDS:
            wait = int(RESEND_COOLDOWN_SECONDS - age)
            return False, f"Vui lòng đợi {wait} giây trước khi yêu cầu mã mới."
        # Past the cooldown the user is asking for a genuinely new code —
        # retire the old one so only the newest is ever valid.
        existing.consumed_at = datetime.utcnow()

    code = _generate_code()
    db.add(EmailVerificationCode(
        user_id=user.id,
        code_hash=hash_password(code),
        expires_at=datetime.utcnow() + timedelta(minutes=CODE_TTL_MINUTES),
    ))

    sent = send_email(
        to=user.email,
        subject=f"Mã xác minh email Manabi AI: {code}",
        html_body=_render_email(user.username, code),
    )
    if not sent:
        return False, "Không gửi được email. Vui lòng thử lại sau ít phút."
    return True, f"Đã gửi mã xác minh tới {user.email}."


def confirm_verification_code(db: Session, user: User, code: str) -> Tuple[bool, str]:
    """Check a submitted code and, if it matches, mark the email verified,
    audit-log it, and notify every admin. Does not commit — but the caller
    must commit even on failure, so the incremented attempt counter sticks."""
    if user.email_verified:
        return False, "Email này đã được xác minh."

    entry = _active_code(db, user.id)
    if not entry:
        return False, "Mã đã hết hạn hoặc không tồn tại. Hãy yêu cầu mã mới."

    if not verify_password(code.strip(), entry.code_hash):
        entry.attempts += 1
        remaining = MAX_ATTEMPTS - entry.attempts
        if remaining <= 0:
            return False, "Bạn đã nhập sai quá số lần cho phép. Hãy yêu cầu mã mới."
        return False, f"Mã không đúng. Bạn còn {remaining} lần thử."

    now = datetime.utcnow()
    entry.consumed_at = now
    user.email_verified = True

    log_event(
        db, subject_user_id=user.id, action="auth.email_verified",
        description="Xác minh địa chỉ email thành công",
        actor_user_id=user.id, actor_role=user.role.code if user.role else "user",
    )
    _notify_admins(db, user)
    return True, "Xác minh email thành công."


def _notify_admins(db: Session, user: User) -> None:
    """Drop an in-app notification for every admin account. Admins are looked
    up by role rather than from a configured address list, so adding an admin
    automatically subscribes them."""
    admin_ids = [
        row[0] for row in
        db.query(User.id).join(Role, User.role_id == Role.id).filter(
            Role.code == "admin", User.is_active.is_(True),
        ).all()
    ]
    for admin_id in admin_ids:
        db.add(Notification(
            user_id=admin_id,
            type="email_verified",
            title="Học viên đã xác minh email",
            message=f"@{user.username} ({user.email}) vừa xác minh địa chỉ email.",
            link=f"/admin/users?user={user.id}",
        ))
