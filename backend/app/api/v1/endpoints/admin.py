from typing import Dict
import importlib

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import TokenData, get_current_user
from app.db.mongodb.connection import MongoDB
from app.db.postgres.connection import get_db
from app.schemas.base import APIResponse

router = APIRouter()


@router.get("/health", response_model=APIResponse)
async def admin_health(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    roles = {role.lower() for role in (current_user.roles or [])}
    if "admin" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    checks: Dict[str, str] = {
        "postgresql": "error",
        "mongodb": "error",
        "redis": "error",
        "celery": "stopped",
    }

    # PostgreSQL
    try:
        await db.execute(text("SELECT 1"))
        checks["postgresql"] = "connected"
    except Exception:
        checks["postgresql"] = "error"

    # MongoDB
    try:
        if MongoDB.client is not None:
            await MongoDB.client.admin.command("ping")
            checks["mongodb"] = "connected"
        else:
            checks["mongodb"] = "error"
    except Exception:
        checks["mongodb"] = "error"

    # Redis
    try:
        import redis.asyncio as redis

        redis_client = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2, socket_timeout=2)
        await redis_client.ping()
        checks["redis"] = "connected"
        await redis_client.close()
    except Exception:
        checks["redis"] = "error"

    # Celery worker
    try:
        celery_module = importlib.import_module("celery")
        Celery = getattr(celery_module, "Celery")
        celery_app = Celery("transport_erp", broker=settings.REDIS_URL)
        inspector = celery_app.control.inspect(timeout=1)
        ping_result = inspector.ping() if inspector else None
        checks["celery"] = "running" if ping_result else "stopped"
    except Exception:
        checks["celery"] = "stopped"

    return APIResponse(success=True, data=checks, message="ok")
