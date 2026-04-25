# Event Escalation & Suppression Background Jobs
# Run every 5 minutes via Celery beat.
# Idempotent — safe to run multiple times without double-escalating.

import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Escalation thresholds: (priority, minutes_elapsed) → new_level
# P0: already max at creation
# P1: level 0 at 0min, level 1 at 30min, level 2 at 60min
# P2: level 0 at 0min, level 1 at 60min, level 2 at 120min
# P3: never escalates
ESCALATION_SCHEDULE = {
    "P1": [(30, 1), (60, 2)],
    "P2": [(60, 1), (120, 2)],
}


def compute_new_escalation_level(priority: str, minutes_elapsed: float, current_level: int) -> int:
    """Determine the correct escalation level given time elapsed."""
    schedule = ESCALATION_SCHEDULE.get(priority, [])
    new_level = current_level
    for threshold_min, level in schedule:
        if minutes_elapsed >= threshold_min and level > current_level:
            new_level = level
    return new_level


async def run_escalation_check(db: AsyncSession):
    """Evaluate all unacknowledged P1/P2 events and escalate if needed.
    Idempotent — only escalates if new_level > current escalation_level."""
    from app.models.postgres.intelligence import EventBusEvent

    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(EventBusEvent).where(
            and_(
                EventBusEvent.is_acknowledged == False,  # noqa: E712
                EventBusEvent.suppressed_at.is_(None),
                EventBusEvent.priority.in_(["P1", "P2"]),
                EventBusEvent.escalation_level < 2,
            )
        )
    )
    events = result.scalars().all()

    escalated_count = 0
    for event in events:
        triggered = event.triggered_at
        if triggered is None:
            continue
        if triggered.tzinfo is None:
            triggered = triggered.replace(tzinfo=timezone.utc)
        minutes_elapsed = (now - triggered).total_seconds() / 60.0
        new_level = compute_new_escalation_level(event.priority, minutes_elapsed, event.escalation_level)

        if new_level > event.escalation_level:
            old_level = event.escalation_level
            event.escalation_level = new_level
            await db.flush()

            # Dispatch escalation notification
            try:
                from app.services.notification_dispatch_service import send_escalation_notification
                await send_escalation_notification(db, event, new_level)
            except Exception as e:
                logger.error(f"Escalation notification failed for event #{event.id}: {e}")

            escalated_count += 1
            logger.info(
                f"Escalated event #{event.id} ({event.event_type}) "
                f"from level {old_level} → {new_level}"
            )

    if escalated_count > 0:
        logger.info(f"Escalation check complete: {escalated_count} events escalated")


async def run_suppression_check(db: AsyncSession):
    """Auto-suppress events based on priority + acknowledgement + age.
    Idempotent — only sets suppressed_at once (WHERE suppressed_at IS NULL)."""
    from app.models.postgres.intelligence import EventBusEvent

    now = datetime.now(timezone.utc)
    suppressed_count = 0

    # P3: suppress after 10 minutes regardless
    result = await db.execute(
        update(EventBusEvent)
        .where(
            and_(
                EventBusEvent.priority == "P3",
                EventBusEvent.suppressed_at.is_(None),
                EventBusEvent.triggered_at < now - timedelta(minutes=10),
            )
        )
        .values(suppressed_at=now)
        .returning(EventBusEvent.id)
    )
    p3_ids = result.scalars().all()
    suppressed_count += len(p3_ids)

    # P2 acknowledged: suppress after 30 min from acknowledgement
    result = await db.execute(
        update(EventBusEvent)
        .where(
            and_(
                EventBusEvent.priority == "P2",
                EventBusEvent.is_acknowledged == True,  # noqa: E712
                EventBusEvent.suppressed_at.is_(None),
                EventBusEvent.acknowledged_at < now - timedelta(minutes=30),
            )
        )
        .values(suppressed_at=now)
        .returning(EventBusEvent.id)
    )
    p2_ack_ids = result.scalars().all()
    suppressed_count += len(p2_ack_ids)

    # P2 unacknowledged: force-suppress after 2 hours
    result = await db.execute(
        update(EventBusEvent)
        .where(
            and_(
                EventBusEvent.priority == "P2",
                EventBusEvent.suppressed_at.is_(None),
                EventBusEvent.triggered_at < now - timedelta(hours=2),
            )
        )
        .values(suppressed_at=now)
        .returning(EventBusEvent.id)
    )
    p2_force_ids = result.scalars().all()
    suppressed_count += len(p2_force_ids)

    # P1 acknowledged: suppress after 2 hours from acknowledgement
    result = await db.execute(
        update(EventBusEvent)
        .where(
            and_(
                EventBusEvent.priority == "P1",
                EventBusEvent.is_acknowledged == True,  # noqa: E712
                EventBusEvent.suppressed_at.is_(None),
                EventBusEvent.acknowledged_at < now - timedelta(hours=2),
            )
        )
        .values(suppressed_at=now)
        .returning(EventBusEvent.id)
    )
    p1_ack_ids = result.scalars().all()
    suppressed_count += len(p1_ack_ids)

    # P0 and unacknowledged P1: NEVER auto-suppressed

    if suppressed_count > 0:
        logger.info(f"Suppression check complete: {suppressed_count} events suppressed")
