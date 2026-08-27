from typing import List, Literal, Optional

from pydantic import BaseModel

JlptLevel = Literal['N1', 'N2', 'N3', 'N4', 'N5']
JLPT_LEVELS: tuple = ('N1', 'N2', 'N3', 'N4', 'N5')

SectionType = Literal['kotoba', 'dokkai', 'choukai']


class MondaiTemplateIn(BaseModel):
    mondai_no: int
    name: Optional[str] = None
    description: Optional[str] = None
    tips: Optional[str] = None
    question_count: Optional[int] = None
    time_minutes: Optional[int] = None


class MondaiTemplateOut(MondaiTemplateIn):
    id: int


class SectionIn(BaseModel):
    section_type: SectionType
    name: str
    order_no: int = 0
    time_minutes: Optional[int] = None
    mondai: List[MondaiTemplateIn] = []


class SectionOut(BaseModel):
    id: int
    section_type: SectionType
    name: str
    order_no: int
    time_minutes: Optional[int] = None
    mondai: List[MondaiTemplateOut] = []


class LevelStructureIn(BaseModel):
    total_time_minutes: Optional[int] = None
    notes: Optional[str] = None
    sections: List[SectionIn] = []


class LevelStructureOut(BaseModel):
    id: int
    level: str
    total_time_minutes: Optional[int] = None
    notes: Optional[str] = None
    sections: List[SectionOut] = []


class LevelStructureSummary(BaseModel):
    level: str
    is_configured: bool
    total_time_minutes: Optional[int] = None
    section_count: int = 0
    mondai_count: int = 0


class ImportExamResponse(BaseModel):
    exam_id: int
    title: str
    level: str
    status: str
    question_count: int
    has_answer_key: bool
    unmapped_count: int = 0


class ChoiceUpdateIn(BaseModel):
    choice_no: int
    choice_text: str


class ChoiceOut(BaseModel):
    id: int
    choice_no: int
    choice_text: str


class QuestionPatch(BaseModel):
    """Partial update for one question during admin review — only fields
    actually present in the request body are applied (see model_dump's
    exclude_unset usage in the route)."""
    mondai_template_id: Optional[int] = None
    question_text: Optional[str] = None
    passage_text: Optional[str] = None
    choices: Optional[List[ChoiceUpdateIn]] = None
    correct_no: Optional[int] = None
    explanation: Optional[str] = None
    is_reviewed: Optional[bool] = None


class QuestionReviewOut(BaseModel):
    id: int
    question_no: int
    question_text: str
    passage_text: Optional[str] = None
    choices: List[ChoiceOut] = []
    correct_no: Optional[int] = None
    explanation: Optional[str] = None
    is_reviewed: bool = False


class MondaiReviewGroup(BaseModel):
    mondai_template_id: int
    mondai_no: int
    name: Optional[str] = None
    description: Optional[str] = None
    tips: Optional[str] = None
    questions: List[QuestionReviewOut] = []


class SectionReviewGroup(BaseModel):
    section_type: str
    name: str
    mondai: List[MondaiReviewGroup] = []


class ExamReviewOut(BaseModel):
    id: int
    title: str
    level: str
    year: Optional[int] = None
    month: Optional[int] = None
    status: str
    has_answer_key: bool
    sections: List[SectionReviewGroup] = []
    total_questions: int = 0
    reviewed_count: int = 0
    ready_to_publish: bool = False


class ExamSummary(BaseModel):
    id: int
    title: str
    level: str
    status: str
    year: Optional[int] = None
    month: Optional[int] = None
    has_answer_key: bool
    question_count: int = 0
    reviewed_count: int = 0
