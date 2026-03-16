# Tracking Service — GPS positions, vehicle path, MongoDB storage
import logging
import random
from datetime import datetime, timedelta
from typing import List, Optional

from app.core.config import settings
from app.db.mongodb.connection import MongoDB

logger = logging.getLogger(__name__)

# Coimbatore area bounding box for mock data
CBE_LAT = (10.95, 11.08)
CBE_LNG = (76.90, 77.05)

MOCK_VEHICLES = [
    {"vehicle_id": "TN39CD1234", "driver_name": "Rajesh Kumar", "status": "moving", "speed": 62},
    {"vehicle_id": "TN39AB5678", "driver_name": "Suresh Babu", "status": "idle", "speed": 0},
    {"vehicle_id": "TN39EF9012", "driver_name": "Karthik S", "status": "moving", "speed": 48},
    {"vehicle_id": "TN39GH3456", "driver_name": "Manikandan R", "status": "stopped", "speed": 0},
    {"vehicle_id": "TN39IJ7890", "driver_name": "Selvam P", "status": "moving", "speed": 55},
]


async def get_live_positions() -> dict:
    """Get live GPS positions for all active vehicles."""
    db = MongoDB.db
    if db is not None:
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
            if positions:
                return {"vehicles": positions, "count": len(positions), "source": "LIVE"}
        except Exception as e:
            logger.warning(f"MongoDB tracking query failed: {e}")

    # Mock data
    now = datetime.utcnow()
    vehicles = []
    for v in MOCK_VEHICLES:
        vehicles.append({
            "vehicle_id": v["vehicle_id"],
            "driver_name": v["driver_name"],
            "lat": round(random.uniform(*CBE_LAT), 6),
            "lng": round(random.uniform(*CBE_LNG), 6),
            "speed": v["speed"] + random.randint(-5, 5) if v["speed"] > 0 else 0,
            "heading": random.randint(0, 360),
            "status": v["status"],
            "last_update": str(now - timedelta(seconds=random.randint(10, 300))),
            "trip_number": f"TRIP-{random.randint(1000, 9999)}",
            "source": "MOCK_DATA",
        })
    return {"vehicles": vehicles, "count": len(vehicles), "source": "MOCK_DATA"}


async def get_vehicle_path(vehicle_id: str, from_time: datetime, to_time: datetime) -> dict:
    """Get historical GPS path for a vehicle."""
    db = MongoDB.db
    if db is not None:
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
            if points:
                return {"vehicle_id": vehicle_id, "points": points, "count": len(points), "source": "LIVE"}
        except Exception as e:
            logger.warning(f"Path query failed: {e}")

    # Mock: generate 50 points along Coimbatore→Chennai route
    points = []
    start_lat, start_lng = 11.0168, 76.9558
    end_lat, end_lng = 13.0827, 80.2707
    for i in range(50):
        frac = i / 49
        points.append({
            "lat": round(start_lat + (end_lat - start_lat) * frac + random.uniform(-0.01, 0.01), 6),
            "lng": round(start_lng + (end_lng - start_lng) * frac + random.uniform(-0.01, 0.01), 6),
            "speed": random.randint(30, 80) if i > 0 and i < 49 else 0,
            "timestamp": str(from_time + timedelta(minutes=i * 10)),
        })
    total_km = round(random.uniform(480, 520), 1)
    return {
        "vehicle_id": vehicle_id,
        "points": points,
        "count": len(points),
        "total_km": total_km,
        "avg_speed": round(total_km / 8, 1),
        "stops": random.randint(2, 5),
        "source": "MOCK_DATA",
    }


async def record_gps_ping(vehicle_id: str, lat: float, lng: float,
                           speed: float = 0, heading: float = 0,
                           odometer: float = 0, trip_id: Optional[str] = None):
    """Record a GPS ping to MongoDB (always real, not mock)."""
    db = MongoDB.db
    if db is None:
        logger.warning("MongoDB not available for GPS ping")
        return False

    doc = {
        "vehicle_id": vehicle_id,
        "lat": lat,
        "lng": lng,
        "speed": speed,
        "heading": heading,
        "odometer": odometer,
        "trip_id": trip_id,
        "timestamp": datetime.utcnow(),
        "is_active": True,
    }
    await db.vehicle_telemetry.insert_one(doc)

    # Update trip_tracking for live positions
    await db.trip_tracking.update_one(
        {"vehicle_id": vehicle_id},
        {"$set": {**doc, "status": "moving" if speed > 2 else "idle"}},
        upsert=True,
    )
    return True
