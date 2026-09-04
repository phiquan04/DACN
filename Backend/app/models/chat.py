from sqlalchemy import Column, String, Integer, Text, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship

from .base import BaseModel


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
    # Admin-defined structured fields the user fills in instead of a single free-text
    # '場面' box, e.g. [{"key": "field_1", "label": "Tên công ty", "placeholder": "..."}].
    # Answers are joined into a "Label: value" block and stored in
    # Conversation.situation_context, same as the old free-text flow. Null/empty
    # means the scenario still uses the plain textarea.
    context_fields = Column(JSON, nullable=True)

    conversations = relationship('Conversation', backref='scenario', lazy=True)

    def __repr__(self):
        return f'<ChatScenario {self.title}>'


class Conversation(BaseModel):
    __tablename__ = 'conversations'

    title = Column(String(255), nullable=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    scenario_id = Column(Integer, ForeignKey('chat_scenarios.id'), nullable=True)
    situation_context = Column(Text, nullable=True)  # user-entered scene details ('場面'); only set when scenario_id is set

    messages = relationship('Message', backref='conversation', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Conversation {self.id}>'


class Message(BaseModel):
    """Message model - individual chat messages"""
    __tablename__ = 'messages'

    conversation_id = Column(Integer, ForeignKey('conversations.id'), nullable=True)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    feedback = Column(Text, nullable=True)  # Vietnamese coaching tip shown alongside an assistant reply
    is_off_topic = Column(Boolean, default=False)  # true when the user drifted off the active scenario's topic

    correction = relationship('GrammarCorrection', backref='message', uselist=False, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Message {self.id}>'
