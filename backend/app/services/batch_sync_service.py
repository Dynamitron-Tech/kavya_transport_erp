# Batch Sync Service — Processes offline actions submitted in batch
# Phase 2: KT Driver App — server-side sync queue processing

import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.postgres.sync_queue import SyncQueue, SyncActionStatus

logger = logging.getLogger(__name__)

# Allowed action paths (whitelist to prevent abuse)
ALLOWED_PATHS = {
    "POST": [
        "/trips/{trip_id}/expenses",
        "/trips/{trip_id}/fuel",
        "/trips/{trip_id}/sos",
        "/trips/{trip_id}/status",
        "/tracking/gps/ping",
    ],
    "PUT": [
        "/trips/{trip_id}/start",
        "/trips/{trip_id}/reach",
        "/trips/{trip_id}/close",
    ],
    "PATCH": [
        "/trips/{trip_id}/status",
    ],
}


def _is_path_allowed(method: str, path: str) -> bool:
    """Check if the action path is in the allowed whitelist."""
    templates = ALLOWED_PATHS.get(method.upper(), [])
    # Normalize path: strip leading /api/v1 if present
    normalized = path
    for prefix in ["/api/v1", "/api/v1/"]:
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix):]
            break
    if not normalized.startswith("/"):
        normalized = "/" + normalized

    for template in templates:
        # Simple pattern match: replace {param} with regex-like wildcard
        pattern_parts = template.split("/")
        path_parts = normalized.split("/")
        if len(pattern_parts) != len(path_parts):
            continue
        match = True
        for tp, pp in zip(pattern_parts, path_parts):
            if tp.startswith("{") and tp.endswith("}"):
                continue  # wildcard segment
            if tp != pp:
                match = False
                break
        if match:
            return True
    return False


async def record_sync_batch(
    db: AsyncSession,
    user_id: int,
    actions: list[dict],
    device_id: Optional[str] = None,
    tenant_id: Optional[int] = None,
) -> list[dict]:
    """Record a batch of offline actions into sync_queue and return results."""
    results = []

    for action in actions:
        method = action.get("method", "").upper()
        path = action.get("path", "")
        data = action.get("data")
        client_ts = action.get("timestamp")
        client_id = action.get("client_action_id")

        # Dedup: skip if client_action_id already exists
        if client_id:
            existing = await db.execute(
                select(SyncQueue.id).where(
                    and_(
                        SyncQueue.user_id == user_id,
                        SyncQueue.client_action_id == client_id,
                    )
                )
            )
            if existing.scalar_one_or_none():
                results.append({
                    "client_action_id": client_id,
                    "status": "duplicate",
                    "message": "Already received",
                })
                continue

        # Validate path
        if not _is_path_allowed(method, path):
            results.append({
                "client_action_id": client_id,
                "status": "rejected",
                "message": f"Path not allowed: {method} {path}",
            })
            continue

        # Parse client timestamp
        parsed_ts = None
        if client_ts:
            try:
                parsed_ts = datetime.fromisoformat(client_ts.replace("Z", "+00:00"))
                if parsed_ts.tzinfo:
                    parsed_ts = parsed_ts.replace(tzinfo=None)
            except (ValueError, AttributeError):
                pass

        record = SyncQueue(
            user_id=user_id,
            device_id=device_id,
            action_method=method,
            action_path=path,
            action_data=data,
            client_timestamp=parsed_ts,
            client_action_id=client_id,
            status=SyncActionStatus.PENDING,
            tenant_id=tenant_id,
        )
        db.add(record)
        await db.flush()

        results.append({
            "client_action_id": client_id,
            "sync_id": record.id,
            "status": "accepted",
        })

    return results


async def get_sync_status(
    db: AsyncSession,
    user_id: int,
    sync_ids: list[int] | None = None,
) -> list[dict]:
    """Get status of sync queue items for a user."""
    query = select(SyncQueue).where(SyncQueue.user_id == user_id)
    if sync_ids:
        query = query.where(SyncQueue.id.in_(sync_ids))
    query = query.order_by(SyncQueue.created_at.desc()).limit(100)
    result = await db.execute(query)
    items = result.scalars().all()
    return [
        {
            "sync_id": item.id,
            "client_action_id": item.client_action_id,
            "method": item.action_method,
            "path": item.action_path,
            "status": item.status.value,
            "error_message": item.error_message,
            "processed_at": item.processed_at.isoformat() if item.processed_at else None,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in items
    ]
