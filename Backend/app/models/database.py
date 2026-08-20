from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Float, Boolean
from sqlalchemy import create_engine
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
    _ensure_chat_schema()
    _seed_chat_scenarios()


def _ensure_chat_schema():
    """Idempotently add columns introduced after the initial table creation.

    This project has no migration framework (Alembic), and
    Base.metadata.create_all only creates missing tables — it never alters
    existing ones. Existing databases (SQLite locally, Postgres in other
    environments) need these columns added in place so they don't break on
    the new scenario-aware chat routes.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    if 'conversations' not in existing_tables or 'messages' not in existing_tables:
        return  # create_all just made everything fresh; nothing to migrate

    column_additions = {
        'conversations': [("scenario_id", "INTEGER REFERENCES chat_scenarios(id)")],
        'messages': [
            ("feedback", "TEXT"),
            ("is_off_topic", "BOOLEAN DEFAULT FALSE"),
        ],
    }
    with engine.connect() as conn:
        for table, columns in column_additions.items():
            existing_columns = {c['name'] for c in inspector.get_columns(table)}
            for col_name, col_def in columns:
                if col_name not in existing_columns:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"))
        conn.commit()


def _seed_chat_scenarios():
    db = SessionLocal()
    try:
        if db.query(ChatScenario).first():
            return
        db.add_all([
            ChatScenario(
                title="Đi phỏng vấn xin việc",
                description="Luyện tập trả lời các câu hỏi phỏng vấn cơ bản với nhà tuyển dụng Nhật.",
                level="N3",
                icon="💼",
            ),
            ChatScenario(
                title="Đặt bàn nhà hàng",
                description="Gọi điện đặt chỗ và yêu cầu thực đơn đặc biệt.",
                level="N4",
                icon="🍽️",
            ),
            ChatScenario(
                title="Nói chuyện với đồng nghiệp",
                description="Trao đổi công việc và thảo luận dự án tại văn phòng.",
                level="N3",
                icon="👥",
            ),
            ChatScenario(
                title="Mua sắm tại siêu thị",
                description="Hỏi giá, tìm kiếm sản phẩm và thanh toán.",
                level="N5",
                icon="🛒",
            ),
        ])
        db.commit()
    finally:
        db.close()


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


class ChatScenario(BaseModel):
    """A selectable conversation topic/situation ('tình huống hội thoại')."""
    __tablename__ = 'chat_scenarios'

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    level = Column(String(10), nullable=True)  # JLPT badge, e.g. 'N3'
    icon = Column(String(20), nullable=True)  # emoji shown on the card
    opening_line = Column(Text, nullable=True)  # scripted first AI message; auto-generated if empty
    topic_prompt = Column(Text, nullable=True)  # extra system-prompt instructions; derived from title/description if empty
    is_active = Column(Boolean, default=True)

    conversations = relationship('Conversation', backref='scenario', lazy=True)

    def __repr__(self):
        return f'<ChatScenario {self.title}>'


class Conversation(BaseModel):
    __tablename__ = 'conversations'

    title = Column(String(255), nullable=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    scenario_id = Column(Integer, ForeignKey('chat_scenarios.id'), nullable=True)
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
    feedback = Column(Text, nullable=True)  # Vietnamese coaching tip shown alongside an assistant reply
    is_off_topic = Column(Boolean, default=False)  # true when the user drifted off the active scenario's topic

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
    
    
class SearchHistory(Base):
    __tablename__ = 'search_history'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    word = Column(String(255), nullable=False)
    reading = Column(String(255), nullable=True)
    meaning = Column(Text, nullable=True)          # Nghĩa tiếng Việt (lấy từ definition đầu tiên)
    definitions = Column(JSON, default=list)       # Lưu list [{meaning, pos}]
    examples = Column(JSON, default=list)          # Lưu list [{japanese, vietnamese}]
    synonyms = Column(JSON, default=list)          # Lưu list [string]
    jlpt = Column(String(10), nullable=True)
    frequency = Column(String(20), nullable=True)
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
    avatar_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship('User', backref='information', uselist=False)