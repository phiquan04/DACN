from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base, BaseModel


class TranscriptionSession(BaseModel):
    __tablename__ = 'transcription_sessions'

    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    source_url = Column(String(512), nullable=True)
    source_type = Column(String(50), default='youtube')  # 'youtube' or 'file'
    status = Column(String(50), default='pending')  # pending, processing, completed, failed
    error_message = Column(Text, nullable=True)
    segment_count = Column(Integer, default=0)
    duration_ms = Column(Integer, nullable=True)

    # YouTube video metadata — only set for source_type='youtube', lets the
    # "Lịch sử video" page re-render the player + card without another
    # youtube-search/videos.list round trip.
    video_id = Column(String(32), nullable=True)
    video_title = Column(Text, nullable=True)
    channel_id = Column(String(64), nullable=True)
    channel_title = Column(String(255), nullable=True)
    thumbnail = Column(String(512), nullable=True)

    # Relationships
    segments = relationship('TranscriptionSegment', backref='session', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<TranscriptionSession {self.id}>'


class TranscriptionSegment(Base):
    __tablename__ = 'transcription_segments'

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('transcription_sessions.id'), nullable=False)
    start_time = Column(Float, nullable=False)  # In seconds
    end_time = Column(Float, nullable=False)
    japanese_text = Column(Text, nullable=False)
    vietnamese_text = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)

    def __repr__(self):
        return f'<TranscriptionSegment {self.id}>'
