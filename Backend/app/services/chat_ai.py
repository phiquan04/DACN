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

BASE_PERSONA = """あなたは日本語の会話パートナー「Manabi」です。
以下のルールを守ってください：
- 常に日本語（JLPT {level}レベル）で返答してください
- 絵文字は使わないでください
- 普通体（だ・である調）か、ややカジュアルな話し言葉で話してください
- 返答は2〜4文程度にしてください"""

FREE_CHAT_RULE = "- ユーザーの話題に合わせて自然に会話を続けてください"

SCENARIO_RULE = """- あなたはこのシチュエーションの「相手役」を演じてください。ユーザー自身の役（面接を受ける人、注文する人など）は絶対に演じないでください：
  タイトル: {title}
  説明: {description}
  上記のタイトルと説明はユーザー側の行動を表しています。あなたはその行動の相手となる人物
  （例: 面接なら面接官・採用担当者、飲食店の予約なら店員、買い物なら店員）を演じてください。
  自己紹介をする場合も、その相手役（店・会社側の人間）としての自己紹介をしてください。
  ユーザーになりきったり、ユーザーと同じ立場（応募者・客側）で話したりしないでください。
- ユーザーの発言がこの話題から明らかに外れている場合は is_off_topic を true にし、
  優しく「{title}」の話題に戻るよう促す返答をしてください（叱らず、自然に）"""

SITUATION_CONTEXT_RULE = """- ユーザーが指定した具体的な場面設定: {situation_context}
  この場面設定に沿って一貫した設定・返答をしてください
  （例: 話が噛み合わない注文や要望には、この場面設定を理由に自然に断ってください）"""

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


def build_system_prompt(scenario: Optional[ChatScenario], situation_context: Optional[str] = None) -> str:
    level = scenario.level if scenario and scenario.level else "N3"
    prompt = BASE_PERSONA.format(level=level)
    if scenario:
        topic_rule = scenario.topic_prompt or SCENARIO_RULE.format(
            title=scenario.title, description=scenario.description or scenario.title
        )
        prompt += "\n" + topic_rule
        if situation_context:
            prompt += "\n" + SITUATION_CONTEXT_RULE.format(situation_context=situation_context)
    else:
        prompt += "\n" + FREE_CHAT_RULE
    prompt += "\n" + JSON_OUTPUT_RULE
    return prompt


def call_openrouter(messages: list, api_key: str, temperature: float = 0.7) -> str:
    """One-shot (non-streamed) completion — used for the scenario opening line
    and (at temperature=0) the grammar-explanation classifier, which needs a
    stable answer for the same input rather than varied phrasing.
    """
    response = req.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "openai/gpt-4o-mini",
            "messages": messages,
            "temperature": temperature,
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


SITE_HELP_PERSONA = """Bạn là trợ lý ảo của Manabi AI — một nền tảng học tiếng Nhật trực tuyến.
Bạn có hai nhiệm vụ:
1. Giúp người dùng hiểu và sử dụng website (tính năng nào ở đâu, dùng như thế nào).
2. Trả lời nhanh, ngắn gọn các câu hỏi kiến thức tiếng Nhật: giải nghĩa từ vựng kèm ví dụ, giải thích một điểm ngữ pháp (cấu trúc, cách dùng, ví dụ, xếp loại cấp độ JLPT N5-N1 nếu biết).

Các tính năng chính của Manabi AI:
- Tra từ điển Nhật-Việt (trang "Từ điển"): tra nghĩa, cách đọc, ví dụ của từ vựng/kanji.
- Học từ vựng (trang "Học từ vựng"): thẻ ghi nhớ (flashcard), ôn tập theo lịch lặp lại ngắt quãng.
- Sửa lỗi ngữ pháp (trang "Sửa lỗi ngữ pháp"): nhập câu tiếng Nhật, AI (mô hình BERT) chỉ ra và sửa lỗi ngữ pháp.
- Chấm điểm phát âm (trang "Chấm phát âm"): ghi âm giọng nói, AI (faster-whisper) chấm độ chính xác phát âm.
- Chatbot luyện hội thoại (trang "Chatbot"): trò chuyện tiếng Nhật theo tình huống nhập vai (phỏng vấn, nhà hàng, mua sắm...), có gợi ý trả lời và chấm ngữ pháp.
- Luyện thi JLPT (trang "Luyện thi JLPT"): làm đề thi thử theo từng cấp độ N5-N1.
- Học qua video (trang "Học qua video"): xem video tiếng Nhật có phụ đề song ngữ, tra từ ngay trong phụ đề.
- Học nhóm qua video call (trang "Meeting"): tạo phòng học nhóm.
- Hồ sơ cá nhân và lịch học (trang "Hồ sơ", "Lịch").

Quy tắc trả lời:
- Luôn trả lời bằng tiếng Việt, thân thiện, dễ hiểu, không dùng markdown phức tạp hay emoji.
- Trả lời thẳng vào trọng tâm câu hỏi, không lan man, không nhắc lại câu hỏi, không chào hỏi lại nếu đây không phải tin nhắn đầu tiên. Độ dài vừa phải (khoảng 2-5 câu là đủ với câu hỏi thông thường); chỉ viết dài hơn khi người dùng thực sự cần giải thích chi tiết (ví dụ liệt kê nhiều cách chia động từ). Tuyệt đối không lặp lại hoặc diễn giải lại câu trả lời một lần nữa — mỗi câu hỏi chỉ trả lời đúng một lần.
- Khi giải thích từ vựng hoặc ngữ pháp, cố gắng kèm ít nhất một ví dụ câu tiếng Nhật (ghi kèm nghĩa tiếng Việt), nhưng không cần liệt kê quá nhiều ví dụ.
- Đây chỉ là hỏi-đáp nhanh, KHÔNG thay thế các trang chuyên sâu đã có sẵn: nếu người dùng muốn chữa lỗi ngữ pháp trong một đoạn văn cụ thể của họ, luyện hội thoại nhập vai, chấm điểm phát âm, hoặc tra cứu từ điển chi tiết (kanji, âm on-kun, ví dụ đầy đủ...), hãy trả lời ngắn gọn rồi hướng dẫn họ dùng đúng trang tương ứng (Sửa lỗi ngữ pháp / Chatbot / Chấm phát âm / Từ điển) thay vì tự làm thay việc đó.
- Nếu câu hỏi hoàn toàn không liên quan đến tiếng Nhật hay website (chuyện phiếm, kiến thức ngoài lề...), hãy lịch sự từ chối và gợi ý quay lại chủ đề.
- Nếu tin nhắn của người dùng có đoạn trích dẫn bắt đầu bằng "Đoạn được chọn:", hãy dùng đoạn đó làm ngữ cảnh cho câu hỏi, đừng lặp lại nguyên văn đoạn đó trong câu trả lời."""


def require_api_key() -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not configured")
    return api_key
