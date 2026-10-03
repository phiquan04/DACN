import json
from typing import List, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services import chat_ai
from app.utils.rate_limit import rate_limit

router = APIRouter()

# Keeps the prompt bounded regardless of how long the widget's session grows —
# only recent turns matter for a short help exchange.
MAX_HISTORY_MESSAGES = 20


# What one turn contributes to the prompt. Longer turns are cut, not rejected:
# the widget resends earlier assistant replies verbatim, and a long reply
# from a previous turn must not make every later request fail validation.
MAX_MESSAGE_LENGTH = 2000
# Hard ceilings on the request itself, well above anything the widget sends
# (it only resends the last MAX_HISTORY_MESSAGES turns).
MAX_RAW_MESSAGE_LENGTH = 20000
MAX_REQUEST_MESSAGES = 200


class SiteHelpMessage(BaseModel):
    # Only the two conversational roles: the system prompt is the server's
    # (chat_ai.SITE_HELP_PERSONA), and a client-supplied "system" turn would
    # let any caller replace it and use this endpoint as a free general LLM.
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=MAX_RAW_MESSAGE_LENGTH)


class SiteHelpChatRequest(BaseModel):
    messages: List[SiteHelpMessage] = Field(..., max_length=MAX_REQUEST_MESSAGES)


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# No sign-in required — the help widget is on every learner page, including
# for guests — so it is throttled per caller instead.
@router.post("/site-help/chat", dependencies=[Depends(rate_limit("site-help", limit=15, window_seconds=60))])
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
    messages += [{"role": m.role, "content": m.content[:MAX_MESSAGE_LENGTH]} for m in history]

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
