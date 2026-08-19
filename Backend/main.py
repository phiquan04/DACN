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
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
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