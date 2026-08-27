from fastapi import APIRouter

from .health import router as health_router
from .correct import router as correct_router
from .alternative import router as alternative_router
from .chat import router as chat_router
from .youtube import router as youtube_router
from .transcribe import router as transcribe_router
from .tts import router as tts_router
from .practice_test import router as practice_router
from .jlpt import router as jlpt_router
from .auth import router as auth_router
from .pronunciation import router as pronunciation_router
from .dictionary import router as dictionary_router
from .user import router as user_router
from .scenarios import router as scenarios_router
from .meeting import router as meeting_router

# Register all routers
def register_routers(app):
    app.include_router(auth_router, prefix="/api")
    app.include_router(health_router, prefix="/api")
    app.include_router(correct_router, prefix="/api")
    app.include_router(alternative_router, prefix="/api")
    app.include_router(chat_router, prefix="/api")
    app.include_router(youtube_router, prefix="/api")
    app.include_router(transcribe_router, prefix="/api")
    app.include_router(tts_router, prefix="/api")
    app.include_router(practice_router, prefix="/api")
    app.include_router(jlpt_router, prefix="/api")
    app.include_router(pronunciation_router, prefix="/api")
    app.include_router(dictionary_router, prefix="/api")
    app.include_router(user_router, prefix="/api")
    app.include_router(scenarios_router, prefix="/api")
    app.include_router(meeting_router, prefix="/api")
