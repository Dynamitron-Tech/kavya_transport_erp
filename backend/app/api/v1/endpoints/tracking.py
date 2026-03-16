# Tracking & Monitoring Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse
from app.models.postgres.trip import Trip, TripStatusEnum
from app.services import tracking_service

router = APIRouter()


@router.get("/live", response_model=APIResponse)
async def get_live_tracking(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    """Alias used by frontend for active tracked trips/vehicles."""
    result = await db.execute(
        select(Trip).where(
            Trip.is_deleted == False,
            Trip.status.in_([TripStatusEnum.STARTED, TripStatusEnum.IN_TRANSIT, TripStatusEnum.LOADING, TripStatusEnum.UNLOADING])
        ).order_by(Trip.actual_start.desc())
    )
    trips = result.scalars().all()
    items = [{
        "trip_id": t.id,
        "trip_number": t.trip_number,
        "vehicle_registration": t.vehicle_registration,
        "driver_name": t.driver_name,
        "origin": t.origin,
        "destination": t.destination,
        "status": t.status.value if hasattr(t.status, "value") else str(t.status),
        "latitude": None,
        "longitude": None,
        "last_location": getattr(t, "last_location", None),
        "last_update": str(getattr(t, "updated_at", None)) if getattr(t, "updated_at", None) else None,
    } for t in trips]
    return APIResponse(success=True, data=items)


@router.get("/active-trips", response_model=APIResponse)
async def get_active_trips(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    result = await db.execute(
        select(Trip).where(
            Trip.is_deleted == False,
            Trip.status.in_([TripStatusEnum.STARTED, TripStatusEnum.IN_TRANSIT, TripStatusEnum.LOADING, TripStatusEnum.UNLOADING])
        ).order_by(Trip.actual_start.desc())
    )
    trips = result.scalars().all()
    items = [{
        "id": t.id, "trip_number": t.trip_number,
        "vehicle_registration": t.vehicle_registration,
        "driver_name": t.driver_name, "driver_phone": t.driver_phone,
        "origin": t.origin, "destination": t.destination,
        "status": t.status.value if hasattr(t.status, "value") else str(t.status),
        "actual_start": str(t.actual_start) if t.actual_start else None,
    } for t in trips]
    return APIResponse(success=True, data=items)


@router.get("/trip/{trip_id}", response_model=APIResponse)
async def get_trip_tracking(trip_id: int, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return APIResponse(success=True, data={
        "trip_number": trip.trip_number,
        "vehicle_registration": trip.vehicle_registration,
        "driver_name": trip.driver_name,
        "origin": trip.origin, "destination": trip.destination,
        "status": trip.status.value if hasattr(trip.status, "value") else str(trip.status),
        "actual_start": str(trip.actual_start) if trip.actual_start else None,
        "actual_end": str(trip.actual_end) if trip.actual_end else None,
        "start_odometer": float(trip.start_odometer) if trip.start_odometer else None,
        "end_odometer": float(trip.end_odometer) if trip.end_odometer else None,
    })


@router.get("/vehicle/{vehicle_id}", response_model=APIResponse)
async def get_vehicle_tracking(vehicle_id: int, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    result = await db.execute(
        select(Trip).where(
            Trip.is_deleted == False,
            Trip.vehicle_id == vehicle_id,
            Trip.status.in_([TripStatusEnum.STARTED, TripStatusEnum.IN_TRANSIT, TripStatusEnum.LOADING, TripStatusEnum.UNLOADING])
        ).order_by(Trip.updated_at.desc())
    )
    trip = result.scalars().first()
    if not trip:
        raise HTTPException(status_code=404, detail="No active tracking found for vehicle")
    return APIResponse(success=True, data={
        "trip_id": trip.id,
        "trip_number": trip.trip_number,
        "vehicle_id": trip.vehicle_id,
        "vehicle_registration": trip.vehicle_registration,
        "driver_name": trip.driver_name,
        "status": trip.status.value if hasattr(trip.status, "value") else str(trip.status),
        "latitude": None,
        "longitude": None,
        "last_location": getattr(trip, "last_location", None),
        "last_update": str(getattr(trip, "updated_at", None)) if getattr(trip, "updated_at", None) else None,
    })


@router.get("/alerts", response_model=APIResponse)
async def list_tracking_alerts(
    severity: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    items = []
    if severity in (None, "warning", "critical"):
        expiring_soon = await db.execute(
            select(Trip).where(
                Trip.is_deleted == False,
                Trip.status.in_([TripStatusEnum.STARTED, TripStatusEnum.IN_TRANSIT])
            ).limit(10)
        )
        for t in expiring_soon.scalars().all():
            items.append({
                "id": f"trip-{t.id}",
                "type": "trip_status",
                "severity": "warning",
                "title": f"Trip {t.trip_number} is active",
                "message": f"{t.origin} -> {t.destination}",
                "acknowledged": False,
            })
    return APIResponse(success=True, data=items)


@router.post("/alerts/{alert_id}/acknowledge", response_model=APIResponse)
async def acknowledge_tracking_alert(alert_id: str, current_user: TokenData = Depends(get_current_user)):
    return APIResponse(success=True, data={"id": alert_id, "acknowledged": True}, message="Alert acknowledged")


# ── GPS Position Endpoints ──────────────────────────────────────

@router.get("/gps/positions", response_model=APIResponse)
async def get_gps_positions(
    current_user: TokenData = Depends(get_current_user),
):
    """Get live GPS positions for all tracked vehicles (from MongoDB)."""
    result = await tracking_service.get_live_positions()
    return APIResponse(success=True, data=result, message="Live GPS positions fetched")


@router.get("/gps/path/{vehicle_id}", response_model=APIResponse)
async def get_vehicle_path(
    vehicle_id: str,
    hours: int = Query(24, ge=1, le=168, description="Hours of path history"),
    current_user: TokenData = Depends(get_current_user),
):
    """Get GPS path/trail for a vehicle over the given time window."""
    from datetime import datetime, timedelta
    to_time = datetime.utcnow()
    from_time = to_time - timedelta(hours=hours)
    result = await tracking_service.get_vehicle_path(vehicle_id, from_time, to_time)
    return APIResponse(success=True, data=result, message="Vehicle path fetched")
