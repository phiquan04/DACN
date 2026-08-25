from sqlalchemy import Column, Integer, Text, JSON, Float, ForeignKey

from .base import BaseModel


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
