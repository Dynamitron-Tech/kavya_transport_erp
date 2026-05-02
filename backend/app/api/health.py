"""
app/api/health.py
Health check endpoints — no authentication required.
Used by load balancers, UptimeRobot, smoke tests, and pre-deploy validation.
"""
from fastapi import APIRouter
from datetime import datetime, timezone
import time
import logging

log = logging.getLogger(__name__)
router = APIRouter()


async def _check_postgres() -> dict:
    t0 = time.monotonic()
    try:
        from app.db.postgres.connection import AsyncSessionLocal
        from sqlalchemy import text
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        ms = round((time.monotonic() - t0) * 1000)
        return {"status": "ok", "response_ms": ms}
    except Exception as e:
        return {"status": "down", "error": str(e)[:120]}


async def _check_redis() -> dict:
    t0 = time.monotonic()
    try:
        import redis.asyncio as aioredis
        from app.core.config import settings
        r = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=3)
        await r.ping()
        await r.aclose()
        ms = round((time.monotonic() - t0) * 1000)
        return {"status": "ok", "response_ms": ms}
    except Exception as e:
        return {"status": "down", "error": str(e)[:120]}


async def _check_mongo() -> dict:
    t0 = time.monotonic()
    try:
        from app.db.mongodb.connection import MongoDB
        db = MongoDB.get_db()
        await db.command("ping")
        ms = round((time.monotonic() - t0) * 1000)
        return {"status": "ok", "response_ms": ms}
    except Exception as e:
        return {"status": "degraded", "error": str(e)[:120]}


async def _check_celery() -> dict:
    t0 = time.monotonic()
    try:
        from app.celery_app import celery_app
        inspector = celery_app.control.inspect(timeout=5)
        active = inspector.active()
        ms = round((time.monotonic() - t0) * 1000)
        if active is None:
            return {"status": "degraded", "error": "No workers responded", "response_ms": ms}
        worker_count = len(active)
        return {"status": "ok", "workers": worker_count, "response_ms": ms}
    except Exception as e:
        return {"status": "down", "error": str(e)[:120]}


# ── Liveness probe ──────────────────────────────────────────────
@router.get("/health", tags=["Health"], include_in_schema=False)
async def health_liveness():
    """Basic liveness — returns 200 if the app process is running."""
    return {
        "status": "ok",
        "service": "kavya-transports-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── PostgreSQL check ───────────────────────────────────────────
@router.get("/health/db", tags=["Health"], include_in_schema=False)
async def health_db():
    result = await _check_postgres()
    status_code = 200 if result["status"] == "ok" else 503
    from fastapi.responses import JSONResponse
    return JSONResponse(content=result, status_code=status_code)


# ── Redis check ────────────────────────────────────────────────
@router.get("/health/redis", tags=["Health"], include_in_schema=False)
async def health_redis():
    result = await _check_redis()
    status_code = 200 if result["status"] == "ok" else 503
    from fastapi.responses import JSONResponse
    return JSONResponse(content=result, status_code=status_code)


# ── Celery check ───────────────────────────────────────────────
@router.get("/health/celery", tags=["Health"], include_in_schema=False)
async def health_celery():
    result = await _check_celery()
    status_code = 200 if result["status"] == "ok" else 503
    from fastapi.responses import JSONResponse
    return JSONResponse(content=result, status_code=status_code)


# ── Full readiness probe ────────────────────────────────────────
@router.get("/health/full", tags=["Health"], include_in_schema=False)
async def health_full():
    import asyncio
    pg, redis, mongo, celery = await asyncio.gather(
        _check_postgres(),
        _check_redis(),
        _check_mongo(),
        _check_celery(),
    )

    checks = {
        "postgres": pg,
        "redis": redis,
        "mongodb": mongo,
        "celery": celery,
    }

    # Critical: postgres + redis must be ok
    critical_ok = pg["status"] == "ok" and redis["status"] == "ok"
    any_down = any(v["status"] == "down" for v in checks.values())

    if not critical_ok:
        overall = "down"
        status_code = 503
    elif any_down:
        overall = "degraded"
        status_code = 200  # degraded is still OK for load balancer
    else:
        overall = "ok"
        status_code = 200

    from fastapi.responses import JSONResponse
    return JSONResponse(
        content={
            "status": overall,
            "checks": checks,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        status_code=status_code,
    )
