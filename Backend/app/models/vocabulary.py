from sqlalchemy import Column, String, Integer, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from .base import BaseModel


class VocabularyCurriculum(BaseModel):
    """A reusable textbook/curriculum name (e.g. 'Mimikara Oboeru N2',
    'Shinkanzen Master N3') that vocabulary sets can be grouped under."""
    __tablename__ = 'vocabulary_curriculums'

    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)

    sets = relationship('VocabularySet', backref='curriculum')

    def __repr__(self):
        return f'<VocabularyCurriculum {self.name}>'


class VocabularyCategory(BaseModel):
    """A reusable content category (e.g. 'Đời sống', 'Môi trường') that
    vocabulary sets can be tagged with."""
    __tablename__ = 'vocabulary_categories'

    name = Column(String(100), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True)

    sets = relationship('VocabularySet', backref='category')

    def __repr__(self):
        return f'<VocabularyCategory {self.name}>'


class VocabularySet(BaseModel):
    """One imported vocabulary set (= one lesson/chapter). Sits in 'draft'
    while the admin reviews the AI-parsed words, and only becomes visible to
    users once 'published'."""
    __tablename__ = 'vocabulary_sets'

    curriculum_id = Column(Integer, ForeignKey('vocabulary_curriculums.id'), nullable=True)
    category_id = Column(Integer, ForeignKey('vocabulary_categories.id'), nullable=True)
    level = Column(String(10), nullable=False)  # 'N1'..'N5'
    set_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default='draft')  # 'draft' | 'processing' | 'failed' | 'published'
    is_locked = Column(Boolean, nullable=False, default=False)  # locked = hidden from users even if published
    source_filename = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    item_count = Column(Integer, nullable=False, default=0)  # denormalized count of `items`
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    published_at = Column(DateTime, nullable=True)

    items = relationship(
        'VocabularyItem', backref='vocabulary_set',
        cascade='all, delete-orphan', order_by='VocabularyItem.order_no',
    )

    def __repr__(self):
        return f'<VocabularySet {self.set_name}>'


class VocabularyItem(BaseModel):
    """One word within a vocabulary set. example_sentence_ja/vi may be
    AI-generated (flagged via is_example_ai_generated) when the source PDF
    didn't include one; is_reviewed tracks admin approval per word, same as
    JlptQuestion.is_reviewed."""
    __tablename__ = 'vocabulary_items'

    set_id = Column(Integer, ForeignKey('vocabulary_sets.id'), nullable=False)
    order_no = Column(Integer, nullable=False, default=0)
    word = Column(String(100), nullable=False)
    reading = Column(String(100), nullable=True)
    han_viet = Column(String(200), nullable=True)  # Sino-Vietnamese reading, e.g. "NHÂN, SINH" for 人生
    meaning_vi = Column(String(500), nullable=False)
    word_type = Column(String(50), nullable=True)
    example_sentence_ja = Column(Text, nullable=True)
    example_sentence_vi = Column(Text, nullable=True)
    admin_notes = Column(Text, nullable=True)
    is_meaning_ai_generated = Column(Boolean, nullable=False, default=False)
    is_example_ai_generated = Column(Boolean, nullable=False, default=False)
    is_reviewed = Column(Boolean, nullable=False, default=False)

    def __repr__(self):
        return f'<VocabularyItem {self.word}>'
