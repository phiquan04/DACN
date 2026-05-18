from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Float, Boolean
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
import os

DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./chatbot.db')

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=os.getenv('ENVIRONMENT', 'development') == 'development'
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base for models
Base = declarative_base()


def init_db(app):
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class BaseModel(Base):
    __abstract__ = True
    
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class User(BaseModel):
    __tablename__ = 'users'
    
    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    
    conversations = relationship('Conversation', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<User {self.username}>'


class Conversation(BaseModel):
    __tablename__ = 'conversations'
    
    title = Column(String(255), nullable=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    language = Column(String(10), default='ja')
    
    messages = relationship('Message', backref='conversation', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Conversation {self.id}>'


class Message(BaseModel):
    """Message model - individual chat messages"""
    __tablename__ = 'messages'
    
    conversation_id = Column(Integer, ForeignKey('conversations.id'), nullable=True)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    language = Column(String(10), default='ja')
    confidence = Column(Float, nullable=True)
    
    correction = relationship('GrammarCorrection', backref='message', uselist=False, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Message {self.id}>'


class GrammarCorrection(BaseModel):
    """Grammar correction history model"""
    __tablename__ = 'grammar_corrections'
    
    message_id = Column(Integer, ForeignKey('messages.id'), nullable=False)
    original_text = Column(Text, nullable=False)
    corrected_text = Column(Text, nullable=False)
    errors = Column(JSON, nullable=True)  # Store error details
    confidence = Column(Float, nullable=True)
    error_count = Column(Integer, default=0)
    
    def __repr__(self):
        return f'<GrammarCorrection {self.id}>'


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


class Exam(Base):
    __tablename__ = 'exams'

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    level = Column(String(10))
    year = Column(Integer)
    month = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    questions = relationship(
        'Question',
        back_populates='exam',
        cascade='all, delete-orphan'
    )


class Question(Base):
    __tablename__ = 'questions'

    id = Column(Integer, primary_key=True)
    exam_id = Column(Integer, ForeignKey('exams.id', ondelete='CASCADE'))
    section = Column(String(100))
    question_no = Column(Integer)
    question_text = Column(Text, nullable=False)
    image_url = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    exam = relationship('Exam', back_populates='questions')

    choices = relationship(
        'Choice',
        back_populates='question',
        cascade='all, delete-orphan'
    )

    answer = relationship(
        'Answer',
        back_populates='question',
        uselist=False,
        cascade='all, delete-orphan'
    )


class Choice(Base):
    __tablename__ = 'choices'

    id = Column(Integer, primary_key=True)
    question_id = Column(Integer, ForeignKey('questions.id', ondelete='CASCADE'))
    choice_no = Column(Integer, nullable=False)
    choice_text = Column(Text, nullable=False)

    question = relationship('Question', back_populates='choices')


class Answer(Base):
    __tablename__ = 'answers'

    id = Column(Integer, primary_key=True)
    question_id = Column(Integer, ForeignKey('questions.id', ondelete='CASCADE'), unique=True)
    correct_no = Column(Integer, nullable=False)
    explanation = Column(Text)

    question = relationship('Question', back_populates='answer')
    
    def __repr__(self):
        return f'<Answer correct={self.correct_no} (question={self.question_id})>'
    
    
class SearchHistory(Base):
    __tablename__ = 'search_history'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    word = Column(String(255), nullable=False)
    reading = Column(String(255), nullable=True)
    meaning = Column(Text, nullable=True)          # Nghĩa tiếng Việt (lấy từ definition đầu tiên)
    examples = Column(JSON, default=list)          # Lưu list [{japanese, vietnamese}]
    synonyms = Column(JSON, default=list)          # Lưu list [string]
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship('User', backref='search_history')

class UserInformation(Base):
    __tablename__ = 'user_information'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), unique=True, nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    facebook_link = Column(String(255), nullable=True)
    instagram_link = Column(String(255), nullable=True)
    country = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship('User', backref='information', uselist=False)