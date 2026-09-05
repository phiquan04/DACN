from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey

from .base import BaseModel


class Notification(BaseModel):
    """A single in-app notification for a user (shown in the header bell).
    `related_code` is an idempotency key — e.g. an achievement code — so the
    same real-world event (see vocabulary/learning.py's level-up and
    achievement checks) never gets notified twice."""
    __tablename__ = 'notifications'

    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    type = Column(String(30), nullable=False)  # 'level_up' | 'achievement' | 'email_verified'
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    link = Column(String(255), nullable=True)  # frontend route to open on click
    related_code = Column(String(50), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)

    def __repr__(self):
        return f'<Notification user={self.user_id} type={self.type}>'
