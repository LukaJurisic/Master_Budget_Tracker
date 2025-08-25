"""Main FastAPI application."""
print(">>> LOADED bt_app.main FROM:", __file__)
print(">>> BT_APP PACKAGE IS NOW ACTIVE!")
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, ORJSONResponse
from fastapi.routing import APIRoute

from .core.config import settings
from .core.db import engine
from .core.scheduler import start_scheduler, stop_scheduler
from .models import base  # Import to register models
from .api.routes_root import api_router
from .api.routes_analytics_freq import router as analytics_freq_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting Budget Tracker API")
    
    # Start the scheduler
    try:
        start_scheduler()
        logger.info("Scheduler started successfully")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")
    
    # DB connection probe
    try:
        from sqlalchemy import text
        from .core.db import SessionLocal
        from .core.config import settings
        
        with SessionLocal() as s:
            s.execute(text("SELECT 1"))
        logger.info("DB check OK -> %s", settings.absolute_database_url)
    except Exception as e:
        logger.exception("DB check FAILED -> %s", e)
    
    yield
    
    # Shutdown
    logger.info("Shutting down Budget Tracker API")
    
    # Stop the scheduler
    try:
        stop_scheduler()
        logger.info("Scheduler stopped successfully")
    except Exception as e:
        logger.error(f"Failed to stop scheduler: {e}")


# Create FastAPI app
app = FastAPI(
    title="Budget Tracker API",
    description="Personal budget tracking application with Plaid integration",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React dev server
        "http://127.0.0.1:3000",
        f"http://localhost:{settings.frontend_port}",
        f"http://127.0.0.1:{settings.frontend_port}",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api")

# Mount the frequency router under the same prefix the FE expects
app.include_router(analytics_freq_router, prefix="/api/analytics", tags=["analytics"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Budget Tracker API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/__routes")
def __routes():
    """Debug endpoint to see which file handles each route."""
    out = []
    for r in app.routes:
        if isinstance(r, APIRoute):
            fn = r.endpoint
            out.append({
                "path": r.path,
                "endpoint": f"{fn.__module__}.{fn.__name__}",
                "file": getattr(fn, "__globals__", {}).get("__file__", None),
            })
    return out


@app.get("/__version")
def version():
    """Version endpoint to track what backend build is running."""
    from datetime import datetime
    import os, subprocess
    
    try:
        commit = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], 
            cwd=os.getcwd()
        ).decode().strip()
    except Exception:
        commit = os.getenv("GIT_COMMIT", "unknown")
    
    return {
        "service": "budget-tracker-api",
        "commit": commit,
        "time": datetime.utcnow().isoformat() + "Z",
        "port": int(os.getenv("PORT", 8001)),
        "fixes_applied": ["surgical-query-parsing", "case-insensitive-txn-type", "error-handling"]
    }

@app.get("/__debug/database")
def debug_database():
    """Debug database configuration."""
    import os
    from .core.config import settings
    
    raw_url = settings.database_url
    abs_url = settings.absolute_database_url
    
    result = {
        "raw_database_url": raw_url,
        "absolute_database_url": abs_url,
        "DATABASE_URL_env": os.getenv("DATABASE_URL", "NOT_SET")
    }
    
    if abs_url.startswith("sqlite:///"):
        db_path = abs_url.replace("sqlite:///", "")
        result["database_file_path"] = db_path
        result["file_exists"] = os.path.exists(db_path)
        
        # Try Windows path format
        if "/" in db_path:
            db_path_win = db_path.replace("/", "\\")
            result["database_file_path_windows"] = db_path_win
            result["file_exists_windows"] = os.path.exists(db_path_win)
    
    return result


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler with detailed logging."""
    import traceback
    
    # Log the full error with context
    logger.error(
        f"Unhandled error on {request.method} {request.url.path} - {type(exc).__name__}: {exc}",
        exc_info=True
    )
    
    # Log request details for debugging
    logger.error(f"Query params: {dict(request.query_params)}")
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "detail": str(exc),
            "type": type(exc).__name__,
            "path": request.url.path
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=True
    )















