from fastapi import APIRouter

from .health import router as health_router
from .correct import router as correct_router
from .alternative import router as alternative_router
from .chat import router as chat_router
from .site_help import router as site_help_router
from .youtube import router as youtube_router
from .transcribe import router as transcribe_router
from .tts import router as tts_router
from .jlpt import router as jlpt_router
from .vocabulary import router as vocabulary_router
from .auth import router as auth_router
from .pronunciation import router as pronunciation_router
from .dictionary import router as dictionary_router
from .user import router as user_router
from .admin_users import router as admin_users_router
from .admin_dashboard import router as admin_dashboard_router
from .scenarios import router as scenarios_router
from .admin_scenarios import router as admin_scenarios_router
from .meeting import router as meeting_router
from .notifications import router as notifications_router

# Register all routers
def register_routers(app):
    app.include_router(auth_router, prefix="/api")
    app.include_router(health_router, prefix="/api")
    app.include_router(correct_router, prefix="/api")
    app.include_router(alternative_router, prefix="/api")
    app.include_router(chat_router, prefix="/api")
    app.include_router(site_help_router, prefix="/api")
    app.include_router(youtube_router, prefix="/api")
    app.include_router(transcribe_router, prefix="/api")
    app.include_router(tts_router, prefix="/api")
    app.include_router(jlpt_router, prefix="/api")
    app.include_router(vocabulary_router, prefix="/api")
    app.include_router(pronunciation_router, prefix="/api")
    app.include_router(dictionary_router, prefix="/api")
    app.include_router(user_router, prefix="/api")
    app.include_router(admin_users_router, prefix="/api")
    app.include_router(admin_dashboard_router, prefix="/api")
    app.include_router(scenarios_router, prefix="/api")
    app.include_router(admin_scenarios_router, prefix="/api")
    app.include_router(meeting_router, prefix="/api")
    app.include_router(notifications_router, prefix="/api")
