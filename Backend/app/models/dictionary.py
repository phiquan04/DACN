from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship

from .base import Base


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


class DictionaryImage(Base):
    """A community-contributed illustration image for a dictionary word."""
    __tablename__ = 'dictionary_images'

    id = Column(Integer, primary_key=True)
    word = Column(String(255), nullable=False, index=True)
    image_url = Column(String(512), nullable=False)
    cloudinary_public_id = Column(String(255), nullable=True)  # needed to delete the asset from Cloudinary
    caption = Column(String(255), nullable=True)
    uploaded_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    uploader = relationship('User')


class DictionaryComment(Base):
    """A user comment/contribution left on a dictionary word."""
    __tablename__ = 'dictionary_comments'

    id = Column(Integer, primary_key=True)
    word = Column(String(255), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    author = relationship('User')
    votes = relationship('DictionaryCommentVote', backref='comment', cascade='all, delete-orphan')


class DictionaryCommentVote(Base):
    """One user's up/down vote on one dictionary comment."""
    __tablename__ = 'dictionary_comment_votes'

    id = Column(Integer, primary_key=True)
    comment_id = Column(Integer, ForeignKey('dictionary_comments.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    vote_type = Column(String(4), nullable=False)  # 'up' or 'down'
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('comment_id', 'user_id', name='uq_comment_vote_user'),
    )
