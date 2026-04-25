# Geofence Service
# Transport ERP — Phase B: AIS-140 + Geofencing

import math
import logging
from typing import Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.postgres.geofence import Geofence, GeofenceType
from app.models.postgres.driver_event import DriverEvent, DriverEventType

logger = logging.getLogger(__name__)


def _point_in_polygon(lat: float, lng: float, polygon: list) -> bool:
    """Ray-casting algorithm for point-in-polygon check."""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi_lat = polygon[i].get("lat", 0)
        pi_lng = polygon[i].get("lng", 0)
        pj_lat = polygon[j].get("lat", 0)
        pj_lng = polygon[j].get("lng", 0)
        if ((pi_lng > lng) != (pj_lng > lng)) and (
            lat < (pj_lat - pi_lat) * (lng - pi_lng) / (pj_lng - pi_lng) + pi_lat
        ):
            inside = not inside
        j = i
    return inside


def _haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in meters between two points."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def check_position_against_geofence(lat: float, lng: float, geofence: Geofence) -> bool:
    """Check if a position is INSIDE a geofence. Returns True if inside."""
    if geofence.polygon:
        return _point_in_polygon(lat, lng, geofence.polygon)
    elif geofence.center_lat is not None and geofence.center_lng is not None and geofence.radius_meters:
        dist = _haversine_meters(lat, lng, geofence.center_lat, geofence.center_lng)
        return dist <= geofence.radius_meters
    return True  # No geometry defined → assume inside


async def list_geofences(
    db: AsyncSession,
    tenant_id: Optional[int] = None,
    trip_id: Optional[int] = None,
    route_id: Optional[int] = None,
    is_active: Optional[bool] = True,
    skip: int = 0,
    limit: int = 50,
) -> list:
    filters = [Geofence.is_deleted == False]
    if tenant_id:
        filters.append(Geofence.tenant_id == tenant_id)
    if trip_id:
        filters.append(Geofence.trip_id == trip_id)
    if route_id:
        filters.append(Geofence.route_id == route_id)
    if is_active is not None:
        filters.append(Geofence.is_active == is_active)

    result = await db.execute(
        select(Geofence).where(and_(*filters)).order_by(Geofence.created_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()


async def get_geofence(db: AsyncSession, geofence_id: int) -> Optional[Geofence]:
    result = await db.execute(
        select(Geofence).where(Geofence.id == geofence_id, Geofence.is_deleted == False)
    )
    return result.scalar_one_or_none()


async def create_geofence(db: AsyncSession, data: dict, tenant_id: Optional[int] = None, branch_id: Optional[int] = None) -> Geofence:
    geofence_type_val = data.pop("geofence_type", "zone")
    try:
        gt = GeofenceType(geofence_type_val)
    except ValueError:
        gt = GeofenceType.ZONE

    # Convert polygon PointSchema list to plain dicts
    polygon = data.pop("polygon", None)
    if polygon:
        polygon = [p.dict() if hasattr(p, "dict") else p for p in polygon]

    geofence = Geofence(
        **data,
        polygon=polygon,
        geofence_type=gt,
        tenant_id=tenant_id,
        branch_id=branch_id,
    )
    db.add(geofence)
    await db.commit()
    await db.refresh(geofence)
    return geofence


async def update_geofence(db: AsyncSession, geofence_id: int, data: dict) -> Optional[Geofence]:
    geofence = await get_geofence(db, geofence_id)
    if not geofence:
        return None

    if "geofence_type" in data and data["geofence_type"]:
        try:
            data["geofence_type"] = GeofenceType(data["geofence_type"])
        except ValueError:
            data.pop("geofence_type")

    if "polygon" in data and data["polygon"]:
        data["polygon"] = [p.dict() if hasattr(p, "dict") else p for p in data["polygon"]]

    for key, val in data.items():
        if val is not None:
            setattr(geofence, key, val)

    await db.commit()
    await db.refresh(geofence)
    return geofence


async def delete_geofence(db: AsyncSession, geofence_id: int) -> bool:
    geofence = await get_geofence(db, geofence_id)
    if not geofence:
        return False
    from datetime import datetime
    geofence.is_deleted = True
    geofence.deleted_at = datetime.utcnow()
    await db.commit()
    return True


async def get_trip_geofences(db: AsyncSession, trip_id: int) -> list:
    result = await db.execute(
        select(Geofence).where(
            Geofence.trip_id == trip_id,
            Geofence.is_deleted == False,
            Geofence.is_active == True,
        )
    )
    return result.scalars().all()


async def check_position(
    db: AsyncSession,
    lat: float,
    lng: float,
    vehicle_id: Optional[int] = None,
    tenant_id: Optional[int] = None,
) -> list:
    """Check a position against all active geofences. Returns list of breach results."""
    filters = [Geofence.is_deleted == False, Geofence.is_active == True]
    if tenant_id:
        filters.append(Geofence.tenant_id == tenant_id)

    result = await db.execute(select(Geofence).where(and_(*filters)))
    geofences = result.scalars().all()

    breaches = []
    for gf in geofences:
        inside = check_position_against_geofence(lat, lng, gf)
        # For RESTRICTED zones: being inside is a breach
        # For all others: being outside is a breach
        is_breach = inside if gf.geofence_type == GeofenceType.RESTRICTED else not inside
        if is_breach:
            breaches.append({
                "geofence_id": gf.id,
                "geofence_name": gf.name,
                "geofence_type": gf.geofence_type.value,
                "breach": True,
            })
    return breaches


async def detect_breach_and_record(
    db: AsyncSession,
    driver_id: int,
    vehicle_id: Optional[int],
    trip_id: Optional[int],
    lat: float,
    lng: float,
    speed_kmph: Optional[float] = None,
    tenant_id: Optional[int] = None,
    branch_id: Optional[int] = None,
) -> List[DriverEvent]:
    """Check position, create DriverEvent records for any breaches."""
    breaches = await check_position(db, lat, lng, vehicle_id, tenant_id)
    events = []
    for breach in breaches:
        event = DriverEvent(
            driver_id=driver_id,
            trip_id=trip_id,
            vehicle_id=vehicle_id,
            event_type=DriverEventType.GEOFENCE_BREACH,
            severity=3,
            latitude=lat,
            longitude=lng,
            speed_kmph=speed_kmph,
            details=breach,
            tenant_id=tenant_id,
            branch_id=branch_id,
        )
        db.add(event)
        events.append(event)

    if events:
        await db.commit()
    return events


async def detect_speed_violation(
    db: AsyncSession,
    driver_id: int,
    vehicle_id: Optional[int],
    trip_id: Optional[int],
    lat: float,
    lng: float,
    speed_kmph: float,
    tenant_id: Optional[int] = None,
    branch_id: Optional[int] = None,
) -> Optional[DriverEvent]:
    """Check if speed exceeds geofence speed limit or default limit (80 kmph)."""
    # Check against geofence-specific speed limits
    filters = [Geofence.is_deleted == False, Geofence.is_active == True, Geofence.speed_limit_kmph.isnot(None)]
    if tenant_id:
        filters.append(Geofence.tenant_id == tenant_id)
    result = await db.execute(select(Geofence).where(and_(*filters)))
    speed_geofences = result.scalars().all()

    for gf in speed_geofences:
        inside = check_position_against_geofence(lat, lng, gf)
        if inside and speed_kmph > gf.speed_limit_kmph:
            event = DriverEvent(
                driver_id=driver_id,
                trip_id=trip_id,
                vehicle_id=vehicle_id,
                event_type=DriverEventType.OVERSPEED,
                severity=4 if speed_kmph > gf.speed_limit_kmph * 1.5 else 2,
                latitude=lat,
                longitude=lng,
                speed_kmph=speed_kmph,
                details={"limit": gf.speed_limit_kmph, "geofence_id": gf.id, "geofence_name": gf.name},
                tenant_id=tenant_id,
                branch_id=branch_id,
            )
            db.add(event)
            await db.commit()
            await db.refresh(event)
            return event

    # Default highway limit
    if speed_kmph > 80:
        event = DriverEvent(
            driver_id=driver_id,
            trip_id=trip_id,
            vehicle_id=vehicle_id,
            event_type=DriverEventType.OVERSPEED,
            severity=3 if speed_kmph > 120 else 2,
            latitude=lat,
            longitude=lng,
            speed_kmph=speed_kmph,
            details={"limit": 80, "actual": speed_kmph},
            tenant_id=tenant_id,
            branch_id=branch_id,
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)
        return event

    return None
