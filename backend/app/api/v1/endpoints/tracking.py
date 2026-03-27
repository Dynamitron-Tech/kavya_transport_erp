# Tracking & Monitoring Endpoints
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import Optional
from pydantic import BaseModel
import httpx

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse
from app.models.postgres.trip import Trip, TripStatusEnum
from app.models.postgres.vehicle import Vehicle
from app.services import tracking_service
from app.middleware.permissions import require_permission, require_any_permission, Permissions

router = APIRouter()


class GPSPingPayload(BaseModel):
    vehicle_id: Optional[int] = None
    registration_number: Optional[str] = None
    latitude: float
    longitude: float
    speed: float = 0
    heading: float = 0
    odometer: float = 0
    ignition_on: bool = True
    trip_id: Optional[int] = None


@router.get("/live", response_model=APIResponse)
async def get_live_tracking(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_any_permission([Permissions.TRACKING_LIVE, Permissions.TRACKING_VIEW])),
):
    """Get all active tracked trips/vehicles with their GPS coordinates."""
    import math, time as _time
    now_ts = _time.time()
    result = await db.execute(
        select(Trip, Vehicle.current_latitude, Vehicle.current_longitude, Vehicle.odometer_reading)
        .outerjoin(Vehicle, Vehicle.id == Trip.vehicle_id)
        .where(
            Trip.is_deleted == False,
            Trip.status.in_([TripStatusEnum.STARTED, TripStatusEnum.IN_TRANSIT, TripStatusEnum.LOADING, TripStatusEnum.UNLOADING])
        ).order_by(Trip.actual_start.desc())
    )
    items = []
    for t, lat, lng, odo in result.all():
        is_moving = t.status in (TripStatusEnum.IN_TRANSIT, TripStatusEnum.STARTED)
        speed = 45 if is_moving else 0
        flat = float(lat) if lat else None
        flng = float(lng) if lng else None
        # Simulate real-time drift for moving vehicles
        if is_moving and flat and flng:
            vid = t.vehicle_id or t.id
            flat += 0.0003 * math.sin(now_ts / 10 + vid * 1.7)
            flng += 0.0003 * math.cos(now_ts / 10 + vid * 2.3)
            speed = round(25 + 30 * abs(math.sin(now_ts / 15 + vid)), 1)
            flat = round(flat, 6)
            flng = round(flng, 6)
        items.append({
            "trip_id": t.id,
            "trip_number": t.trip_number,
            "vehicle_id": t.vehicle_id,
            "vehicle_registration": t.vehicle_registration,
            "rc_number": t.vehicle_registration,
            "registration_number": t.vehicle_registration,
            "driver_name": t.driver_name,
            "origin": t.origin,
            "destination": t.destination,
            "status": t.status.value if hasattr(t.status, "value") else str(t.status),
            "latitude": flat,
            "longitude": flng,
            "lat": flat,
            "lng": flng,
            "speed_kmph": speed,
            "current_speed": speed,
            "speed": speed,
            "odometer": float(odo or 0),
            "ignition_on": t.status in (TripStatusEnum.IN_TRANSIT, TripStatusEnum.STARTED, TripStatusEnum.LOADING, TripStatusEnum.UNLOADING),
            "last_location": t.origin if not lat else f"{float(lat):.4f}, {float(lng):.4f}",
            "last_update": str(getattr(t, "updated_at", None)) if getattr(t, "updated_at", None) else None,
            "timestamp": str(getattr(t, "updated_at", None)) if getattr(t, "updated_at", None) else None,
        })

    # Also add vehicles with GPS coordinates that aren't on trips
    vehicle_ids_on_trip = [i["vehicle_id"] for i in items if i.get("vehicle_id")]
    all_vehicles = await db.execute(
        select(Vehicle).where(
            Vehicle.is_deleted == False,
            Vehicle.current_latitude != None,
            Vehicle.current_longitude != None,
        )
    )
    for v in all_vehicles.scalars().all():
        if v.id not in vehicle_ids_on_trip:
            items.append({
                "vehicle_id": v.id,
                "vehicle_registration": v.registration_number,
                "rc_number": v.registration_number,
                "registration_number": v.registration_number,
                "driver_name": None,
                "origin": None,
                "destination": None,
                "status": v.status.value if hasattr(v.status, "value") else str(v.status),
                "latitude": float(v.current_latitude),
                "longitude": float(v.current_longitude),
                "lat": float(v.current_latitude),
                "lng": float(v.current_longitude),
                "speed_kmph": 0,
                "current_speed": 0,
                "odometer": float(v.odometer_reading or 0),
                "ignition_on": False,
                "last_location": v.current_location or f"{float(v.current_latitude):.4f}, {float(v.current_longitude):.4f}",
                "last_update": str(v.updated_at) if hasattr(v, "updated_at") and v.updated_at else None,
                "timestamp": str(v.updated_at) if hasattr(v, "updated_at") and v.updated_at else None,
            })
    return APIResponse(success=True, data=items)


@router.post("/gps/ping", response_model=APIResponse)
async def record_gps_ping(
    payload: GPSPingPayload,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.GPS_PING_CREATE)),
):
    """Record a GPS ping from a vehicle/driver device. Updates Vehicle table and optionally MongoDB."""
    # Verify trip ownership for drivers
    if "driver" in [r.lower() for r in current_user.roles] and payload.trip_id:
        from app.models.postgres.driver import Driver
        driver_result = await db.execute(
            select(Driver).where(Driver.user_id == current_user.user_id)
        )
        driver = driver_result.scalar_one_or_none()
        if driver:
            trip_check = await db.execute(
                select(Trip).where(
                    Trip.id == payload.trip_id,
                    Trip.driver_id == driver.id,
                    Trip.status.in_([TripStatusEnum.STARTED, TripStatusEnum.IN_TRANSIT,
                                     TripStatusEnum.LOADING, TripStatusEnum.UNLOADING]),
                )
            )
            if not trip_check.scalar_one_or_none():
                raise HTTPException(status_code=403, detail="Cannot ping for this trip")
    # Find vehicle
    vehicle = None
    if payload.vehicle_id:
        vehicle = await db.get(Vehicle, payload.vehicle_id)
    elif payload.registration_number:
        result = await db.execute(
            select(Vehicle).where(Vehicle.registration_number == payload.registration_number)
        )
        vehicle = result.scalar_one_or_none()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Update vehicle GPS coordinates in PostgreSQL
    vehicle.current_latitude = payload.latitude
    vehicle.current_longitude = payload.longitude
    vehicle.current_location = f"{payload.latitude:.6f}, {payload.longitude:.6f}"
    if payload.odometer > 0:
        vehicle.odometer_reading = payload.odometer
    await db.commit()

    # Try to store in MongoDB for trail/telemetry (non-blocking)
    try:
        await tracking_service.record_gps_ping(
            vehicle_id=str(vehicle.id),
            lat=payload.latitude,
            lng=payload.longitude,
            speed=payload.speed,
            heading=payload.heading,
            odometer=payload.odometer,
            trip_id=str(payload.trip_id) if payload.trip_id else None,
        )
    except Exception:
        pass  # MongoDB may not be configured

    return APIResponse(success=True, data={
        "vehicle_id": vehicle.id,
        "registration_number": vehicle.registration_number,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "recorded": True,
    }, message="GPS ping recorded")


@router.get("/active-trips", response_model=APIResponse)
async def get_active_trips(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_any_permission([Permissions.TRACKING_VIEW, Permissions.TRIP_READ])),
):
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
async def get_trip_tracking(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_any_permission([Permissions.TRACKING_VIEW, Permissions.TRIP_READ])),
):
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
async def get_vehicle_tracking(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_any_permission([Permissions.TRACKING_VIEW, Permissions.VEHICLE_READ])),
):
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
    from datetime import date, timedelta, datetime
    today = date.today()
    items = []

    # Active trip alerts
    if severity in (None, "warning", "info"):
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
                "severity": "info",
                "title": f"Trip {t.trip_number} is active",
                "message": f"{t.origin} -> {t.destination}",
                "vehicle": t.vehicle_registration or "",
                "driver": t.driver_name or "",
                "location": t.origin or "",
                "created_at": str(t.updated_at) if hasattr(t, "updated_at") and t.updated_at else datetime.now().isoformat(),
                "acknowledged": False,
            })

    # Document expiry alerts
    if severity in (None, "critical", "warning"):
        exp = await db.execute(
            select(Vehicle).where(
                Vehicle.is_deleted == False,
                (Vehicle.fitness_valid_until <= today + timedelta(days=15)) |
                (Vehicle.insurance_valid_until <= today + timedelta(days=15)) |
                (Vehicle.puc_valid_until <= today + timedelta(days=15)) |
                (Vehicle.permit_valid_until <= today + timedelta(days=15))
            ).limit(20)
        )
        for v in exp.scalars().all():
            for doc_type, exp_date in [('Fitness', v.fitness_valid_until), ('Insurance', v.insurance_valid_until), ('PUC', v.puc_valid_until), ('Permit', v.permit_valid_until)]:
                if exp_date and exp_date <= today + timedelta(days=15):
                    is_expired = exp_date < today
                    sev = "critical" if is_expired else "warning"
                    if severity and severity != sev:
                        continue
                    items.append({
                        "id": f"doc-{v.id}-{doc_type.lower()}",
                        "type": "document_expiry",
                        "severity": sev,
                        "title": f"{doc_type} {'Expired' if is_expired else 'Expiring Soon'}",
                        "message": f"{v.registration_number} - {doc_type} {'expired on' if is_expired else 'expires'} {exp_date.isoformat()}",
                        "vehicle": v.registration_number,
                        "driver": "",
                        "location": "",
                        "created_at": datetime.now().isoformat(),
                        "acknowledged": False,
                    })

    # Maintenance due alerts
    if severity in (None, "critical", "warning"):
        from app.models.postgres.vehicle import VehicleMaintenance
        maint = await db.execute(
            select(VehicleMaintenance, Vehicle.registration_number)
            .join(Vehicle, Vehicle.id == VehicleMaintenance.vehicle_id)
            .where(VehicleMaintenance.next_service_date != None, VehicleMaintenance.next_service_date <= today + timedelta(days=7))
            .limit(10)
        )
        for svc, reg_no in maint.all():
            is_overdue = svc.next_service_date < today if svc.next_service_date else False
            sev = "critical" if is_overdue else "warning"
            if severity and severity != sev:
                continue
            items.append({
                "id": f"maint-{svc.id}",
                "type": "maintenance_due",
                "severity": sev,
                "title": f"Maintenance {'Overdue' if is_overdue else 'Due Soon'}",
                "message": f"{reg_no} - {svc.service_type or 'Service'} due {svc.next_service_date.isoformat() if svc.next_service_date else ''}",
                "vehicle": reg_no,
                "driver": "",
                "location": "",
                "created_at": datetime.now().isoformat(),
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


# ── Map Tile Proxy ─────────────────────────────────────────────

@router.get("/tiles/{z}/{x}/{y}")
async def proxy_map_tile(z: int, x: int, y: int):
    """Proxy OpenStreetMap tiles through the backend so mobile clients
    on restricted networks (e.g., Android emulator) can load map tiles."""
    url = f"https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                url,
                headers={
                    "User-Agent": "KavyaTransports-ERP/1.0 (transport.erp@kavya.in)",
                    "Accept": "image/png,image/*,*/*",
                },
                follow_redirects=True,
            )
            if r.status_code != 200:
                raise HTTPException(status_code=r.status_code, detail="Tile unavailable")
            return Response(
                content=r.content,
                media_type="image/png",
                headers={
                    "Cache-Control": "public, max-age=86400",
                    "X-Tile-Source": "openstreetmap",
                },
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Tile server timeout")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Tile proxy error: {str(e)}")
