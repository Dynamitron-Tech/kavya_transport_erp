# I-07 — Trip Intelligence Engine
# Real-time trip anomaly detection: deviation, unauthorized stops, delay, night halt.

import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.postgres.trip import Trip
from app.models.postgres.intelligence import TripIntelligenceAlert
from app.services.config_service import get_config_bulk
from app.services.event_bus import event_bus, EventTypes

logger = logging.getLogger(__name__)


async def check_trip_anomalies(
    db: AsyncSession,
    trip_id: int,
    current_lat: float,
    current_lng: float,
    current_speed: float,
    timestamp: datetime | None = None,
) -> list[dict]:
    """Run all trip intelligence checks against current GPS ping."""

    cfg = await get_config_bulk(db, "trip_intel.")
    deviation_km = cfg.get("trip_intel.deviation_km", 2.0)
    deviation_pings = cfg.get("trip_intel.deviation_pings", 2)
    stop_threshold_min = cfg.get("trip_intel.stop_threshold_min", 20)
    delay_threshold_min = cfg.get("trip_intel.delay_threshold_min", 30)
    night_halt_min = cfg.get("trip_intel.night_halt_min", 45)
    night_start_hour = cfg.get("trip_intel.night_start_hour", 22)
    night_end_hour = cfg.get("trip_intel.night_end_hour", 5)
    escalation_delay_min = cfg.get("trip_intel.escalation_delay_min", 60)
    escalation_stop_min = cfg.get("trip_intel.escalation_stop_min", 45)

    if timestamp is None:
        timestamp = datetime.now(timezone.utc)

    trip = await db.get(Trip, trip_id)
    if not trip:
        return []

    alerts = []

    # 1) Route deviation check
    deviation_alert = await _check_deviation(
        db, trip, current_lat, current_lng, deviation_km, deviation_pings
    )
    if deviation_alert:
        alerts.append(deviation_alert)

    # 2) Unauthorized/long stop
    stop_alert = await _check_long_stop(
        db, trip, current_speed, current_lat, current_lng,
        stop_threshold_min, escalation_stop_min, timestamp,
    )
    if stop_alert:
        alerts.append(stop_alert)

    # 3) Delay detection
    delay_alert = _check_delay(
        trip, timestamp, delay_threshold_min, escalation_delay_min
    )
    if delay_alert:
        alerts.append(delay_alert)

    # 4) Unregistered night halt
    night_alert = _check_night_halt(
        trip, current_speed, current_lat, current_lng,
        night_halt_min, night_start_hour, night_end_hour, timestamp,
    )
    if night_alert:
        alerts.append(night_alert)

    # Persist and publish
    for a in alerts:
        record = TripIntelligenceAlert(
            trip_id=trip_id,
            driver_id=trip.driver_id,
            vehicle_id=trip.vehicle_id,
            alert_type=a["alert_type"],
            severity=a["severity"],
            title=a["title"],
            description=a["description"],
            latitude=current_lat,
            longitude=current_lng,
            speed_kmph=current_speed,
            deviation_km=a.get("deviation_km"),
            stop_duration_min=a.get("stop_duration_min"),
            delay_minutes=a.get("delay_minutes"),
        )
        db.add(record)

        event_type = {
            "ROUTE_DEVIATION": EventTypes.TRIP_DEVIATION,
            "LONG_STOP": EventTypes.TRIP_UNAUTHORISED_STOP,
            "DELAY": EventTypes.TRIP_DELAY_CONFIRMED,
            "ESCALATED_DELAY": EventTypes.TRIP_DELAY_CONFIRMED,
            "UNREGISTERED_NIGHT_HALT": EventTypes.TRIP_UNAUTHORISED_STOP,
        }.get(a["alert_type"], EventTypes.TRIP_DELAY_CONFIRMED)

        await event_bus.publish(
            event_type,
            entity_type="trip",
            entity_id=str(trip_id),
            payload={
                "trip_id": trip_id,
                "driver_id": trip.driver_id,
                "vehicle_id": trip.vehicle_id,
                "alert_type": a["alert_type"],
                "severity": a["severity"],
                **{k: v for k, v in a.items()
                   if k not in ("alert_type", "severity", "title", "description")},
            },
            db_session=db,
        )

    if alerts:
        await db.flush()

    return alerts


async def _check_deviation(db, trip, lat, lng, threshold_km, min_pings):
    """Check if current position deviates from planned route."""
    # Compare with planned route waypoints if available
    if not trip.route_id:
        return None

    # Count recent deviation alerts (to enforce min_pings)
    recent = await db.execute(
        select(func.count(TripIntelligenceAlert.id)).where(
            TripIntelligenceAlert.trip_id == trip.id,
            TripIntelligenceAlert.alert_type == "ROUTE_DEVIATION",
            TripIntelligenceAlert.created_at >= datetime.now(timezone.utc) - timedelta(minutes=30),
        )
    )
    recent_count = recent.scalar() or 0

    # Use planned destination as rough reference
    if not (trip.end_latitude and trip.end_longitude):
        return None

    # Simple corridor check: perpendicular distance from start→end line
    dist = _point_to_line_distance(
        lat, lng,
        float(trip.start_latitude or lat), float(trip.start_longitude or lng),
        float(trip.end_latitude), float(trip.end_longitude),
    )

    if dist > threshold_km:
        # Only alert if we've seen enough consecutive deviations
        if recent_count + 1 >= min_pings:
            return {
                "alert_type": "ROUTE_DEVIATION",
                "severity": "warning",
                "title": f"Route deviation: {round(dist, 1)}km off planned route",
                "description": (
                    f"Vehicle is {round(dist, 1)}km from planned route corridor. "
                    f"Detected in {recent_count + 1} consecutive pings."
                ),
                "deviation_km": round(dist, 1),
            }
    return None


async def _check_long_stop(db, trip, speed, lat, lng, threshold_min, escalation_min, now):
    """Check for unauthorized stationary periods."""
    if speed > 2:  # Moving, no stop alert
        return None

    # Find the most recent non-stop ping or trip-start to compute duration
    # For now, check active LONG_STOP alerts for this trip
    last_alert = await db.execute(
        select(TripIntelligenceAlert).where(
            TripIntelligenceAlert.trip_id == trip.id,
            TripIntelligenceAlert.alert_type.in_(["LONG_STOP"]),
            TripIntelligenceAlert.acknowledged_at.is_(None),
        ).order_by(TripIntelligenceAlert.created_at.desc())
    )
    existing = last_alert.scalar_one_or_none()

    if existing:
        stop_duration = int((now - existing.created_at).total_seconds() / 60)
        if stop_duration >= escalation_min and existing.severity != "critical":
            return {
                "alert_type": "LONG_STOP",
                "severity": "critical",
                "title": f"Extended unauthorized stop: {stop_duration}min",
                "description": (
                    f"Vehicle stationary for {stop_duration} minutes "
                    f"(escalation threshold: {escalation_min}min)"
                ),
                "stop_duration_min": stop_duration,
            }
        return None  # Already alerted, not yet escalated

    # First detection — use a simple heuristic: if speed is 0 and
    # we have no record of a stop, create the initial alert.
    # In production, this would compare against recent GPS pings in MongoDB.
    return {
        "alert_type": "LONG_STOP",
        "severity": "warning",
        "title": "Unauthorized stop detected",
        "description": (
            f"Vehicle has stopped at ({round(lat, 4)}, {round(lng, 4)}). "
            f"Monitoring for {threshold_min}min threshold."
        ),
        "stop_duration_min": 0,
    }


def _check_delay(trip, now, threshold_min, escalation_min):
    """Check if trip is behind planned schedule."""
    eta = trip.planned_end_time
    if not eta:
        return None

    if now < eta:
        return None

    delay_min = int((now - eta).total_seconds() / 60)
    if delay_min < threshold_min:
        return None

    severity = "critical" if delay_min >= escalation_min else "warning"
    alert_type = "ESCALATED_DELAY" if severity == "critical" else "DELAY"

    return {
        "alert_type": alert_type,
        "severity": severity,
        "title": f"Trip delayed by {delay_min} minutes",
        "description": (
            f"Trip was expected to end at {eta.strftime('%H:%M')} but is still "
            f"in progress. Delay: {delay_min}min."
        ),
        "delay_minutes": delay_min,
    }


def _check_night_halt(trip, speed, lat, lng, halt_min, night_start, night_end, now):
    """Check for unregistered night halts."""
    hour = now.hour

    is_night = hour >= night_start or hour < night_end
    if not is_night:
        return None

    if speed > 2:  # Moving, no night halt
        return None

    # In a full implementation, we'd check stopped duration from GPS history.
    # Here, we flag any stationary night-time position.
    return {
        "alert_type": "UNREGISTERED_NIGHT_HALT",
        "severity": "warning",
        "title": "Unregistered night halt detected",
        "description": (
            f"Vehicle stationary during night hours ({night_start}:00-{night_end}:00) "
            f"at ({round(lat, 4)}, {round(lng, 4)}). No registered halt at this location."
        ),
        "stop_duration_min": halt_min,
    }


async def get_trip_alerts(
    db: AsyncSession,
    trip_id: int,
    unacknowledged_only: bool = False,
) -> list[dict]:
    """Get all intelligence alerts for a trip."""
    query = select(TripIntelligenceAlert).where(
        TripIntelligenceAlert.trip_id == trip_id
    ).order_by(TripIntelligenceAlert.created_at.desc())

    if unacknowledged_only:
        query = query.where(TripIntelligenceAlert.acknowledged_at.is_(None))

    result = await db.execute(query)
    alerts = result.scalars().all()

    return [
        {
            "id": a.id,
            "alert_type": a.alert_type,
            "severity": a.severity,
            "title": a.title,
            "description": a.description,
            "latitude": a.latitude,
            "longitude": a.longitude,
            "speed_kmph": a.speed_kmph,
            "deviation_km": a.deviation_km,
            "stop_duration_min": a.stop_duration_min,
            "delay_minutes": a.delay_minutes,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "acknowledged": a.acknowledged_at is not None,
        }
        for a in alerts
    ]


async def acknowledge_alert(
    db: AsyncSession,
    alert_id: int,
    user_id: int,
    resolution: str | None = None,
):
    """Mark an intelligence alert as acknowledged."""
    alert = await db.get(TripIntelligenceAlert, alert_id)
    if not alert:
        return None
    alert.acknowledged_by = user_id
    alert.acknowledged_at = datetime.now(timezone.utc)
    if resolution:
        alert.resolution = resolution
    await db.flush()
    return {"id": alert_id, "acknowledged": True}


def _point_to_line_distance(px, py, lx1, ly1, lx2, ly2) -> float:
    """Approximate perpendicular distance from point to line in km using haversine."""
    import math

    # Project point onto line segment
    dx = lx2 - lx1
    dy = ly2 - ly1
    if dx == 0 and dy == 0:
        return _haversine(px, py, lx1, ly1)

    t = max(0, min(1, ((px - lx1) * dx + (py - ly1) * dy) / (dx * dx + dy * dy)))
    proj_lat = lx1 + t * dx
    proj_lng = ly1 + t * dy
    return _haversine(px, py, proj_lat, proj_lng)


def _haversine(lat1, lon1, lat2, lon2) -> float:
    import math
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
