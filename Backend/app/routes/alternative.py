import os
import re
import json
import time
import requests as req
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class AlternativeRequest(BaseModel):
    text: str


def _call_openrouter(api_key: str, prompt: str, retries: int = 3) -> str:
    for attempt in range(retries):
        response = req.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': 'google/gemma-3-4b-it:free',
                'messages': [{'role': 'user', 'content': prompt}],
                'temperature': 0.7,
            },
            timeout=30
        )

        if response.status_code == 429:
            wait = 2 ** attempt  # 1s, 2s, 4s
            print(f'Rate limited (429), retry {attempt + 1}/{retries} after {wait}s...', flush=True)
            time.sleep(wait)
            continue

        response.raise_for_status()
        return response.json()['choices'][0]['message']['content'].strip()

    raise HTTPException(status_code=429, detail='OpenRouter rate limit - vui lòng thử lại sau vài giây')


@router.post('/alternative')
async def alternative(request: AlternativeRequest):
    try:
        api_key = os.environ.get('OPENROUTER_API_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail='OPENROUTER_API_KEY not set')

        text = request.text.strip()
        if not text:
            raise HTTPException(status_code=400, detail='Missing text')

        prompt = f"""以下の日本語の文を、意味を変えずに3つの異なる表現で言い換えてください。
            元の文: 「{text}」

            以下のJSON形式のみで返答してください（説明不要、マークダウン不要）:
            {{"alternatives": ["言い換え1", "言い換え2", "言い換え3"]}}"""

        raw = _call_openrouter(api_key, prompt)
        clean = re.sub(r'```json|```', '', raw).strip()
        data = json.loads(clean)

        return {'alternatives': data['alternatives']}

    except HTTPException:
        raise
    except req.exceptions.Timeout:
        raise HTTPException(status_code=504, detail='Request timeout')
    except req.exceptions.RequestException as e:
        print(f'Alternative API error: {e}')
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        print(f'Alternative error: {e}')
        raise HTTPException(status_code=500, detail=str(e))