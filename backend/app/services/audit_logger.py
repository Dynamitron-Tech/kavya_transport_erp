# Audit Logger — Records every state-changing action
# Section 3: Immutable audit trail. No update/delete.

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from app.models.postgres.intelligence import AuditLog

logger = logging.getLogger(__name__)


async def log_audit(
    db: AsyncSession,
    *,
    actor_id: int | None = None,
    actor_role: str | None = None,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    previous_state: dict | None = None,
    new_state: dict | None = None,
    ip_address: str | None = None,
    device_id: str | None = None,
):
    """Insert an immutable audit log record."""
    try:
        entry = AuditLog(
            actor_id=actor_id,
            actor_role=actor_role,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None,
            previous_state=previous_state,
            new_state=new_state,
            ip_address=ip_address,
            device_id=device_id,
        )
        # Use a savepoint so a failure here doesn't roll back the parent transaction
        async with db.begin_nested():
            db.add(entry)
    except Exception as e:
        logger.error(f"Audit log write failed (non-critical): {e}")
