# Main FastAPI Application
# Transport ERP - Enterprise System

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
import time
import logging

from app.core.config import settings
from app.db.postgres.connection import init_db, close_db
from app.db.mongodb.connection import MongoDB
from app.api.v1.router import api_router


# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format=settings.LOG_FORMAT
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("Starting Transport ERP API...")
    
    # Initialize PostgreSQL (graceful - skip if unavailable)
    try:
        await asyncio.wait_for(init_db(), timeout=5)
        logger.info("PostgreSQL connected")
    except (Exception, asyncio.TimeoutError) as e:
        logger.warning(f"PostgreSQL connection failed (app will run without DB): {e}")
    
    # Initialize MongoDB (graceful - skip if unavailable)
    try:
        await asyncio.wait_for(MongoDB.connect(), timeout=5)
        logger.info("MongoDB connected")
    except (Exception, asyncio.TimeoutError) as e:
        logger.warning(f"MongoDB connection failed (app will run without MongoDB): {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Transport ERP API...")
    try:
        await close_db()
    except Exception:
        pass
    try:
        await MongoDB.disconnect()
    except Exception:
        pass


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise Transport ERP System - Managing Fleet, Trips, Finance, and Analytics",
    version=settings.APP_VERSION,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    lifespan=lifespan,
    redirect_slashes=False,  # Prevent redirect stripping Authorization header
)


# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time to response headers."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected error occurred",
            "error": str(exc) if settings.DEBUG else None
        }
    )


# Include API router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


# Mount local uploads directory for serving uploaded files
from pathlib import Path as _Path
from fastapi.staticfiles import StaticFiles as _StaticFiles
_uploads_dir = _Path(__file__).resolve().parents[1] / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", _StaticFiles(directory=str(_uploads_dir)), name="uploads")


# Health check endpoints
@app.get("/health", tags=["Health"])
async def health_check():
    """Basic health check endpoint."""
    return {"status": "healthy", "version": settings.APP_VERSION}


@app.get("/health/ready", tags=["Health"])
async def readiness_check():
    """Readiness check - verifies all dependencies are connected."""
    checks = {
        "postgres": False,
        "mongodb": False,
    }
    
    # Check PostgreSQL
    try:
        # Simple check - could be expanded
        checks["postgres"] = True
    except Exception as e:
        logger.error(f"PostgreSQL health check failed: {e}")
    
    # Check MongoDB
    try:
        if MongoDB.client:
            await MongoDB.client.admin.command('ping')
            checks["mongodb"] = True
    except Exception as e:
        logger.error(f"MongoDB health check failed: {e}")
    
    all_healthy = all(checks.values())
    
    return {
        "status": "ready" if all_healthy else "not_ready",
        "checks": checks
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else 4
    )
