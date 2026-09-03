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


class QuestionCreate(BaseModel):
    """A question the admin adds by hand during review — for a mondai the AI
    missed entirely when parsing the import."""
    mondai_template_id: int
    question_text: str
    passage_text: Optional[str] = None
    choices: List[ChoiceUpdateIn] = []
    correct_no: Optional[int] = None
    explanation: Optional[str] = None


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
    updated_at: Optional[str] = None


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


# --- User-facing: browsing/taking a published exam (never exposes correct_no/explanation) ---

class TakeChoiceOut(BaseModel):
    choice_no: int
    choice_text: str


class TakeQuestionOut(BaseModel):
    id: int
    question_no: int
    question_text: str
    passage_text: Optional[str] = None
    choices: List[TakeChoiceOut] = []


class TakeMondaiOut(BaseModel):
    mondai_no: int
    name: Optional[str] = None
    description: Optional[str] = None
    tips: Optional[str] = None
    time_minutes: Optional[int] = None
    question_count: Optional[int] = None  # how many questions this mondai has in a real full JLPT exam
    questions: List[TakeQuestionOut] = []


class TakeSectionOut(BaseModel):
    section_type: str
    name: str
    time_minutes: Optional[int] = None
    mondai: List[TakeMondaiOut] = []


class TakeExamOut(BaseModel):
    id: int
    title: str
    level: str
    total_time_minutes: Optional[int] = None
    sections: List[TakeSectionOut] = []


class PublishedExamSummary(BaseModel):
    id: int
    title: str
    level: str
    year: Optional[int] = None
    month: Optional[int] = None
    total_time_minutes: Optional[int] = None
    question_count: int = 0
    # Only populated for a logged-in user (see get_optional_user_id in attempts.py)
    best_score: Optional[int] = None
    best_total: Optional[int] = None
    attempt_count: int = 0


# --- User-facing: submitting an attempt and viewing history ---

class SubmitAnswerIn(BaseModel):
    question_id: int
    selected_choice_no: Optional[int] = None


class SubmitAttemptIn(BaseModel):
    answers: List[SubmitAnswerIn] = []


class GradedAnswerOut(BaseModel):
    question_id: int
    selected_choice_no: Optional[int] = None
    correct_no: Optional[int] = None
    is_correct: bool
    explanation: Optional[str] = None


class SectionScoreOut(BaseModel):
    section_type: str
    name: str
    score: int
    max: int
    floor: int
    above_floor: bool


class ScoreBreakdownOut(BaseModel):
    """The 0-180 scaled score under JLPT's real dual pass condition (total
    >= pass_total AND every section >= its floor) — see
    app/services/jlpt_scoring.py for the approximation this is built from."""
    total: int
    total_max: int
    pass_total: int
    is_pass: bool
    sections: List[SectionScoreOut] = []


class SubmitAttemptOut(BaseModel):
    attempt_id: int
    exam_id: int
    score: int
    total_questions: int
    percent: float
    answers: List[GradedAnswerOut] = []
    # JLPT-scale breakdown of this one attempt (None if the exam's mondai
    # aren't mapped to sections, which shouldn't happen for a published exam)
    total: Optional[int] = None
    total_max: Optional[int] = None
    pass_total: Optional[int] = None
    is_pass: Optional[bool] = None
    sections: List[SectionScoreOut] = []


class AttemptHistoryItem(BaseModel):
    attempt_id: int
    exam_id: int
    exam_title: str
    level: str
    score: int
    total_questions: int
    percent: float
    submitted_at: Optional[str] = None


class LevelAverage(BaseModel):
    level: str
    attempt_count: int
    average_percent: float


# --- User-facing: dashboard (upcoming exam / predicted score / weak mondai) ---

class WeakMondaiOut(BaseModel):
    section_type: str
    section_name: str
    mondai_no: int
    mondai_name: Optional[str] = None
    wrong_count: int
    total_count: int
    percent_correct: float


class ExamScheduleOut(BaseModel):
    id: int
    level: Optional[str] = None
    exam_date: str
    registration_deadline: str


class ExamPlanIn(BaseModel):
    level: JlptLevel
    schedule_id: int
    location: Optional[str] = None


class ExamPlanOut(BaseModel):
    id: int
    level: str
    location: Optional[str] = None
    schedule: ExamScheduleOut


class UpcomingExamOut(BaseModel):
    schedule: ExamScheduleOut
    location: Optional[str] = None
    days_left: int
    study_pace_message: str


class DashboardOut(BaseModel):
    predicted: Optional[ScoreBreakdownOut] = None
    weak_mondai: List[WeakMondaiOut] = []
    upcoming_exam: Optional[UpcomingExamOut] = None
