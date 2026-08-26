from sqlalchemy import Column, Integer, Text, JSON, Float, ForeignKey

from .base import BaseModel


class GrammarCorrection(BaseModel):
    """Grammar correction history model"""
    __tablename__ = 'grammar_corrections'

    message_id = Column(Integer, ForeignKey('messages.id'), nullable=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    original_text = Column(Text, nullable=False)
    corrected_text = Column(Text, nullable=False)
    errors = Column(JSON, nullable=True)  # Store error details
    explanation = Column(JSON, nullable=True)  # LLM-generated per-error explanations
    alternatives = Column(JSON, nullable=True)  # Alternative phrasings, saved when requested
    confidence = Column(Float, nullable=True)
    error_count = Column(Integer, default=0)

    def __repr__(self):
        return f'<GrammarCorrection {self.id}>'
