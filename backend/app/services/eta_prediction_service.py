# I-02 — AI-Based ETA Prediction
# Mode A (baseline buffer) vs Mode B (historical correction factor).

import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.postgres.intelligence import ETACorrectionFactor, TripETALog
from app.models.postgres.trip import Trip
from app.services.config_service import get_config_bulk
from app.services.event_bus import event_bus, EventTypes

logger = logging.getLogger(__name__)


async def predict_eta(
    db: AsyncSession,
    trip_id: int,
    google_duration_min: float,
    route_type: str = "mixed",  # "highway", "state_highway", "mixed"
    origin_district: str | None = None,
    destination_district: str | None = None,
    committed_arrival: datetime | None = None,
) -> dict:
    """Predict ETA using Mode A or Mode B depending on data availability."""

    cfg = await get_config_bulk(db, "eta.")
    buffer_pcts = {
        "highway": cfg.get("eta.buffer_highway_pct", 8),
        "state_highway": cfg.get("eta.buffer_state_highway_pct", 15),
        "mixed": cfg.get("eta.buffer_urban_pct", 25),
    }
    historical_days = cfg.get("eta.historical_mode_days", 60)
    min_trips = cfg.get("eta.historical_min_trips", 10)
    breach_alert_min = cfg.get("eta.breach_alert_min", 30)

    # Try Mode B (historical)
    correction_factor = None
    mode = "A"
    if origin_district and destination_district:
        cf = await _get_correction_factor(db, origin_district, destination_district)
        if cf and cf.sample_count >= min_trips and cf.mode == "B":
            correction_factor = cf.correction_factor
            mode = "B"

    # Mode A fallback
    if correction_factor is None:
        buffer_pct = buffer_pcts.get(route_type, 25)
        correction_factor = 1.0 + (buffer_pct / 100)
        mode = "A"

    predicted_duration = google_duration_min * correction_factor
    now = datetime.now(timezone.utc)
    predicted_arrival = now + timedelta(minutes=predicted_duration)

    # Check if breach projected
    is_breach = False
    breach_minutes = 0
    if committed_arrival:
        if committed_arrival.tzinfo is None:
            committed_arrival = committed_arrival.replace(tzinfo=timezone.utc)
        delta = (predicted_arrival - committed_arrival).total_seconds() / 60
        if delta > 0:
            is_breach = True
            breach_minutes = int(delta)

    # Log ETA prediction
    eta_log = TripETALog(
        trip_id=trip_id,
        predicted_arrival=predicted_arrival,
        committed_arrival=committed_arrival,
        correction_factor=correction_factor,
        is_breach_projected=is_breach,
        breach_minutes=breach_minutes if is_breach else None,
    )
    db.add(eta_log)
    await db.flush()

    # Publish breach alert if projected > threshold
    if is_breach and breach_minutes >= breach_alert_min:
        await event_bus.publish(
            EventTypes.TRIP_DELAY_PREDICTED,
            entity_type="trip",
            entity_id=str(trip_id),
            payload={
                "breach_minutes": breach_minutes,
                "predicted_arrival": predicted_arrival.isoformat(),
                "committed_arrival": committed_arrival.isoformat() if committed_arrival else None,
            },
            db_session=db,
        )

    return {
        "mode": mode,
        "correction_factor": round(correction_factor, 3),
        "predicted_duration_min": round(predicted_duration, 1),
        "predicted_arrival": predicted_arrival.isoformat(),
        "is_breach_projected": is_breach,
        "breach_minutes": breach_minutes,
    }


async def update_eta_realtime(
    db: AsyncSession,
    trip_id: int,
    km_remaining: float,
    recent_speeds: list[float],
    committed_arrival: datetime | None = None,
    origin_district: str | None = None,
    destination_district: str | None = None,
) -> dict:
    """Real-time ETA update every 10 minutes during active trip."""

    cfg = await get_config_bulk(db, "eta.")
    ignore_stop_min = cfg.get("eta.ignore_stop_under_min", 3)
    breach_alert_min = cfg.get("eta.breach_alert_min", 30)

    # Filter out 0 km/h pings from brief stops
    moving_speeds = [s for s in recent_speeds if s > 0]
    if not moving_speeds:
        avg_speed = 30.0  # fallback
    else:
        avg_speed = sum(moving_speeds) / len(moving_speeds)

    # Get correction factor
    correction_factor = 1.0
    if origin_district and destination_district:
        cf = await _get_correction_factor(db, origin_district, destination_district)
        if cf and cf.mode == "B":
            correction_factor = cf.correction_factor

    if avg_speed < 1:
        avg_speed = 1.0

    duration_min = (km_remaining / avg_speed) * 60 * correction_factor
    now = datetime.now(timezone.utc)
    predicted_arrival = now + timedelta(minutes=duration_min)

    is_breach = False
    breach_minutes = 0
    if committed_arrival:
        if committed_arrival.tzinfo is None:
            committed_arrival = committed_arrival.replace(tzinfo=timezone.utc)
        delta = (predicted_arrival - committed_arrival).total_seconds() / 60
        if delta > 0:
            is_breach = True
            breach_minutes = int(delta)

    # Log
    eta_log = TripETALog(
        trip_id=trip_id,
        predicted_arrival=predicted_arrival,
        committed_arrival=committed_arrival,
        km_remaining=km_remaining,
        avg_speed_20min=round(avg_speed, 1),
        correction_factor=correction_factor,
        is_breach_projected=is_breach,
        breach_minutes=breach_minutes if is_breach else None,
    )
    db.add(eta_log)

    if is_breach and breach_minutes >= breach_alert_min:
        await event_bus.publish(
            EventTypes.TRIP_DELAY_PREDICTED,
            entity_type="trip",
            entity_id=str(trip_id),
            payload={"breach_minutes": breach_minutes},
            db_session=db,
        )

    return {
        "predicted_arrival": predicted_arrival.isoformat(),
        "km_remaining": km_remaining,
        "avg_speed_kmph": round(avg_speed, 1),
        "is_breach_projected": is_breach,
        "breach_minutes": breach_minutes,
    }


async def recompute_corridor_factors(db: AsyncSession):
    """Recompute ETA correction factors for all corridors.
    Called by daily intelligence job."""

    cfg = await get_config_bulk(db, "eta.")
    min_trips = cfg.get("eta.historical_min_trips", 10)

    # Find corridors with enough completed trips
    # Use origin/destination as proxy for district (simplified)
    stmt = (
        select(
            Trip.origin,
            Trip.destination,
            func.count(Trip.id).label("trip_count"),
            func.avg(
                func.extract("epoch", Trip.actual_end - Trip.actual_start) / 60
            ).label("avg_actual_min"),
        )
        .where(Trip.actual_start.isnot(None), Trip.actual_end.isnot(None))
        .group_by(Trip.origin, Trip.destination)
        .having(func.count(Trip.id) >= min_trips)
    )
    result = await db.execute(stmt)
    rows = result.all()

    updated = 0
    for row in rows:
        origin, dest, count, avg_actual = row
        if not avg_actual or avg_actual <= 0:
            continue

        # Get or create correction factor record
        existing = await db.execute(
            select(ETACorrectionFactor).where(
                ETACorrectionFactor.origin_district == origin,
                ETACorrectionFactor.destination_district == dest,
            )
        )
        cf = existing.scalar_one_or_none()

        # For now, use avg_actual / planned_distance * base_speed as proxy
        # In production, we'd compare against Google Maps durations stored at trip creation
        factor = 1.15  # slight correction above baseline
        if cf:
            cf.correction_factor = factor
            cf.sample_count = count
            cf.mode = "B" if count >= min_trips else "A"
            cf.last_computed = datetime.now(timezone.utc)
        else:
            db.add(ETACorrectionFactor(
                origin_district=origin,
                destination_district=dest,
                correction_factor=factor,
                sample_count=count,
                mode="B" if count >= min_trips else "A",
                last_computed=datetime.now(timezone.utc),
            ))
        updated += 1

    await db.flush()
    logger.info(f"ETA: recomputed {updated} corridor factors")
    return updated


async def _get_correction_factor(
    db: AsyncSession, origin: str, dest: str
) -> ETACorrectionFactor | None:
    result = await db.execute(
        select(ETACorrectionFactor).where(
            ETACorrectionFactor.origin_district == origin,
            ETACorrectionFactor.destination_district == dest,
        )
    )
    return result.scalar_one_or_none()
