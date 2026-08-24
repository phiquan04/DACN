import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.models import init_db
from app.routes import register_routers

def app():
    """Application factory"""
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
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Content-Type"],
    )
    
    # Initialize database
    init_db(app)
    
    # Register all routers
    register_routers(app)
    
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
        return JSONResponse(
            status_code=500,
            content={"error": str(exc)}
        )
    
    return app


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app(), host='127.0.0.1', port=8080)