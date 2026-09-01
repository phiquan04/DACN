from datetime import datetime

from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey
from sqlalchemy.orm import backref, relationship

from .base import Base


class UserInformation(Base):
    __tablename__ = 'user_information'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), unique=True, nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    country = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(10), nullable=True)
    current_jlpt_level = Column(String(10), nullable=True)  # 'N1'..'N5'
    target_jlpt_level = Column(String(10), nullable=True)  # 'N1'..'N5'
    streak_days = Column(Integer, nullable=False, default=0)
    last_activity_at = Column(DateTime, nullable=True)
    total_study_minutes = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # unique=True on user_id makes this a true one-to-one — uselist=False on
    # both sides so `user.information` is the single row, not a list.
    user = relationship('User', backref=backref('information', uselist=False), uselist=False)
