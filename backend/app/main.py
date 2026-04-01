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

    # Register intelligence event consumers
    try:
        from app.services.event_consumers import register_all_consumers
        register_all_consumers()
        logger.info("Intelligence event consumers registered")
    except Exception as e:
        logger.warning(f"Event consumer registration failed: {e}")

    # Seed system config (idempotent)
    try:
        from app.db.postgres.connection import AsyncSessionLocal
        from app.services.config_service import seed_system_config, seed_event_priority_config
        async with AsyncSessionLocal() as db:
            await seed_system_config(db)
            await seed_event_priority_config(db)
            await db.commit()
            logger.info("System config + event priority config seeded")
    except Exception as e:
        logger.warning(f"System config seeding skipped: {e}")

    # Start TMS Automation Scheduler (APScheduler cron jobs)
    try:
        from app.schedulers.tms_scheduler import start_tms_scheduler
        start_tms_scheduler()
        logger.info("TMS Automation Scheduler started")
    except Exception as e:
        logger.warning(f"TMS Scheduler start failed: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Transport ERP API...")
    try:
        from app.schedulers.tms_scheduler import stop_tms_scheduler
        stop_tms_scheduler()
    except Exception:
        pass
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


# ── Public tracking endpoint (no auth required) ────────────
from fastapi import HTTPException as _HTTPException
from app.services import portal_service as _portal_svc

@app.get("/portal/track/{token}", tags=["Public Tracking"])
async def public_tracking(token: str):
    """Public shipment tracking by token — no authentication needed."""
    info = _portal_svc.validate_tracking_token(token)
    if not info:
        raise _HTTPException(status_code=404, detail="Invalid or expired tracking link")
    return {"success": True, "data": info}


# Mount local uploads directory for serving uploaded files
from pathlib import Path as _Path
from fastapi.staticfiles import StaticFiles as _StaticFiles
_uploads_dir = _Path(__file__).resolve().parents[1] / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", _StaticFiles(directory=str(_uploads_dir)), name="uploads")


# ── WebSocket endpoint ─────────────────────────────────────
from fastapi import WebSocket, WebSocketDisconnect
from app.websocket.manager import ws_manager, authenticate_websocket

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for real-time features."""
    payload = await authenticate_websocket(websocket)
    if not payload:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    user_id = int(payload.get("sub", 0))
    await ws_manager.connect(websocket, channel="general")
    await ws_manager.connect_user(websocket, user_id)

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action") or data.get("type")

            if action == "subscribe_vehicle":
                vid = data.get("vehicle_id")
                if vid:
                    ws_manager.subscribe_vehicle(websocket, int(vid))
            elif action == "unsubscribe_vehicle":
                vid = data.get("vehicle_id")
                if vid:
                    ws_manager.vehicle_subscribers.get(int(vid), set()).discard(websocket)
            elif action == "subscribe_trip":
                tid = data.get("trip_id")
                if tid:
                    ws_manager.subscribe_trip(websocket, int(tid))
            elif action == "unsubscribe_trip":
                tid = data.get("trip_id")
                if tid:
                    ws_manager.trip_subscribers.get(int(tid), set()).discard(websocket)
            elif action == "subscribe_tyre_vehicle":
                vid = data.get("vehicle_id")
                if vid:
                    ws_manager.subscribe_tyre_vehicle(websocket, int(vid))
            elif action == "unsubscribe_tyre_vehicle":
                vid = data.get("vehicle_id")
                if vid:
                    ws_manager.tyre_subscribers.get(int(vid), set()).discard(websocket)
            elif action == "subscribe_tyre_alerts":
                ws_manager.subscribe_tyre_alerts(websocket)
            elif action == "pong":
                pass  # keep-alive response
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, channel="general")
    except Exception:
        ws_manager.disconnect(websocket, channel="general")


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
