from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base, BaseModel


class TranscriptionSession(BaseModel):
    __tablename__ = 'transcription_sessions'

    source_url = Column(String(512), nullable=True)
    source_type = Column(String(50), default='youtube')  # 'youtube' or 'file'
    status = Column(String(50), default='pending')  # pending, processing, completed, failed
    error_message = Column(Text, nullable=True)
    segment_count = Column(Integer, default=0)
    duration_ms = Column(Integer, nullable=True)

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
