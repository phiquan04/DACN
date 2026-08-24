import json
import os
import re
from typing import Optional

import httpx
import requests as req
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models import ChatScenario, Conversation, Message
from app.models.database import get_db
from app.utils.auth import verify_token

router = APIRouter()

BASE_PERSONA = """あなたは日本語の会話パートナー「Kizuna」です。
以下のルールを守ってください：
- 常に日本語（JLPT {level}レベル）で返答してください
- 絵文字は使わないでください
- 普通体（だ・である調）か、ややカジュアルな話し言葉で話してください
- 返答は2〜4文程度にしてください"""

FREE_CHAT_RULE = "- ユーザーの話題に合わせて自然に会話を続けてください"

SCENARIO_RULE = """- あなたはこのシチュエーションの相手役を演じてください：
  タイトル: {title}
  説明: {description}
- ユーザーの発言がこの話題から明らかに外れている場合は is_off_topic を true にし、
  優しく「{title}」の話題に戻るよう促す返答をしてください（叱らず、自然に）"""

# The reply body is streamed to the client as plain text as it arrives, so it
# must come first and stay free of JSON/markdown wrapping. The metadata JSON
# comes after a sentinel line the backend uses to split the two: everything
# before it is forwarded live, everything after is buffered and parsed once
# the stream ends.
META_SENTINEL = "<<<META>>>"

JSON_OUTPUT_RULE = f"""
必ず次の順番で出力してください：
1. まず日本語の返答本文だけをそのまま出力してください（2〜4文、引用符やコードブロックで囲まないでください）。
2. 返答本文の直後に改行し、"{META_SENTINEL}" という行だけを出力してください。
3. その次の行に、必ず次のJSON形式のみを出力してください（マークダウンのコードブロックは付けないでください）：
{{"feedback": "ユーザーの直前の発言に対するベトナム語での短いアドバイス。特に問題なければnull", "is_off_topic": true または false, "suggestions": ["短い返信候補1", "短い返信候補2", "短い返信候補3"]}}"""


class StartConversationRequest(BaseModel):
    scenario_id: Optional[int] = None


class ChatRequest(BaseModel):
    conversation_id: int
    message: str


def get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[int]:
    if not authorization:
        return None
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            return None
    except ValueError:
        return None
    token_data = verify_token(token)
    return token_data.user_id if token_data else None


def build_system_prompt(scenario: Optional[ChatScenario]) -> str:
    level = scenario.level if scenario and scenario.level else "N3"
    prompt = BASE_PERSONA.format(level=level)
    if scenario:
        topic_rule = scenario.topic_prompt or SCENARIO_RULE.format(
            title=scenario.title, description=scenario.description or scenario.title
        )
        prompt += "\n" + topic_rule
    else:
        prompt += "\n" + FREE_CHAT_RULE
    prompt += "\n" + JSON_OUTPUT_RULE
    return prompt


def call_openrouter(messages: list, api_key: str) -> str:
    """One-shot (non-streamed) completion — used for the scenario opening line."""
    response = req.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "openai/gpt-4o-mini",
            "messages": messages,
            "temperature": 0.7,
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


async def stream_openrouter(messages: list, api_key: str):
    """Yields raw text deltas from OpenRouter's streaming chat completion."""
    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream(
            "POST",
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "openai/gpt-4o-mini",
                "messages": messages,
                "temperature": 0.7,
                "stream": True,
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                payload = line[len("data: "):].strip()
                if payload == "[DONE]":
                    break
                try:
                    chunk = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content")
                if delta:
                    yield delta


def parse_meta_json(raw: str) -> dict:
    cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        parsed = json.loads(cleaned)
        return {
            "feedback": parsed.get("feedback"),
            "is_off_topic": bool(parsed.get("is_off_topic", False)),
            "suggestions": parsed.get("suggestions") or [],
        }
    except (json.JSONDecodeError, AttributeError):
        return {"feedback": None, "is_off_topic": False, "suggestions": []}


def require_api_key() -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not configured")
    return api_key


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
            api_key = require_api_key()
            opener_prompt = (
                f"あなたはロールプレイの相手役です。シチュエーション「{scenario.title}」"
                f"（{scenario.description or scenario.title}）を始めるための最初の一言を日本語で話してください。"
                "2〜3文程度で、挨拶と自己紹介を含めてください。JSONは不要で、日本語の発話のみを出力してください。"
            )
            opening_text = call_openrouter(
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

    api_key = require_api_key()

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

    messages = [{"role": "system", "content": build_system_prompt(scenario)}]
    messages += [{"role": m.role, "content": m.content} for m in history]
    conversation_id = conversation.id
    sentinel_len = len(META_SENTINEL)

    async def event_stream():
        reply_buffer = ""
        meta_buffer = ""
        pending = ""
        in_meta = False

        try:
            async for delta in stream_openrouter(messages, api_key):
                if in_meta:
                    meta_buffer += delta
                    continue

                pending += delta
                idx = pending.find(META_SENTINEL)
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
            parsed_meta = parse_meta_json(meta_buffer)

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
