"""
WebSocket Endpoint — IFIAS Batch Progress
Streams real-time processing progress to the React dashboard.

ws://host/ws/batch/{batch_id}/progress

Sends JSON messages:
  { "type": "progress", "processed": 12, "total": 48, "percent": 25 }
  { "type": "completed", "batch": { ... } }
  { "type": "error", "message": "..." }
"""

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres.connection import AsyncSessionLocal
from app.models.postgres.ifias import ProcessingBatch

router = APIRouter()
logger = logging.getLogger(__name__)

POLL_INTERVAL = 2.0  # seconds between progress checks
MAX_IDLE = 300       # disconnect after 5 minutes of no updates


@router.websocket("/ws/batch/{batch_id}/progress")
async def batch_progress_ws(websocket: WebSocket, batch_id: int):
    """
    Stream batch processing progress to a connected WebSocket client.
    Polls Redis first (fast path), falls back to DB polling.
    """
    await websocket.accept()
    logger.info(f"WS connected for batch {batch_id}")

    idle_ticks = 0
    last_processed = -1

    try:
        while True:
            progress = await _get_progress(batch_id)

            if progress is None:
                await websocket.send_json({"type": "error", "message": "Batch not found"})
                break

            processed = progress["processed"]
            total = progress["total"]
            status = progress["status"]
            percent = round((processed / total * 100) if total > 0 else 0, 1)

            # Send update if progress changed
            if processed != last_processed:
                await websocket.send_json({
                    "type": "progress",
                    "batch_id": batch_id,
                    "processed": processed,
                    "total": total,
                    "percent": percent,
                    "approved": progress.get("approved", 0),
                    "review": progress.get("review", 0),
                    "rejected": progress.get("rejected", 0),
                    "status": status,
                })
                last_processed = processed
                idle_ticks = 0
            else:
                idle_ticks += 1

            # Send final summary when batch completes
            if status in ("COMPLETED", "FAILED", "EXPORTED"):
                await websocket.send_json({
                    "type": "completed",
                    "batch_id": batch_id,
                    "status": status,
                    "processed": processed,
                    "total": total,
                    "approved": progress.get("approved", 0),
                    "review": progress.get("review", 0),
                    "rejected": progress.get("rejected", 0),
                })
                break

            # Idle timeout
            if idle_ticks * POLL_INTERVAL > MAX_IDLE:
                await websocket.send_json({"type": "timeout", "message": "No updates — closing"})
                break

            await asyncio.sleep(POLL_INTERVAL)

    except WebSocketDisconnect:
        logger.info(f"WS disconnected for batch {batch_id}")
    except Exception as exc:
        logger.error(f"WS error for batch {batch_id}: {exc}", exc_info=True)
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


async def _get_progress(batch_id: int) -> Optional[dict]:
    """
    Try Redis first for fast progress data, fall back to DB query.
    """
    # Redis fast path
    try:
        from app.celery_app import celery_app
        raw = celery_app.backend.client.get(f"batch:{batch_id}:progress")
        if raw:
            data = json.loads(raw)
            # Still need status from DB
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(ProcessingBatch).where(ProcessingBatch.id == batch_id)
                )
                batch = result.scalar_one_or_none()
                if batch:
                    data["status"] = batch.status
                    data["approved"] = batch.approved_lrs
                    data["review"] = batch.review_lrs
                    data["rejected"] = batch.rejected_lrs
                    data["total"] = batch.total_lrs
            return data
    except Exception:
        pass

    # DB fallback
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ProcessingBatch).where(ProcessingBatch.id == batch_id)
            )
            batch = result.scalar_one_or_none()
            if not batch:
                return None
            return {
                "processed": batch.processed_lrs,
                "total": batch.total_lrs,
                "status": batch.status,
                "approved": batch.approved_lrs,
                "review": batch.review_lrs,
                "rejected": batch.rejected_lrs,
            }
    except Exception as exc:
        logger.error(f"DB progress query failed: {exc}")
        return None
