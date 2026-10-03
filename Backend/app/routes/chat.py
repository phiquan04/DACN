import json
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy import exists
from sqlalchemy.orm import Session

from app.dependencies import UserResponse, get_current_user, get_optional_user_id
from app.models import ChatScenario, Conversation, GrammarCorrection, Message
from app.models.database import SessionLocal, get_db
from app.schemas.chat import (
    ChatRequest,
    ConversationDetail,
    ConversationHistoryItem,
    ConversationHistoryPage,
    GrammarNote,
    MessageDetail,
    StartConversationRequest,
    UpdateSituationContextRequest,
)
from app.services import chat_ai
from app.services.audit_log import log_event
from app.services.grammar_service import grade_text
from app.utils.rate_limit import rate_limit

router = APIRouter()

HISTORY_PAGE_SIZE = 10

TITLE_PREVIEW_LEN = 40


def _isoformat(dt) -> str:
    return dt.isoformat() + 'Z' if dt else ''


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# Starting a scenario conversation can cost an LLM call (the opening line).
@router.post("/conversations", dependencies=[Depends(rate_limit("chat-start", limit=15, window_seconds=60))])
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

    # The scene/context note ('場面') is meaningless outside a scenario —
    # free chat has no topic to stay consistent with, so drop it silently
    # rather than persisting stray data.
    situation_context = request.situation_context.strip() if scenario and request.situation_context else None

    conversation = Conversation(
        user_id=user_id,
        scenario_id=scenario.id if scenario else None,
        situation_context=situation_context,
    )
    db.add(conversation)
    db.flush()  # assign conversation.id before the audit-log write below

    if user_id is not None:
        log_event(
            db, subject_user_id=user_id, action="chat.conversation_started",
            description=f"Luyện hội thoại với AI: {scenario.title}" if scenario else "Luyện hội thoại tự do với AI",
            actor_user_id=user_id, actor_role="user",
        )

    db.commit()
    db.refresh(conversation)

    opening_message = None
    if scenario:
        opening_text = scenario.opening_line if not situation_context else None
        if not opening_text:
            api_key = chat_ai.require_api_key()
            opener_prompt = (
                f"あなたはロールプレイの「相手役」です。シチュエーション「{scenario.title}」"
                f"（{scenario.description or scenario.title}）において、ユーザー側の行動の相手となる人物"
                f"（例: 面接なら面接官・採用担当者、飲食店の予約なら店員、買い物なら店員）を演じてください。"
                f"ユーザー自身の役（応募者・客側など）は絶対に演じないでください。"
                f"この相手役として、会話を始めるための最初の一言を日本語で話してください。"
            )
            if situation_context:
                opener_prompt += f"具体的な場面設定: {situation_context}。この場面設定に沿ってください。"
            opener_prompt += (
                "2〜3文程度で、挨拶と、相手役としての自己紹介（自分の名前や会社・店の名前など）を含めてください。"
                "JSONは不要で、日本語の発話のみを出力してください。"
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
        "situation_context": conversation.situation_context,
        "opening_message": opening_message,
    }


@router.patch("/conversations/{conversation_id}/situation", response_model=ConversationDetail)
def update_situation_context(
    conversation_id: int,
    request: UpdateSituationContextRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not conversation.scenario_id:
        raise HTTPException(status_code=400, detail="Free chat has no scenario to set a scene for")

    conversation.situation_context = request.situation_context.strip() if request.situation_context else None
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return get_conversation(conversation_id, current_user, db)


@router.post("/chat", dependencies=[Depends(rate_limit("chat", limit=20, window_seconds=60))])
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_optional_user_id),
):
    user_message = request.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Empty message")

    conversation = db.query(Conversation).filter(Conversation.id == request.conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    # A conversation started while signed in belongs to that account: nobody
    # else may post into it (or read its context back through the model).
    # Guest conversations (user_id NULL) have no owner to check against and
    # stay usable by id, exactly as before.
    if conversation.user_id is not None and conversation.user_id != user_id:
        if user_id is None:
            # No/expired token on an owned conversation — 401 (not 404) so the
            # frontend refreshes its access token and retries.
            raise HTTPException(
                status_code=401, detail="Invalid or expired token", headers={"WWW-Authenticate": "Bearer"},
            )
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
    # Touch explicitly: SQLAlchemy's onupdate only fires when the row is
    # actually written, and title only changes on the very first message —
    # without this, a conversation's updated_at (used to sort history) would
    # freeze at creation time instead of tracking the latest activity.
    conversation.updated_at = datetime.utcnow()
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

    messages = [{"role": "system", "content": chat_ai.build_system_prompt(scenario, conversation.situation_context)}]
    messages += [{"role": m.role, "content": m.content} for m in history]
    # Re-state the output-format rule right before generation. Once the
    # conversation has a few turns, the model's own prior replies in history
    # (plain text, no sentinel/JSON — it was already stripped before saving)
    # outweigh the instruction way back at the top of the system prompt, and
    # the model stops emitting the meta block entirely — silently dropping
    # feedback/suggestions/off-topic detection from turn 2 onward.
    messages.append({"role": "system", "content": chat_ai.JSON_OUTPUT_RULE})
    conversation_id = conversation.id
    conversation_owner_id = conversation.user_id
    user_msg_id = user_msg.id
    sentinel_len = len(chat_ai.META_SENTINEL)

    async def event_stream():
        reply_buffer = ""
        meta_buffer = ""
        pending = ""
        in_meta = False

        # The generator runs after the route function has returned, and
        # whether the request-scoped `db` from Depends(get_db) is still open
        # at that point has changed between FastAPI releases. It writes
        # through a session of its own instead, closed in the finally below,
        # so it doesn't depend on that ordering.
        stream_db = SessionLocal()
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
            stream_db.add(assistant_msg)
            stream_db.commit()
            stream_db.refresh(assistant_msg)

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
                # grade_text is synchronous and slow (BERT inference plus up
                # to three blocking LLM calls). Awaiting it on a worker
                # thread keeps the event loop — and with it every other
                # in-flight request and stream — responsive meanwhile.
                graded = await run_in_threadpool(grade_text, user_message)
                correction = GrammarCorrection(
                    user_id=conversation_owner_id,
                    message_id=user_msg_id,
                    original_text=graded["original_text"],
                    corrected_text=graded["corrected_text"],
                    errors=graded["diffs"],
                    explanation=graded["explanation"],
                    error_count=graded["error_count"],
                )
                stream_db.add(correction)
                stream_db.commit()
                yield sse("grammar", {
                    "message_id": user_msg_id,
                    "corrected_text": graded["corrected_text"],
                    "diffs": graded["diffs"],
                    "error_count": graded["error_count"],
                    "has_errors": graded["has_errors"],
                    "explanation": graded["explanation"],
                })
            except Exception as e:
                print(f"Grammar grading failed: {e}", flush=True)
                stream_db.rollback()
        except httpx.TimeoutException:
            yield sse("error", {"detail": "Request timeout"})
        except httpx.HTTPError as e:
            print(f"Chat API error: {e}", flush=True)
            yield sse("error", {"detail": "API error"})
        finally:
            stream_db.close()

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
                has_errors=bool(m.correction.explanation),
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
        situation_context=conversation.situation_context,
        messages=message_details,
    )
