"""Grammar practice models: AI-generated exercises attached to a
GrammarPoint (app/models/grammar_content.py), plus the learner's per-point
SRS progress. Generated once at publish time and cached — see
app/services/grammar_exercise_ai.py — rather than generated live per
learner, same "generate once, cache the result" philosophy as
app/services/vocabulary_ocr.py's example-sentence generation.

GrammarPointProgress mirrors app/models/vocabulary.py's
VocabularyItemProgress field-for-field (see that class's docstring for the
rationale behind each field) — same SM-2-lite schedule, just keyed by
grammar_point_id instead of item_id. No GrammarReviewLog equivalent: the
user's ask doesn't require streak-tracking parity for grammar practice, and
adding an append-only log with no reader yet would be dead code.
"""
from sqlalchemy import Column, String, Integer, Float, Text, Boolean, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship

from .base import BaseModel


class GrammarExercise(BaseModel):
    """One AI-generated practice exercise for a grammar point. `type` is
    'cloze' (fill in the blanked-out pattern in a Japanese sentence) or
    'mcq' (pick the correct option from `choices`). `correct_answer` is the
    exact string graded against the learner's answer — never sent to the
    frontend (see schemas/grammar_practice.py's GrammarExerciseOut)."""
    __tablename__ = 'grammar_exercises'

    grammar_point_id = Column(Integer, ForeignKey('grammar_points.id'), nullable=False)
    type = Column(String(10), nullable=False)  # 'cloze' | 'mcq'
    prompt = Column(Text, nullable=False)
    correct_answer = Column(String(500), nullable=False)
    choices = Column(JSON, nullable=True)  # list[str], 4 options for 'mcq'; null for 'cloze'

    grammar_point = relationship('GrammarPoint')

    def __repr__(self):
        return f'<GrammarExercise point={self.grammar_point_id} {self.type}>'


class GrammarPointProgress(BaseModel):
    """One user's SRS state for one grammar point — field-for-field mirror
    of VocabularyItemProgress (see app/models/vocabulary.py), keyed by
    grammar_point_id instead of item_id. Updated after every graded
    exercise submission (see app/routes/grammar_content/practice.py's
    _apply_rating, itself a direct copy of vocabulary/learning.py's)."""
    __tablename__ = 'grammar_point_progress'

    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    grammar_point_id = Column(Integer, ForeignKey('grammar_points.id'), nullable=False)
    status = Column(String(20), nullable=False, default='new')  # 'new' | 'reviewing' | 'learned'
    ease_factor = Column(Float, nullable=False, default=2.5)
    interval_days = Column(Integer, nullable=False, default=0)
    review_count = Column(Integer, nullable=False, default=0)
    due_at = Column(DateTime, nullable=True)
    last_reviewed_at = Column(DateTime, nullable=True)

    grammar_point = relationship('GrammarPoint')

    __table_args__ = (
        UniqueConstraint('user_id', 'grammar_point_id', name='uq_grammar_progress_user_point'),
    )

    def __repr__(self):
        return f'<GrammarPointProgress user={self.user_id} point={self.grammar_point_id} {self.status}>'
