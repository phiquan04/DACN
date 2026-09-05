"""Outgoing transactional email over Gmail SMTP.

Configured through two env vars (see Backend/.env), following the same
plain `os.getenv()` pattern as app/utils/cloudinary.py:

    EMAIL_HOST_USER          the Gmail address that sends the mail
    EMAIL_HOST_APP_PASSWORD  a Google App Password, NOT the account password

Sending is deliberately best-effort: `send_email` returns a bool and never
raises, so a mail outage can't turn a successful signup into a 500. Callers
decide what to do with a False (usually: tell the user to try again).
"""
import logging
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587  # STARTTLS
SMTP_TIMEOUT_SECONDS = 15

FROM_NAME = "Manabi AI"


def is_configured() -> bool:
    """Whether credentials are present. Lets callers surface a clear "email
    isn't set up on this server" message instead of a generic failure."""
    return bool(os.getenv("EMAIL_HOST_USER") and os.getenv("EMAIL_HOST_APP_PASSWORD"))


def send_email(to: str, subject: str, html_body: str, text_body: str = "") -> bool:
    """Send one email. Returns True on success, False on any failure (missing
    config, auth rejected, network error) — never raises."""
    sender = os.getenv("EMAIL_HOST_USER")
    password = os.getenv("EMAIL_HOST_APP_PASSWORD")
    if not sender or not password:
        logger.warning("Email not sent to %s: EMAIL_HOST_USER/EMAIL_HOST_APP_PASSWORD not configured", to)
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{FROM_NAME} <{sender}>"
    message["To"] = to
    # A plain-text part first, then HTML as the preferred alternative — mail
    # clients that can't render HTML still get a readable message.
    message.set_content(text_body or _strip_tags(html_body))
    message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as smtp:
            smtp.starttls()
            smtp.login(sender, password)
            smtp.send_message(message)
        return True
    except Exception:
        # Includes SMTPAuthenticationError (wrong/expired App Password) and
        # plain socket timeouts. Logged with the traceback but swallowed.
        logger.exception("Failed to send email to %s", to)
        return False


def _strip_tags(html: str) -> str:
    """Crude HTML -> text fallback for the plain-text part. Our own templates
    are the only input, so a full parser would be overkill."""
    import re

    text = re.sub(r"<br\s*/?>|</p>|</div>|</tr>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()
