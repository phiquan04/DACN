import os
import sys

from dotenv import load_dotenv

load_dotenv()

# On Windows, stdout/stderr default to the console's legacy codepage (e.g.
# cp1252), not UTF-8 — any print() of Japanese/Vietnamese text (word lookups,
# debug logs) then raises UnicodeEncodeError and takes the request down with
# it. Force UTF-8 unconditionally so logging never crashes on non-ASCII text.
#
# Setting the env var (not just reconfigure()) matters: `uvicorn --reload` on
# Windows serves requests from a `multiprocessing.spawn` child that re-execs
# a fresh `python.exe`, which re-reads PYTHONIOENCODING at interpreter start —
# reconfigure() alone only fixes the parent/reloader process, not that child.
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
os.environ.setdefault("PYTHONUTF8", "1")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_config
from app.models import init_db
from app.routes import register_routers
from app.services.reminder_scheduler import start_reminder_scheduler, stop_reminder_scheduler

def app():
    """Application factory"""
    cfg = get_config()
    app = FastAPI(
        title="Japanese VA Backend",
        description="Backend API for Japanese Learning Virtual Assistant",
        version="1.0.0"
    )
    
    # Setup CORS Middleware
    # Auth uses a Bearer token attached manually per-request (see
    # Frontend/src/services/api.ts), never browser-managed cookies, so
    # allow_credentials stays False — that also lets allow_origins be a
    # concrete allow-list instead of "*" (the two can't safely be combined).
    allowed_origins = [
        origin.strip()
        for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Content-Type"],
    )
    
    # Initialize database
    init_db(app)
    
    # Register all routers
    register_routers(app)

    # Study-reminder email job (see app/services/reminder_scheduler.py)
    app.add_event_handler("startup", start_reminder_scheduler)
    app.add_event_handler("shutdown", stop_reminder_scheduler)

    # Health check endpoint
    @app.get("/")
    def root():
        return {
            "message": "Welcome to Japanese VA Backend",
            "docs": "/docs",
            "status": "running"
        }
    
    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
        print(f"Unhandled exception: {exc}", flush=True)
        # Full detail is logged above; the response only echoes it back in
        # DEBUG mode — otherwise a 500 could leak internal error messages
        # (file paths, DB errors, stack info) to the client.
        detail = str(exc) if cfg.DEBUG else "Internal server error"
        return JSONResponse(
            status_code=500,
            content={"error": detail}
        )
    
    return app


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app(), host='127.0.0.1', port=8080)