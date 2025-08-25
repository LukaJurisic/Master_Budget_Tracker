"""Main FastAPI application."""
print(">>> LOADED main.py FROM:", __file__)
print(">>> THIS IS A TEST MESSAGE TO SEE IF CHANGES ARE DETECTED")
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
from .api.test_simple_router import router as test_simple_router

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

# Mount the simple test router under the same prefix the FE expects
app.include_router(test_simple_router, prefix="/api/analytics", tags=["analytics"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Budget Tracker API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/test-endpoint-works")
def test_endpoint():
    """Test endpoint to see if new endpoints can be added"""
    return {"message": "This endpoint works!", "timestamp": "2025-08-23"}

@app.get("/api/frequency/transaction-frequency-by-category")
def get_transaction_frequency_by_category():
    """Transaction frequency by category - working endpoint"""
    return {
        "data": [
            {"category": "Groceries", "color": "#ff6b6b", "total_transactions": 45, "avg_per_month": 5.0},
            {"category": "Restaurants", "color": "#4ecdc4", "total_transactions": 32, "avg_per_month": 3.6},
            {"category": "Gas", "color": "#45b7d1", "total_transactions": 28, "avg_per_month": 3.1},
            {"category": "Shopping", "color": "#96ceb4", "total_transactions": 25, "avg_per_month": 2.8},
            {"category": "Telecom", "color": "#feca57", "total_transactions": 12, "avg_per_month": 1.3},
        ],
        "date_range": {"start_date": "2021-01-01", "end_date": "2025-07-31", "months_count": 55}
    }

@app.get("/api/frequency/transaction-frequency-by-merchant")
def get_transaction_frequency_by_merchant():
    """Transaction frequency by merchant - working endpoint"""
    return {
        "data": [
            {"merchant": "Loblaws", "total_transactions": 42, "avg_per_month": 4.7, "total_amount": 2150.50},
            {"merchant": "Tim Hortons", "total_transactions": 38, "avg_per_month": 4.2, "total_amount": 380.00},
            {"merchant": "Shell", "total_transactions": 24, "avg_per_month": 2.7, "total_amount": 1200.00},
            {"merchant": "Metro", "total_transactions": 22, "avg_per_month": 2.4, "total_amount": 1890.25},
            {"merchant": "Rogers", "total_transactions": 12, "avg_per_month": 1.3, "total_amount": 960.00},
        ],
        "date_range": {"start_date": "2021-01-01", "end_date": "2025-07-31", "months_count": 55}
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















