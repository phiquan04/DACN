from typing import List, Optional

from pydantic import BaseModel, Field

# Each sentence costs a BERT forward pass plus up to three LLM calls for the
# explanation, and the endpoints are usable without signing in.
MAX_GRAMMAR_TEXT_LENGTH = 2000


class CorrectRequest(BaseModel):
    text: str = Field(..., max_length=MAX_GRAMMAR_TEXT_LENGTH)


class GrammarErrorExplanation(BaseModel):
    original_fragment: str
    corrected_fragment: str
    error_type: str
    why_wrong: str
    why_fixed: str


class CorrectResponse(BaseModel):
    correctedText: str
    diffs: List[str]
    original: str
    explanation: List[GrammarErrorExplanation] = []
    history_id: Optional[int] = None


class AlternativeRequest(BaseModel):
    text: str = Field(..., max_length=MAX_GRAMMAR_TEXT_LENGTH)
    history_id: Optional[int] = None


class GrammarHistoryItem(BaseModel):
    id: int
    original_text: str
    corrected_text: str
    first_error: Optional[GrammarErrorExplanation] = None
    created_at: str


class GrammarHistoryPage(BaseModel):
    items: List[GrammarHistoryItem]
    total: int
    page: int
    page_size: int
    total_all: int
    total_changed: int


class GrammarHistoryDetail(BaseModel):
    id: int
    original_text: str
    corrected_text: str
    diffs: List[str] = []
    explanation: List[GrammarErrorExplanation] = []
    alternatives: Optional[List[str]] = None
    created_at: str


class ErrorTypeStat(BaseModel):
    error_type: str
    count: int
    percentage: float


class GrammarErrorStats(BaseModel):
    stats: List[ErrorTypeStat]
