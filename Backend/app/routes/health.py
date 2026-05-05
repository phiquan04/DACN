import os
from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "Japanese VA Backend",
        "youtube_api": "configured" if os.environ.get('YOUTUBE_API_KEY') else "NOT CONFIGURED",
        "openai_api": "configured" if os.environ.get('OPENAI_API_KEY') else "NOT CONFIGURED",
        "openrouter_api": "configured" if os.environ.get('OPENROUTER_API_KEY') else "NOT CONFIGURED",
    }
