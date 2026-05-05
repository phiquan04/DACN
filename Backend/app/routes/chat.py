import os
import requests as req
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class ChatRequest(BaseModel):
    message: str

SYSTEM_PROMPT = """あなたは日本語の会話パートナーです。
以下のルールを守ってください：
- 常に日本語（JLPT N3レベル）で返答してください
- 絵文字は使わないでください
- 普通体（だ・である調）か、ややカジュアルな話し言葉で話してください
- 返答は2〜4文程度にしてください
- ユーザーの話題に合わせて自然に会話を続けてください"""

@router.post('/chat')
async def chat(request: ChatRequest):
    try:
        api_key = os.environ.get('OPENROUTER_API_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail='OPENROUTER_API_KEY not configured')

        user_message = request.message.strip()
        if not user_message:
            raise HTTPException(status_code=400, detail="Empty message")

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message}
        ]

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
            timeout=30
        )

        response.raise_for_status()
        data = response.json()
        reply = data["choices"][0]["message"]["content"]

        return {"reply": reply}

    except req.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Request timeout")
    except req.exceptions.RequestException as e:
        print(f"Chat API error: {e}")
        raise HTTPException(status_code=503, detail="API error")
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
