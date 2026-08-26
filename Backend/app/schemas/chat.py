from typing import List, Optional

from pydantic import BaseModel

from app.schemas.grammar import GrammarErrorExplanation


class StartConversationRequest(BaseModel):
    scenario_id: Optional[int] = None


class ChatRequest(BaseModel):
    conversation_id: int
    message: str


class GrammarNote(BaseModel):
    corrected_text: str
    diffs: List[str]
    error_count: int
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
    messages: List[MessageDetail]
