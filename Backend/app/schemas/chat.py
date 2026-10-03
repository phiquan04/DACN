from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.grammar import GrammarErrorExplanation

# Both end up inside an LLM prompt (and the message is also graded by the GEC
# model, which truncates at 128 tokens per sentence anyway).
MAX_CHAT_MESSAGE_LENGTH = 1000
MAX_SITUATION_CONTEXT_LENGTH = 500


class StartConversationRequest(BaseModel):
    scenario_id: Optional[int] = None
    situation_context: Optional[str] = Field(None, max_length=MAX_SITUATION_CONTEXT_LENGTH)


class ChatRequest(BaseModel):
    conversation_id: int
    message: str = Field(..., max_length=MAX_CHAT_MESSAGE_LENGTH)


class UpdateSituationContextRequest(BaseModel):
    situation_context: Optional[str] = Field(None, max_length=MAX_SITUATION_CONTEXT_LENGTH)


class GrammarNote(BaseModel):
    corrected_text: str
    diffs: List[str]
    error_count: int
    has_errors: bool
    explanation: List[GrammarErrorExplanation] = []


class MessageDetail(BaseModel):
    id: int
    role: str
    content: str
    feedback: Optional[str] = None
    is_off_topic: bool = False
    grammar: Optional[GrammarNote] = None
    created_at: str


class ConversationHistoryItem(BaseModel):
    id: int
    title: Optional[str] = None
    scenario_title: Optional[str] = None
    scenario_icon: Optional[str] = None
    message_count: int
    created_at: str
    updated_at: str


class ConversationHistoryPage(BaseModel):
    items: List[ConversationHistoryItem]
    total: int
    page: int
    page_size: int


class ConversationDetail(BaseModel):
    id: int
    title: Optional[str] = None
    scenario_id: Optional[int] = None
    scenario_title: Optional[str] = None
    situation_context: Optional[str] = None
    messages: List[MessageDetail]
