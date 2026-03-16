# Tracking Service — GPS positions, vehicle path, MongoDB storage
import logging
from datetime import datetime
from typing import Optional
from fastapi import HTTPException
from app.db.mongodb.connection import MongoDB

logger = logging.getLogger(__name__)


async def _get_db():
    db = MongoDB.db
    if db is None:
        raise HTTPException(status_code=503, detail="MongoDB not available. Check MONGODB_URL in .env")
    return db


async def get_live_positions() -> dict:
    db = await _get_db()
    try:
        positions = []
        cursor = db.trip_tracking.find({"is_active": True}).sort("timestamp", -1)
        async for doc in cursor:
            positions.append({
                "vehicle_id": doc.get("vehicle_id"),
                "driver_name": doc.get("driver_name"),
                "lat": doc.get("lat"),
                "lng": doc.get("lng"),
                "speed": doc.get("speed", 0),
                "heading": doc.get("heading", 0),
                "status": doc.get("status", "unknown"),
                "last_update": str(doc.get("timestamp")),
                "trip_number": doc.get("trip_number"),
                "source": "LIVE",
            })
        return {"vehicles": positions, "count": len(positions), "source": "LIVE"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GPS position query failed: {str(e)[:200]}")


async def get_vehicle_path(vehicle_id: str, from_time: datetime, to_time: datetime) -> dict:
    db = await _get_db()
    try:
        points = []
        cursor = db.vehicle_telemetry.find({
            "vehicle_id": vehicle_id,
            "timestamp": {"$gte": from_time, "$lte": to_time},
        }).sort("timestamp", 1)
        async for doc in cursor:
            points.append({
                "lat": doc.get("lat"),
                "lng": doc.get("lng"),
                "speed": doc.get("speed", 0),
                "timestamp": str(doc.get("timestamp")),
            })
        return {"vehicle_id": vehicle_id, "points": points, "count": len(points), "source": "LIVE"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Path query failed: {str(e)[:200]}")


async def record_gps_ping(vehicle_id: str, lat: float, lng: float,
                           speed: float = 0, heading: float = 0,
                           odometer: float = 0, trip_id: Optional[str] = None):
    db = await _get_db()
    doc = {
        "vehicle_id": vehicle_id, "lat": lat, "lng": lng,
        "speed": speed, "heading": heading, "odometer": odometer,
        "trip_id": trip_id, "timestamp": datetime.utcnow(), "is_active": True,
    }
    await db.vehicle_telemetry.insert_one(doc)
    await db.trip_tracking.update_one(
        {"vehicle_id": vehicle_id},
        {"$set": {**doc, "status": "moving" if speed > 2 else "idle"}},
        upsert=True,
    )
    return True
