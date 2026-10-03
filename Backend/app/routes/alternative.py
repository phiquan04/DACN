import os
import re
import json
import time
from typing import Optional

import requests as req
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_optional_user_id
from app.models import GrammarCorrection
from app.models.database import get_db
from app.schemas.grammar import AlternativeRequest
from app.utils.rate_limit import rate_limit

router = APIRouter()


def _call_openrouter(api_key: str, prompt: str, retries: int = 3) -> str:
    url = "https://openrouter.ai/api/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "My App",
    }

    data = {
        "model": "openai/gpt-4o-mini",  # 🔥 đổi model
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
    }

    for attempt in range(retries):
        response = req.post(url, headers=headers, json=data, timeout=30)

        print("STATUS:", response.status_code)
        print("RESPONSE:", response.text)

        if response.status_code == 429:
            wait = 2 ** attempt
            time.sleep(wait)
            continue

        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()

    raise Exception("OpenRouter lỗi sau nhiều lần retry")


@router.post('/alternative', dependencies=[Depends(rate_limit("grammar-alt", limit=20, window_seconds=60))])
def alternative(
    request: AlternativeRequest,
    user_id: Optional[int] = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
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
        alternatives = data['alternatives']

        # Attach to the originating history record, if any (best-effort).
        if request.history_id is not None and user_id is not None:
            try:
                record = db.query(GrammarCorrection).filter(
                    GrammarCorrection.id == request.history_id,
                    GrammarCorrection.user_id == user_id,
                ).first()
                if record:
                    record.alternatives = alternatives
                    db.commit()
            except Exception as e:
                print(f'Failed to save alternatives to history: {e}')
                db.rollback()

        return {'alternatives': alternatives}

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