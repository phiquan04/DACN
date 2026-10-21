"""Schemas for learner-facing grammar practice (cloze/mcq exercises,
auto-graded, SRS progress) — kept separate from schemas/grammar_content.py
(admin content-bank + read-only library schemas) since this is a distinct
concern with its own request/response shapes, mirroring how
schemas/vocabulary.py keeps admin-review and learner-learning schemas in one
file only because vocabulary's learning schemas are small; grammar's
exercise-submission shapes are unrelated enough to warrant a new file.
"""
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel

ExerciseType = Literal['cloze', 'mcq']


class GrammarExerciseOut(BaseModel):
    """Exercise shape safe to send to the learner — deliberately excludes
    correct_answer, which would let the frontend grade itself instead of the
    server."""
    id: int
    grammar_point_id: int
    grammar_pattern: str
    type: ExerciseType
    prompt: str
    choices: Optional[List[str]] = None


class SubmitAnswerRequest(BaseModel):
    answer: str


class SubmitAnswerResponse(BaseModel):
    correct: bool
    correct_answer: str
    grammar_point_id: int
    status: str  # 'new' | 'reviewing' | 'learned'
    due_at: Optional[datetime] = None
