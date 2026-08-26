import json
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import exists
from sqlalchemy.orm import Session

from app.dependencies import UserResponse, get_current_user, get_optional_user_id
from app.models import ChatScenario, Conversation, GrammarCorrection, Message
from app.models.database import get_db
from app.schemas.chat import (
    ChatRequest,
    ConversationDetail,
    ConversationHistoryItem,
    ConversationHistoryPage,
    GrammarNote,
    MessageDetail,
    StartConversationRequest,
)
from app.services import chat_ai
from app.services.grammar_service import grade_text

router = APIRouter()

HISTORY_PAGE_SIZE = 10

TITLE_PREVIEW_LEN = 40


def _isoformat(dt) -> str:
    return dt.isoformat() + 'Z' if dt else ''


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

    if not conversation.title:
        conversation.title = (
            scenario.title if scenario
            else user_message[:TITLE_PREVIEW_LEN] + ("…" if len(user_message) > TITLE_PREVIEW_LEN else "")
        )
        db.add(conversation)

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

            # Grade the user's message for grammar errors — runs after the
            # reply has already been streamed so it never delays the visible
            # AI response. Best-effort: a failure here must not drop the
            # reply that was already sent to the client.
            try:
                graded = grade_text(user_message)
                correction = GrammarCorrection(
                    user_id=conversation.user_id,
                    message_id=user_msg.id,
                    original_text=graded["original_text"],
                    corrected_text=graded["corrected_text"],
                    errors=graded["diffs"],
                    explanation=graded["explanation"],
                    error_count=graded["error_count"],
                )
                db.add(correction)
                db.commit()
                yield sse("grammar", {
                    "message_id": user_msg.id,
                    "corrected_text": graded["corrected_text"],
                    "diffs": graded["diffs"],
                    "error_count": graded["error_count"],
                    "has_errors": graded["original_text"] != graded["corrected_text"],
                    "explanation": graded["explanation"],
                })
            except Exception as e:
                print(f"Grammar grading failed: {e}", flush=True)
                db.rollback()
        except httpx.TimeoutException:
            yield sse("error", {"detail": "Request timeout"})
        except httpx.HTTPError as e:
            print(f"Chat API error: {e}", flush=True)
            yield sse("error", {"detail": "API error"})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/conversations", response_model=ConversationHistoryPage)
def list_conversations(
    page: int = 1,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    page = max(1, page)
    # Only conversations where both sides have spoken belong in the history —
    # a conversation the user started but never replied to (or that errored
    # before the assistant could answer) isn't a real exchange yet.
    base_query = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .filter(exists().where((Message.conversation_id == Conversation.id) & (Message.role == "user")))
        .filter(exists().where((Message.conversation_id == Conversation.id) & (Message.role == "assistant")))
    )
    total = base_query.count()

    conversations = (
        base_query.order_by(Conversation.updated_at.desc())
        .offset((page - 1) * HISTORY_PAGE_SIZE)
        .limit(HISTORY_PAGE_SIZE)
        .all()
    )

    items = []
    for c in conversations:
        scenario = db.query(ChatScenario).filter(ChatScenario.id == c.scenario_id).first() if c.scenario_id else None
        message_count = db.query(Message).filter(Message.conversation_id == c.id).count()
        items.append(ConversationHistoryItem(
            id=c.id,
            title=c.title,
            scenario_title=scenario.title if scenario else None,
            scenario_icon=scenario.icon if scenario else None,
            message_count=message_count,
            created_at=_isoformat(c.created_at),
            updated_at=_isoformat(c.updated_at),
        ))

    return ConversationHistoryPage(items=items, total=total, page=page, page_size=HISTORY_PAGE_SIZE)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    scenario = (
        db.query(ChatScenario).filter(ChatScenario.id == conversation.scenario_id).first()
        if conversation.scenario_id
        else None
    )

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.id)
        .all()
    )

    message_details = []
    for m in messages:
        grammar = None
        if m.correction:
            grammar = GrammarNote(
                corrected_text=m.correction.corrected_text,
                diffs=m.correction.errors or [],
                error_count=m.correction.error_count or 0,
                explanation=m.correction.explanation or [],
            )
        message_details.append(MessageDetail(
            id=m.id,
            role=m.role,
            content=m.content,
            feedback=m.feedback,
            is_off_topic=m.is_off_topic,
            grammar=grammar,
            created_at=_isoformat(m.created_at),
        ))

    return ConversationDetail(
        id=conversation.id,
        title=conversation.title,
        scenario_id=conversation.scenario_id,
        scenario_title=scenario.title if scenario else None,
        messages=message_details,
    )
