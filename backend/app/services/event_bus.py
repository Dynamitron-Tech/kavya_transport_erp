# Event Bus — Async event emitter for real-time alerting
# Replaces polling; every state change publishes an event.
# Uses asyncio — no external dependency required.

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Coroutine
from collections import defaultdict
from uuid import uuid4

logger = logging.getLogger(__name__)

# Type alias for async handler
EventHandler = Callable[..., Coroutine[Any, Any, None]]


class EventBus:
    """In-process async event bus. Singleton per application."""

    def __init__(self):
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)
        self._lock = asyncio.Lock()

    def subscribe(self, event_type: str, handler: EventHandler):
        """Register handler for an event type."""
        self._handlers[event_type].append(handler)
        logger.debug(f"EventBus: subscribed {handler.__name__} to {event_type}")

    async def publish(
        self,
        event_type: str,
        entity_type: str | None = None,
        entity_id: str | None = None,
        payload: dict | None = None,
        persist: bool = True,
        db_session=None,
    ) -> str:
        """Publish an event. Routes through the priority pipeline (dedup, priority,
        notification dispatch) then invokes all legacy subscribers."""
        event_id = str(uuid4())
        triggered_at = datetime.utcnow()

        # ── Route through priority pipeline (persist + dedup + notify) ──
        stored_event_id = None
        if persist and db_session:
            try:
                from app.services.event_pipeline import process_event
                stored_event_id = await process_event(
                    db=db_session,
                    event_type=event_type,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    payload=payload,
                )
            except Exception as e:
                logger.error(f"EventBus: pipeline failed for {event_type}: {e}", exc_info=True)
                # Fallback: persist raw event if pipeline fails
                try:
                    from app.models.postgres.intelligence import EventBusEvent
                    record = EventBusEvent(
                        event_type=event_type,
                        entity_type=entity_type,
                        entity_id=entity_id,
                        payload=payload or {},
                        triggered_at=triggered_at,
                    )
                    db_session.add(record)
                    await db_session.flush()
                except Exception as e2:
                    logger.error(f"EventBus: fallback persist also failed: {e2}")

        # Invoke legacy handlers concurrently
        handlers = self._handlers.get(event_type, [])
        if not handlers:
            return event_id

        event_data = {
            "event_id": event_id,
            "event_type": event_type,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "payload": payload or {},
            "triggered_at": triggered_at.isoformat(),
            "stored_event_id": stored_event_id,
        }

        tasks = []
        for handler in handlers:
            tasks.append(self._safe_invoke(handler, event_data, db_session))

        await asyncio.gather(*tasks)
        logger.info(f"EventBus: published {event_type} → {len(handlers)} handlers")
        return event_id

    async def _safe_invoke(self, handler: EventHandler, event_data: dict, db_session):
        """Invoke a handler with error isolation."""
        try:
            await handler(event_data, db_session)
        except Exception as e:
            logger.error(f"EventBus: handler {handler.__name__} failed: {e}", exc_info=True)


# Singleton instance
event_bus = EventBus()


# ═══════════════════════════════════════════════════════════════
# Event Types — Catalogue (Section 2)
# ═══════════════════════════════════════════════════════════════

class EventTypes:
    SOS_TRIGGERED = "sos.triggered"
    TRIP_DELAY_PREDICTED = "trip.delay_predicted"
    TRIP_DELAY_CONFIRMED = "trip.delay_confirmed"
    TRIP_DELAY_CONFIRMED_30 = "trip.delay_confirmed_30"
    TRIP_DELAY_CONFIRMED_60 = "trip.delay_confirmed_60"
    FUEL_MISMATCH = "fuel.mismatch"
    FUEL_MISMATCH_HIGH = "fuel.mismatch_high"
    FUEL_MISMATCH_LOW = "fuel.mismatch_low"
    FUEL_CONFIRMED_THEFT = "fuel.confirmed_theft"
    FUEL_OFFSITE = "fuel.offsite"
    DOCUMENT_EXPIRY_7D = "document.expiry_7d"
    DOCUMENT_EXPIRY_1D = "document.expiry_1d"
    EXPENSE_FRAUD_FLAGGED = "expense.fraud_flagged"
    EXPENSE_APPROVED = "expense.approved"
    DRIVER_SCORE_CRITICAL = "driver.score_critical"
    DRIVER_IDLE_EXCESS = "driver.idle_excess"
    VEHICLE_RISK_HIGH = "vehicle.risk_high"
    VEHICLE_RISK_CRITICAL = "vehicle.risk_critical"
    TRIP_DEVIATION = "trip.deviation"
    TRIP_UNAUTHORISED_STOP = "trip.unauthorised_stop"
    TRIP_UNAUTHORISED_STOP_20 = "trip.unauthorised_stop_20"
    TRIP_UNAUTHORISED_STOP_45 = "trip.unauthorised_stop_45"
    TRIP_COMPLETED = "trip.completed"
    EPOD_OVERDUE = "epod.overdue"
    EPOD_DISPATCHED = "epod.dispatched"
    SYNC_FAILED = "sync.failed"
    SYNC_COMPLETED = "sync.completed"
