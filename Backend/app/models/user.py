from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from .base import BaseModel


class Role(BaseModel):
    """A user role, e.g. 'admin' or 'user'."""
    __tablename__ = 'roles'

    code = Column(String(20), unique=True, nullable=False)  # 'admin', 'user'
    name = Column(String(50), nullable=False)  # display name, e.g. 'Quản trị viên'

    users = relationship('User', backref='role', lazy=True)

    def __repr__(self):
        return f'<Role {self.code}>'


class User(BaseModel):
    __tablename__ = 'users'

    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    role_id = Column(Integer, ForeignKey('roles.id'), nullable=True)
    daily_vocab_goal = Column(Integer, nullable=True)  # words/day target for the vocabulary library; None = use the default
    vocab_xp = Column(Integer, nullable=False, default=0)  # cumulative XP earned from vocabulary reviews; drives the level shown in the library
    email_verified = Column(Boolean, nullable=False, default=False)  # set once the user confirms an emailed OTP (see services/email_verification.py)
    reminder_emails_enabled = Column(Boolean, nullable=False, default=False)  # opt-in for study-reminder emails, set from the profile page (see services/reminder_scheduler.py)
    last_login_at = Column(DateTime, nullable=True)
    last_seen_at = Column(DateTime, nullable=True)  # last heartbeat while the app was open; None once logged out — drives the admin "online now" status
    locked_reason = Column(String(255), nullable=True)
    locked_at = Column(DateTime, nullable=True)
    admin_note = Column(Text, nullable=True)  # internal, admin-only annotation — never shown to the user themself

    conversations = relationship('Conversation', backref='user', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<User {self.username}>'
