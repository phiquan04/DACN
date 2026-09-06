import os
from datetime import datetime

from sqlalchemy import Column, Integer, DateTime, create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

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


class BaseModel(Base):
    __abstract__ = True

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(app):
    """Create any tables missing from a brand-new database, then seed defaults.

    Schema changes to *existing* tables (adding/renaming columns, etc.) are no
    longer hand-patched here — they go through Alembic migrations instead
    (see Backend/alembic/versions/ and CLAUDE.md for the
    `alembic upgrade head` / `alembic stamp head` workflow). create_all only
    creates tables that don't exist yet, so it stays safe to run alongside
    Alembic on every startup.
    """
    from . import seed  # local import: avoids a base <-> user/chat import cycle at module load time

    Base.metadata.create_all(bind=engine)
    seed.seed_roles()
    seed.backfill_user_roles()
    seed.seed_chat_scenarios()
    seed.seed_jlpt_schedules()
    seed.seed_jlpt_level_structures()
