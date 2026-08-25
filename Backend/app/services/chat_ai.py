"""OpenRouter-backed conversation AI for the chatbot feature: system-prompt
building, one-shot and streaming completions, and parsing the trailing
metadata block the model is asked to emit after its reply.
"""
import json
import os
import re
from typing import Optional

import httpx
import requests as req
from fastapi import HTTPException

from app.models import ChatScenario

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
