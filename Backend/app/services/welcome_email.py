"""The one-off welcome email sent right after signup.

Separate from services/email_verification.py's OTP email — that one asks the
learner to prove they own the address; this one just welcomes them and points
them at the profile page for study-reminder emails. Best-effort like the rest
of this app's outgoing mail: a failed send must never fail the signup.
"""
from app.models.user import User
from app.services.email_sender import send_email


def _render_email(username: str) -> str:
    return f"""\
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#122B52">
  <h2 style="font-size:20px;font-weight:600;margin:0 0 12px">Chào mừng bạn đến với Manabi AI!</h2>
  <p style="font-size:14px;line-height:1.6;color:#536B8D;margin:0 0 16px">
    Chào {username}, cảm ơn bạn đã đăng ký tài khoản trên Manabi AI — nền tảng học tiếng Nhật
    cùng AI. Chúc bạn có những giờ học thật hiệu quả!
  </p>
  <p style="font-size:14px;line-height:1.6;color:#536B8D;margin:0">
    Nếu muốn đặt lịch nhắc nhở học tập qua email, hãy vào mục
    <strong>Hồ sơ cá nhân</strong> để bật thông báo và chọn giờ nhắc nhở trong ngày.
  </p>
</div>"""


def send_welcome_email(user: User) -> bool:
    """Send the welcome email. Returns True/False, never raises — same
    best-effort contract as send_email itself."""
    return send_email(
        to=user.email,
        subject="Chào mừng bạn đến với Manabi AI",
        html_body=_render_email(user.username),
    )
