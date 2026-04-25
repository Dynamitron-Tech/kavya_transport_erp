# Sync Endpoints — Batch offline sync for mobile apps
# Phase 2: KT Driver App elevation

from typing import Optional, List
from pydantic import BaseModel

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres.connection import get_db
from app.core.security import TokenData
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse
from app.services.batch_sync_service import record_sync_batch, get_sync_status

router = APIRouter()


class SyncAction(BaseModel):
    method: str  # POST, PUT, PATCH
    path: str
    data: Optional[dict] = None
    timestamp: Optional[str] = None
    client_action_id: Optional[str] = None


class BatchSyncRequest(BaseModel):
    device_id: Optional[str] = None
    actions: List[SyncAction]


@router.post("/batch", response_model=APIResponse)
async def batch_sync(
    payload: BatchSyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.SYNC_CREATE)),
):
    """Receive a batch of offline actions from mobile app and queue them."""
    results = await record_sync_batch(
        db,
        user_id=current_user.user_id,
        actions=[a.model_dump() for a in payload.actions],
        device_id=payload.device_id,
        tenant_id=getattr(current_user, "tenant_id", None),
    )
    await db.commit()
    accepted = sum(1 for r in results if r["status"] == "accepted")
    return APIResponse(
        success=True,
        data={"results": results, "accepted": accepted, "total": len(payload.actions)},
        message=f"{accepted}/{len(payload.actions)} actions queued for processing",
    )


@router.get("/status", response_model=APIResponse)
async def sync_status(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.SYNC_CREATE)),
):
    """Get status of recent sync queue items for current user."""
    items = await get_sync_status(db, user_id=current_user.user_id)
    return APIResponse(success=True, data=items)
