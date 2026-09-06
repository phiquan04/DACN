from sqlalchemy import Column, Date, ForeignKey, Integer, Time
from sqlalchemy.orm import backref, relationship

from .base import BaseModel


class ReminderTime(BaseModel):
    """One study-reminder time-of-day a user registered from their profile
    page (up to 5 per user, enforced in app/routes/user.py). The background
    scheduler (see app/services/reminder_scheduler.py) scans these every
    minute and emails whoever's chosen time-of-day matches the current clock
    time, then stamps `last_sent_on` so the same slot can't fire twice in the
    same day."""
    __tablename__ = 'reminder_times'

    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    time_of_day = Column(Time, nullable=False)
    last_sent_on = Column(Date, nullable=True)

    user = relationship('User', backref=backref('reminder_times', cascade='all, delete-orphan'))

    def __repr__(self):
        return f'<ReminderTime user={self.user_id} time={self.time_of_day}>'
