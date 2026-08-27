from sqlalchemy import Column, String, Integer, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from .base import BaseModel


class JlptLevelStructure(BaseModel):
    """Admin-configured exam blueprint for one JLPT level (N1-N5): total time
    budget, broken down into sections (kotoba/dokkai/choukai) and mondai."""
    __tablename__ = 'jlpt_level_structures'

    level = Column(String(10), nullable=False, unique=True)  # 'N1'..'N5'
    total_time_minutes = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)

    sections = relationship(
        'JlptSection', backref='level_structure',
        cascade='all, delete-orphan', order_by='JlptSection.order_no',
    )

    def __repr__(self):
        return f'<JlptLevelStructure {self.level}>'


class JlptSection(BaseModel):
    """One skill section (kotoba / dokkai / choukai) within a level structure."""
    __tablename__ = 'jlpt_sections'

    level_structure_id = Column(Integer, ForeignKey('jlpt_level_structures.id'), nullable=False)
    section_type = Column(String(20), nullable=False)  # 'kotoba' | 'dokkai' | 'choukai'
    name = Column(String(255), nullable=False)
    order_no = Column(Integer, nullable=False, default=0)
    time_minutes = Column(Integer, nullable=True)

    mondai_templates = relationship(
        'JlptMondaiTemplate', backref='section',
        cascade='all, delete-orphan', order_by='JlptMondaiTemplate.mondai_no',
    )

    __table_args__ = (
        UniqueConstraint('level_structure_id', 'section_type', name='uq_section_level_type'),
    )

    def __repr__(self):
        return f'<JlptSection {self.section_type}>'


class JlptMondaiTemplate(BaseModel):
    """One mondai (question group) within a section: expected question count,
    time budget, and admin-written description/tips, reused by every exam of
    that level."""
    __tablename__ = 'jlpt_mondai_templates'

    section_id = Column(Integer, ForeignKey('jlpt_sections.id'), nullable=False)
    mondai_no = Column(Integer, nullable=False)
    name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    tips = Column(Text, nullable=True)
    question_count = Column(Integer, nullable=True)
    time_minutes = Column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint('section_id', 'mondai_no', name='uq_mondai_section_no'),
    )

    def __repr__(self):
        return f'<JlptMondaiTemplate mondai{self.mondai_no}>'


class JlptExam(BaseModel):
    """One imported exam paper. Sits in 'draft' while the admin reviews the
    AI-parsed questions, and only becomes visible to users once 'published'."""
    __tablename__ = 'jlpt_exams'

    title = Column(String(255), nullable=False)
    level = Column(String(10), nullable=False)  # denormalized from level_structure for quick filtering
    level_structure_id = Column(Integer, ForeignKey('jlpt_level_structures.id'), nullable=False)
    year = Column(Integer, nullable=True)
    month = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, default='draft')  # 'draft' | 'published'
    has_answer_key = Column(Boolean, default=False)  # whether an answer-key PDF was uploaded on import
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)

    passages = relationship('JlptPassage', backref='exam', cascade='all, delete-orphan')
    questions = relationship(
        'JlptQuestion', backref='exam',
        cascade='all, delete-orphan', order_by='JlptQuestion.question_no',
    )
    level_structure = relationship('JlptLevelStructure')

    def __repr__(self):
        return f'<JlptExam {self.title}>'


class JlptPassage(BaseModel):
    """A shared reading passage (dokkai) that one or more questions in an exam refer to."""
    __tablename__ = 'jlpt_passages'

    exam_id = Column(Integer, ForeignKey('jlpt_exams.id'), nullable=False)
    section_type = Column(String(20), nullable=False)
    order_no = Column(Integer, nullable=False, default=0)
    passage_text = Column(Text, nullable=False)

    questions = relationship('JlptQuestion', backref='passage')

    def __repr__(self):
        return f'<JlptPassage {self.id}>'


class JlptQuestion(BaseModel):
    """One multiple-choice question plus its correct answer and explanation.
    correct_no/explanation are nullable because they may not exist yet: either
    no answer-key PDF was uploaded, or the admin hasn't reviewed the question."""
    __tablename__ = 'jlpt_questions'

    exam_id = Column(Integer, ForeignKey('jlpt_exams.id'), nullable=False)
    mondai_template_id = Column(Integer, ForeignKey('jlpt_mondai_templates.id'), nullable=False)
    passage_id = Column(Integer, ForeignKey('jlpt_passages.id'), nullable=True)
    question_no = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    correct_no = Column(Integer, nullable=True)
    explanation = Column(Text, nullable=True)
    is_reviewed = Column(Boolean, default=False)  # admin has confirmed/edited this question

    choices = relationship(
        'JlptChoice', backref='question',
        cascade='all, delete-orphan', order_by='JlptChoice.choice_no',
    )
    mondai_template = relationship('JlptMondaiTemplate')

    def __repr__(self):
        return f'<JlptQuestion {self.question_no}>'


class JlptChoice(BaseModel):
    __tablename__ = 'jlpt_choices'

    question_id = Column(Integer, ForeignKey('jlpt_questions.id'), nullable=False)
    choice_no = Column(Integer, nullable=False)
    choice_text = Column(Text, nullable=False)

    __table_args__ = (
        UniqueConstraint('question_id', 'choice_no', name='uq_choice_question_no'),
    )

    def __repr__(self):
        return f'<JlptChoice {self.choice_no}>'


class JlptTestAttempt(BaseModel):
    """One user's attempt at one published exam. created_at (from BaseModel)
    doubles as started_at; submitted_at is set once the attempt is scored."""
    __tablename__ = 'jlpt_test_attempts'

    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    exam_id = Column(Integer, ForeignKey('jlpt_exams.id'), nullable=False)
    status = Column(String(20), nullable=False, default='in_progress')  # 'in_progress' | 'completed'
    score = Column(Integer, nullable=True)
    total_questions = Column(Integer, nullable=True)
    submitted_at = Column(DateTime, nullable=True)

    answers = relationship('JlptTestAttemptAnswer', backref='attempt', cascade='all, delete-orphan')
    user = relationship('User')
    exam = relationship('JlptExam')

    def __repr__(self):
        return f'<JlptTestAttempt {self.id}>'


class JlptTestAttemptAnswer(BaseModel):
    __tablename__ = 'jlpt_test_attempt_answers'

    attempt_id = Column(Integer, ForeignKey('jlpt_test_attempts.id'), nullable=False)
    question_id = Column(Integer, ForeignKey('jlpt_questions.id'), nullable=False)
    selected_choice_no = Column(Integer, nullable=True)
    is_correct = Column(Boolean, nullable=True)

    __table_args__ = (
        UniqueConstraint('attempt_id', 'question_id', name='uq_attempt_answer_question'),
    )

    def __repr__(self):
        return f'<JlptTestAttemptAnswer {self.id}>'
