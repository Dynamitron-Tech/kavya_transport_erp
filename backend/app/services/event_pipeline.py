# Event Pipeline — Priority, Deduplication, Dispatch
# Implements the 10-step event pipeline from the spec.
# Every event flows through this before storage/notification.

import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ── Default priority mapping (fallback if DB config missing) ──
DEFAULT_PRIORITY_MAP: dict[str, str] = {
    "sos.triggered": "P0",
    "fuel.confirmed_theft": "P0",
    "vehicle.risk_critical": "P0",
    "driver.score_critical": "P0",
    "trip.delay_confirmed_60": "P1",
    "trip.deviation": "P1",
    "document.expiry_1d": "P1",
    "fuel.mismatch_high": "P1",
    "expense.fraud_flagged": "P1",
    "trip.unauthorised_stop_45": "P1",
    "trip.delay_confirmed": "P1",
    "fuel.mismatch": "P1",
    "trip.unauthorised_stop": "P1",
    "trip.delay_confirmed_30": "P2",
    "fuel.mismatch_low": "P2",
    "trip.unauthorised_stop_20": "P2",
    "document.expiry_7d": "P2",
    "vehicle.risk_high": "P2",
    "epod.overdue": "P2",
    "sync.failed": "P2",
    "trip.delay_predicted": "P2",
    "fuel.offsite": "P2",
    "driver.idle_excess": "P3",
    "trip.completed": "P3",
    "epod.dispatched": "P3",
    "expense.approved": "P3",
    "sync.completed": "P3",
}

# Default cooldowns by priority level
DEFAULT_COOLDOWN: dict[str, int] = {
    "P0": 0,
    "P1": 15,
    "P2": 10,
    "P3": 5,
}

# Role → visible priorities
ROLE_PRIORITY_MAP: dict[str, list[str]] = {
    "admin": ["P0", "P1", "P2", "P3"],
    "manager": ["P0", "P1", "P2"],
    "fleet_manager": ["P0", "P1", "P2"],
    "accountant": ["P1", "P2"],
    "pump_operator": ["P1", "P2"],
    "driver": ["P0"],
    "project_associate": ["P0", "P1", "P2"],
}


def compute_dedup_key(event_type: str, entity_id: str | None) -> str:
    """SHA-256 hash of event_type:entity_id."""
    raw = f"{event_type}:{entity_id or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def get_priority_for_event(db: AsyncSession, event_type: str) -> tuple[str, int]:
    """Look up priority and cooldown from event_priority_config table.
    Falls back to DEFAULT_PRIORITY_MAP if not found."""
    from app.models.postgres.intelligence import EventPriorityConfig
    result = await db.execute(
        select(EventPriorityConfig).where(EventPriorityConfig.event_type == event_type)
    )
    config = result.scalar_one_or_none()
    if config:
        return config.priority, config.cooldown_minutes

    # Fallback to hardcoded map
    priority = DEFAULT_PRIORITY_MAP.get(event_type, "P2")
    cooldown = DEFAULT_COOLDOWN.get(priority, 10)
    if event_type not in DEFAULT_PRIORITY_MAP:
        logger.warning(f"Event type '{event_type}' not in priority mapping — defaulting to P2")
    return priority, cooldown


def merge_payloads(original: dict, new_payload: dict) -> dict:
    """Merge new occurrence data into original payload under 'history' key."""
    merged = dict(original) if original else {}
    history = merged.get("history", [])
    history.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": new_payload or {},
    })
    merged["history"] = history
    return merged


async def process_event(
    db: AsyncSession,
    event_type: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    payload: dict | None = None,
    notified_roles: list[str] | None = None,
) -> Optional[int]:
    """Full 10-step event pipeline. Returns the event ID (new or updated)."""
    from app.models.postgres.intelligence import EventBusEvent

    now = datetime.utcnow()

    # Step 2 — Assign priority
    priority, cooldown_minutes = await get_priority_for_event(db, event_type)

    dedup_key = compute_dedup_key(event_type, entity_id)

    # Step 3 — Deduplication check (P0 always bypasses)
    if priority != "P0" and cooldown_minutes > 0:
        cutoff = now - timedelta(minutes=cooldown_minutes)
        result = await db.execute(
            select(EventBusEvent).where(
                and_(
                    EventBusEvent.dedup_key == dedup_key,
                    EventBusEvent.triggered_at > cutoff,
                    EventBusEvent.suppressed_at.is_(None),
                )
            ).order_by(EventBusEvent.triggered_at.desc()).limit(1)
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing — do NOT create new, do NOT re-notify
            existing.occurrence_count = (existing.occurrence_count or 1) + 1
            existing.last_seen_at = now
            existing.payload = merge_payloads(existing.payload or {}, payload or {})
            await db.flush()
            logger.info(f"Dedup: merged into event #{existing.id} (count={existing.occurrence_count})")
            return existing.id

    # Step 4 — Store event
    event = EventBusEvent(
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload or {},
        triggered_at=now,
        notified_roles=notified_roles,
        priority=priority,
        escalation_level=0,
        occurrence_count=1,
        last_seen_at=now,
        dedup_key=dedup_key,
        is_acknowledged=False,
    )
    db.add(event)
    await db.flush()

    # Step 5 — Cache (push to Redis sorted set per role)
    await _cache_event_for_roles(event, priority)

    # Step 6 — Dispatch notifications
    await dispatch_notifications(db, event, priority)

    logger.info(f"Pipeline: created event #{event.id} type={event_type} priority={priority}")
    return event.id


async def dispatch_notifications(
    db: AsyncSession,
    event,
    priority: str,
):
    """Dispatch notifications based on priority level."""
    from app.services.notification_dispatch_service import (
        send_p0_notifications,
        send_p1_notifications,
        push_to_websocket,
    )

    if priority == "P0":
        await send_p0_notifications(db, event)
        await push_to_websocket(event)
    elif priority == "P1":
        await send_p1_notifications(db, event)
        await push_to_websocket(event)
    elif priority == "P2":
        await push_to_websocket(event)
    # P3 — websocket only for live-connected clients
    elif priority == "P3":
        await push_to_websocket(event)


async def _cache_event_for_roles(event, priority: str):
    """Push event to Redis sorted set per role for fast reads."""
    try:
        from app.services.cache_service import get_redis
        import json
        redis = await get_redis()
        if not redis:
            return

        priority_score = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}.get(priority, 2)
        event_data = json.dumps({
            "id": event.id,
            "event_type": event.event_type,
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
            "priority": priority,
            "occurrence_count": event.occurrence_count,
            "triggered_at": event.triggered_at.isoformat() if event.triggered_at else None,
            "last_seen_at": event.last_seen_at.isoformat() if event.last_seen_at else None,
        }, default=str)

        # TTL by priority for auto-cleanup
        ttl_map = {"P0": 86400, "P1": 7200, "P2": 3600, "P3": 600}
        ttl = ttl_map.get(priority, 3600)

        for role, priorities in ROLE_PRIORITY_MAP.items():
            if priority in priorities:
                key = f"events:{role}:active"
                await redis.zadd(key, {event_data: priority_score})
                await redis.expire(key, ttl)
    except Exception as e:
        logger.debug(f"Redis cache push failed (non-critical): {e}")
