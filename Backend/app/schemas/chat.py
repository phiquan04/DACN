from typing import Optional

from pydantic import BaseModel


class StartConversationRequest(BaseModel):
    scenario_id: Optional[int] = None


class ChatRequest(BaseModel):
    conversation_id: int
    message: str
