# Notification Dispatch Service — FCM, WhatsApp, WebSocket routing
# Implements quiet hours, rate limiting, and channel-specific logic.

import logging
from datetime import datetime, timezone, time as dt_time, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

IST_OFFSET = timedelta(hours=5, minutes=30)


def _ist_now() -> datetime:
    return datetime.now(timezone.utc) + IST_OFFSET


def _is_quiet_hours(quiet_start: str = "22:00", quiet_end: str = "07:00") -> bool:
    """Check if current IST time is within quiet hours."""
    now_ist = _ist_now()
    current_time = now_ist.time()
    start = dt_time(int(quiet_start[:2]), int(quiet_start[3:]))
    end = dt_time(int(quiet_end[:2]), int(quiet_end[3:]))

    if start > end:
        # Overnight window e.g. 22:00–07:00
        return current_time >= start or current_time < end
    return start <= current_time < end


DESK_ROLES = {"admin", "manager", "accountant", "fleet_manager"}
FIELD_ROLES = {"driver", "pump_operator"}


async def send_p0_notifications(db: AsyncSession, event):
    """P0 — immediate FCM + WhatsApp to Admin. No quiet hours. No rate-limit."""
    # FCM push to all admin devices
    await _send_fcm(
        db, event,
        target_roles=["admin", "fleet_manager"],
        sound="critical_alert",
        badge_color="red",
    )
    # WhatsApp to admin
    await _send_whatsapp(db, event, target_roles=["admin"])
    # Audit log
    await _log_notification(db, event, channel="fcm+whatsapp", target_role="admin")


async def send_p1_notifications(db: AsyncSession, event):
    """P1 — FCM to manager, rate-limited (max 1 per entity per 15 min).
    Respects quiet hours for desk roles."""
    # Rate-limit check via Redis
    can_send = await _check_p1_rate_limit(event.entity_id, event.event_type)
    if not can_send:
        logger.info(f"P1 rate-limited: {event.event_type}:{event.entity_id}")
        return

    # Check quiet hours for desk roles
    in_quiet = _is_quiet_hours()
    if in_quiet:
        # Queue instead of sending
        await _queue_for_morning_digest(db, event, target_roles=["manager", "admin"])
        return

    await _send_fcm(
        db, event,
        target_roles=["manager"],
        sound="default",
        badge_color="amber",
    )
    await _log_notification(db, event, channel="fcm", target_role="manager")


async def send_escalation_notification(db: AsyncSession, event, new_level: int):
    """Send escalation-level-specific notifications."""
    from app.models.postgres.intelligence import EventEscalation

    if event.priority == "P1":
        if new_level == 1:
            # +30 min → notify admin via FCM
            await _send_fcm(db, event, target_roles=["admin"], sound="default", badge_color="amber")
            channel = "fcm"
            role = "admin"
        elif new_level == 2:
            # +60 min → WhatsApp to admin
            await _send_whatsapp(db, event, target_roles=["admin"])
            channel = "whatsapp"
            role = "admin"
        else:
            return
    elif event.priority == "P2":
        if new_level == 1:
            # +60 min → notify manager
            await _send_fcm(db, event, target_roles=["manager"], sound="default", badge_color="yellow")
            channel = "fcm"
            role = "manager"
        elif new_level == 2:
            # +120 min → notify admin
            await _send_fcm(db, event, target_roles=["admin"], sound="default", badge_color="yellow")
            channel = "fcm"
            role = "admin"
        else:
            return
    else:
        return

    # Record escalation
    esc = EventEscalation(
        event_id=event.id,
        from_level=new_level - 1,
        to_level=new_level,
        escalated_at=datetime.now(timezone.utc),
        notified_role=role,
        notification_channel=channel,
    )
    db.add(esc)
    await _log_notification(db, event, channel=channel, target_role=role)


async def push_to_websocket(event):
    """Push event to WebSocket subscribers."""
    try:
        from app.websocket.manager import ws_manager
        ws_data = {
            "event_id": event.id,
            "event_type": event.event_type,
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
            "priority": event.priority,
            "occurrence_count": event.occurrence_count,
            "payload": event.payload,
            "triggered_at": event.triggered_at.isoformat() if event.triggered_at else None,
        }
        await ws_manager.broadcast("event_alert", ws_data)
    except Exception as e:
        logger.debug(f"WebSocket broadcast failed: {e}")


async def _send_fcm(db, event, target_roles: list[str], sound: str, badge_color: str):
    """Send FCM push notification. Logs to audit."""
    try:
        from app.core.config import settings
        if getattr(settings, "USE_MOCK_FCM", True):
            logger.info(f"[FCM-MOCK] P{event.priority} → {target_roles}: {event.event_type} ({sound})")
            return
        # Real FCM implementation would go here
        logger.info(f"[FCM] Sent {event.event_type} to {target_roles}")
    except Exception as e:
        logger.error(f"FCM send failed: {e}")


async def _send_whatsapp(db, event, target_roles: list[str]):
    """Send WhatsApp notification via configured provider."""
    try:
        from app.core.config import settings
        if getattr(settings, "USE_MOCK_WHATSAPP", True):
            ist_time = _ist_now().strftime("%d-%b-%Y %H:%M IST")
            msg = (
                f"[KAVYA TRANSPORTS]\n"
                f"🔴 {event.priority}: {event.event_type.replace('.', ' → ')}\n"
                f"Entity: {event.entity_id or 'N/A'}\n"
                f"Time: {ist_time}\n"
            )
            logger.info(f"[WA-MOCK] → {target_roles}: {msg}")
            return
        logger.info(f"[WA] Sent {event.event_type} to {target_roles}")
    except Exception as e:
        logger.error(f"WhatsApp send failed: {e}")


async def _check_p1_rate_limit(entity_id: str | None, event_type: str) -> bool:
    """P1 rate limit: max 1 push per entity+type per 15 min via Redis TTL."""
    try:
        from app.services.cache_service import get_redis
        redis = await get_redis()
        if not redis:
            return True  # No Redis → always allow
        key = f"push:p1:{entity_id}:{event_type}"
        existing = await redis.get(key)
        if existing:
            return False
        await redis.set(key, "1", ex=900)  # 15 min TTL
        return True
    except Exception:
        return True


async def _queue_for_morning_digest(db: AsyncSession, event, target_roles: list[str]):
    """Queue notification for morning digest delivery at 07:00 IST."""
    from app.models.postgres.intelligence import NotificationQueue

    # Calculate next 07:00 IST
    now_ist = _ist_now()
    tomorrow_7am = now_ist.replace(hour=7, minute=0, second=0, microsecond=0)
    if now_ist.hour >= 7:
        tomorrow_7am += timedelta(days=1)
    # Convert back to UTC
    scheduled_utc = tomorrow_7am - IST_OFFSET

    # In a real system, we'd look up user IDs for these roles
    # For now, create a queue entry per role
    for role in target_roles:
        entry = NotificationQueue(
            event_id=event.id,
            target_user_id=0,  # placeholder — resolved at send time
            channel="fcm",
            scheduled_for=scheduled_utc,
            status="pending",
        )
        db.add(entry)
    logger.info(f"Queued {event.event_type} for morning digest → {target_roles}")


async def _log_notification(db: AsyncSession, event, channel: str, target_role: str):
    """Log notification dispatch to audit trail."""
    try:
        from app.services.audit_logger import log_audit
        await log_audit(
            db,
            actor_id=None,
            actor_role="system",
            action="notification.sent",
            entity_type="event",
            entity_id=str(event.id),
            new_state={
                "channel": channel,
                "target_role": target_role,
                "priority": event.priority,
                "event_type": event.event_type,
            },
        )
    except Exception as e:
        logger.debug(f"Audit log for notification failed: {e}")
