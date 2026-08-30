from sqlalchemy import Column, String, Integer, Boolean, ForeignKey
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

    conversations = relationship('Conversation', backref='user', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<User {self.username}>'
