import json
from typing import List

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services import chat_ai

router = APIRouter()

# Keeps the prompt bounded regardless of how long the widget's session grows —
# only recent turns matter for a short help exchange.
MAX_HISTORY_MESSAGES = 20


class SiteHelpMessage(BaseModel):
    role: str
    content: str


class SiteHelpChatRequest(BaseModel):
    messages: List[SiteHelpMessage]


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/site-help/chat")
async def site_help_chat(request: SiteHelpChatRequest):
    """Free-form Q&A about the website itself (features, where to find them),
    as opposed to /api/chat which is the Japanese roleplay practice partner.
    Stateless: the widget keeps its own history and resends it each turn, so
    no Conversation/Message rows are created for this feature.
    """
    history = [m for m in request.messages if m.content.strip()][-MAX_HISTORY_MESSAGES:]
    if not history or history[-1].role != "user":
        raise HTTPException(status_code=400, detail="Empty message")

    api_key = chat_ai.require_api_key()
    messages = [{"role": "system", "content": chat_ai.SITE_HELP_PERSONA}]
    messages += [{"role": m.role, "content": m.content} for m in history]

    async def event_stream():
        try:
            async for delta in chat_ai.stream_openrouter(messages, api_key):
                yield sse("chunk", {"text": delta})
            yield sse("done", {})
        except httpx.TimeoutException:
            yield sse("error", {"detail": "Request timeout"})
        except httpx.HTTPError as e:
            print(f"Site help chat API error: {e}", flush=True)
            yield sse("error", {"detail": "API error"})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
