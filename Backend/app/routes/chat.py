import json
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.dependencies import get_optional_user_id
from app.models import ChatScenario, Conversation, Message
from app.models.database import get_db
from app.schemas.chat import ChatRequest, StartConversationRequest
from app.services import chat_ai

router = APIRouter()


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/conversations")
def start_conversation(
    request: StartConversationRequest,
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_optional_user_id),
):
    scenario = None
    if request.scenario_id is not None:
        scenario = db.query(ChatScenario).filter(ChatScenario.id == request.scenario_id).first()
        if not scenario:
            raise HTTPException(status_code=404, detail="Scenario not found")

    conversation = Conversation(user_id=user_id, scenario_id=scenario.id if scenario else None)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    opening_message = None
    if scenario:
        opening_text = scenario.opening_line
        if not opening_text:
            api_key = chat_ai.require_api_key()
            opener_prompt = (
                f"あなたはロールプレイの相手役です。シチュエーション「{scenario.title}」"
                f"（{scenario.description or scenario.title}）を始めるための最初の一言を日本語で話してください。"
                "2〜3文程度で、挨拶と自己紹介を含めてください。JSONは不要で、日本語の発話のみを出力してください。"
            )
            opening_text = chat_ai.call_openrouter(
                [{"role": "system", "content": opener_prompt}], api_key
            ).strip()

        msg = Message(conversation_id=conversation.id, role="assistant", content=opening_text)
        db.add(msg)
        db.commit()
        db.refresh(msg)
        opening_message = {"id": msg.id, "role": "assistant", "content": msg.content}

    return {
        "conversation_id": conversation.id,
        "scenario_id": scenario.id if scenario else None,
        "opening_message": opening_message,
    }


@router.post("/chat")
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
):
    user_message = request.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Empty message")

    conversation = db.query(Conversation).filter(Conversation.id == request.conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    scenario = (
        db.query(ChatScenario).filter(ChatScenario.id == conversation.scenario_id).first()
        if conversation.scenario_id
        else None
    )

    api_key = chat_ai.require_api_key()

    user_msg = Message(conversation_id=conversation.id, role="user", content=user_message)
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    history = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.id.desc())
        .limit(10)
        .all()
    )
    history.reverse()

    messages = [{"role": "system", "content": chat_ai.build_system_prompt(scenario)}]
    messages += [{"role": m.role, "content": m.content} for m in history]
    conversation_id = conversation.id
    sentinel_len = len(chat_ai.META_SENTINEL)

    async def event_stream():
        reply_buffer = ""
        meta_buffer = ""
        pending = ""
        in_meta = False

        try:
            async for delta in chat_ai.stream_openrouter(messages, api_key):
                if in_meta:
                    meta_buffer += delta
                    continue

                pending += delta
                idx = pending.find(chat_ai.META_SENTINEL)
                if idx != -1:
                    reply_part = pending[:idx]
                    if reply_part:
                        reply_buffer += reply_part
                        yield sse("chunk", {"text": reply_part})
                    in_meta = True
                    meta_buffer += pending[idx + sentinel_len:]
                    pending = ""
                else:
                    # Hold back a tail as long as the sentinel in case it's
                    # been split across two deltas — flush everything else.
                    safe_len = max(0, len(pending) - sentinel_len)
                    if safe_len > 0:
                        reply_buffer += pending[:safe_len]
                        yield sse("chunk", {"text": pending[:safe_len]})
                        pending = pending[safe_len:]

            if not in_meta and pending:
                reply_buffer += pending
                yield sse("chunk", {"text": pending})

            reply_text = reply_buffer.strip()
            parsed_meta = chat_ai.parse_meta_json(meta_buffer)

            assistant_msg = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=reply_text,
                feedback=parsed_meta["feedback"],
                is_off_topic=parsed_meta["is_off_topic"],
            )
            db.add(assistant_msg)
            db.commit()
            db.refresh(assistant_msg)

            yield sse("meta", {
                "feedback": parsed_meta["feedback"],
                "is_off_topic": parsed_meta["is_off_topic"],
                "suggestions": parsed_meta["suggestions"],
                "message_id": assistant_msg.id,
                "conversation_id": conversation_id,
            })
        except httpx.TimeoutException:
            yield sse("error", {"detail": "Request timeout"})
        except httpx.HTTPError as e:
            print(f"Chat API error: {e}", flush=True)
            yield sse("error", {"detail": "API error"})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
