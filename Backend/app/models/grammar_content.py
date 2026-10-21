"""Grammar Content Bank models — admin-managed JLPT grammar points, mirroring
app/models/vocabulary.py's VocabularyCurriculum/VocabularyCategory/
VocabularySet/VocabularyItem one-to-one (see that file's docstrings for the
rationale behind each field). Deliberately separate from grammar.py's
GrammarCorrection, which is the unrelated BERT grammar-error-correction
feature — same word "grammar", different feature, kept in different files.

No learner-facing progress/SRS tables here (no GrammarPointProgress/
GrammarReviewLog equivalents) — this is purely the admin content-management
mirror; the learner-facing grammar study UI is out of scope.
"""
from sqlalchemy import Column, String, Integer, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

from .base import BaseModel


class GrammarCurriculum(BaseModel):
    """A reusable textbook/curriculum name (e.g. 'Shinkanzen Master N3 Ngữ
    pháp') that grammar sets can be grouped under."""
    __tablename__ = 'grammar_curriculums'

    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)

    sets = relationship('GrammarSet', backref='curriculum')

    def __repr__(self):
        return f'<GrammarCurriculum {self.name}>'


class GrammarCategory(BaseModel):
    """A reusable content category (e.g. 'Ngữ pháp giao tiếp', 'Ngữ pháp văn
    viết') that grammar sets can be tagged with."""
    __tablename__ = 'grammar_categories'

    name = Column(String(100), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True)

    sets = relationship('GrammarSet', backref='category')

    def __repr__(self):
        return f'<GrammarCategory {self.name}>'


class GrammarSet(BaseModel):
    """One imported grammar set (= one lesson/chapter of grammar points).
    Sits in 'draft' while the admin reviews the AI-parsed points, and only
    becomes visible to users once 'published'."""
    __tablename__ = 'grammar_sets'

    curriculum_id = Column(Integer, ForeignKey('grammar_curriculums.id'), nullable=True)
    category_id = Column(Integer, ForeignKey('grammar_categories.id'), nullable=True)
    level = Column(String(10), nullable=False)  # 'N1'..'N5'
    set_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default='draft')  # 'draft' | 'processing' | 'failed' | 'published'
    is_locked = Column(Boolean, nullable=False, default=False)  # locked = hidden from users even if published
    source_filename = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    item_count = Column(Integer, nullable=False, default=0)  # denormalized count of `points`
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    published_at = Column(DateTime, nullable=True)

    points = relationship(
        'GrammarPoint', backref='grammar_set',
        cascade='all, delete-orphan', order_by='GrammarPoint.order_no',
    )

    def __repr__(self):
        return f'<GrammarSet {self.set_name}>'


class GrammarPoint(BaseModel):
    """One grammar point within a grammar set. `examples` may be AI-generated
    (flagged via is_example_ai_generated) when the source PDF didn't include
    any; is_reviewed tracks admin approval per point, same as
    VocabularyItem.is_reviewed."""
    __tablename__ = 'grammar_points'

    set_id = Column(Integer, ForeignKey('grammar_sets.id'), nullable=False)
    order_no = Column(Integer, nullable=False, default=0)
    pattern = Column(String(200), nullable=False)  # the grammar structure itself, e.g. "ておく"
    meaning_vi = Column(String(500), nullable=False)
    usage_note = Column(Text, nullable=True)  # explanation of how/when it's used
    # A grammar point commonly needs several example sentences (different
    # contexts/nuances), unlike a vocabulary item's single example — stored
    # as a list of {"japanese": str, "vietnamese": str} rather than forking
    # into example_1_ja/example_2_ja/... columns.
    examples = Column(JSON, nullable=False, default=list)
    admin_notes = Column(Text, nullable=True)
    is_meaning_ai_generated = Column(Boolean, nullable=False, default=False)
    is_example_ai_generated = Column(Boolean, nullable=False, default=False)
    is_reviewed = Column(Boolean, nullable=False, default=False)

    def __repr__(self):
        return f'<GrammarPoint {self.pattern}>'
