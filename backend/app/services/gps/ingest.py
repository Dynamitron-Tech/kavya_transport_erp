"""
Unified GPS Ingest — Writes GPSPoint data to PostgreSQL + MongoDB + WebSocket.

All providers funnel through this single ingest pipeline so behaviour
is consistent regardless of GPS source.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres.connection import AsyncSessionLocal
from app.db.mongodb.connection import MongoDB
from app.models.postgres.vehicle import Vehicle

from .base_provider import GPSPoint

logger = logging.getLogger(__name__)


async def ingest_gps_points(points: list[GPSPoint], provider_id: str) -> dict:
    """
    Ingest a batch of GPS points from a single provider.

    1. Match registration → vehicle ID
    2. Update Vehicle GPS coords in PostgreSQL
    3. Store telemetry in MongoDB
    4. Broadcast via WebSocket

    Returns summary: {updated, skipped, errors}
    """
    if not points:
        return {"updated": 0, "skipped": 0, "errors": 0}

    updated = skipped = errors = 0

    async with AsyncSessionLocal() as db:
        # Pre-fetch registration → vehicle ID map
        result = await db.execute(
            select(Vehicle.id, Vehicle.registration_number)
            .where(Vehicle.is_deleted == False)
        )
        reg_to_id = {}
        for row in result.all():
            clean = row.registration_number.replace("-", "").replace(" ", "").upper()
            reg_to_id[clean] = row.id

        for pt in points:
            try:
                vehicle_id = reg_to_id.get(pt.registration_number)
                if not vehicle_id:
                    skipped += 1
                    continue

                pt.vehicle_id = vehicle_id

                # 1. Update PostgreSQL
                values = {
                    "current_latitude": pt.lat,
                    "current_longitude": pt.lng,
                    "current_location": f"{pt.lat:.6f}, {pt.lng:.6f}",
                    "gps_provider_status": "active",
                    "last_gps_at": pt.timestamp or datetime.now(timezone.utc),
                }
                if pt.odometer > 0:
                    values["odometer_reading"] = pt.odometer

                await db.execute(
                    update(Vehicle)
                    .where(Vehicle.id == vehicle_id)
                    .values(**values)
                )

                # 2. Store in MongoDB
                await _store_telemetry_mongo(vehicle_id, pt)

                # 3. Broadcast via WebSocket
                await _broadcast_position(vehicle_id, pt)

                updated += 1

            except Exception as exc:
                logger.error("[GPS Ingest] Error for %s: %s", pt.registration_number, exc)
                errors += 1

        await db.commit()

    if updated > 0:
        logger.info("[GPS Ingest][%s] %d updated, %d skipped, %d errors",
                     provider_id, updated, skipped, errors)

    return {"updated": updated, "skipped": skipped, "errors": errors}


async def _store_telemetry_mongo(vehicle_id: int, pt: GPSPoint) -> None:
    """Insert telemetry into MongoDB."""
    db = MongoDB.db
    if db is None:
        return

    doc = {
        "vehicle_id": str(vehicle_id),
        "registration_number": pt.registration_number,
        "provider": pt.provider,
        "provider_live": True,
        "lat": pt.lat,
        "lng": pt.lng,
        "altitude": pt.altitude,
        "speed": pt.speed,
        "heading": pt.heading,
        "odometer": pt.odometer,
        "ignition_on": pt.ignition_on,
        "engine_on": pt.engine_on,
        "fuel_level": pt.fuel_level,
        "battery_voltage": pt.battery_voltage,
        "status": pt.status,
        "timestamp": pt.timestamp or datetime.utcnow(),
        "source": pt.provider,
        "is_active": True,
    }

    await db.vehicle_telemetry.insert_one(doc)

    await db.trip_tracking.update_one(
        {"vehicle_id": str(vehicle_id)},
        {"$set": {**doc}},
        upsert=True,
    )


async def _broadcast_position(vehicle_id: int, pt: GPSPoint) -> None:
    """Push position update to WebSocket subscribers (best-effort)."""
    try:
        from app.websocket.manager import ws_manager
        await ws_manager.send_vehicle_update(
            vehicle_id=vehicle_id,
            data={
                "type": "gps_update",
                "vehicle_id": vehicle_id,
                "registration_number": pt.registration_number,
                "provider": pt.provider,
                "latitude": pt.lat,
                "longitude": pt.lng,
                "speed": pt.speed,
                "heading": pt.heading,
                "ignition_on": pt.ignition_on,
                "engine_on": pt.engine_on,
                "status": pt.status,
                "timestamp": pt.timestamp.isoformat() if pt.timestamp else None,
            },
        )
    except Exception:
        pass
