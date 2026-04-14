# Fleet Manager Endpoints
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, or_
from typing import Optional
from decimal import Decimal
from datetime import date, datetime
import enum
from pydantic import BaseModel

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse, PaginationMeta
from app.services import dashboard_service, vehicle_service, trip_service
from app.models.postgres.vehicle import Vehicle
from app.models.postgres.driver import Driver, DriverLicense, DriverStatus
from app.models.postgres.trip import Trip, TripStatusEnum

router = APIRouter()


class AssignDriverRequest(BaseModel):
    driver_id: Optional[int] = None


def _serialize_row(obj) -> dict:
    """Convert a SQLAlchemy model row to a JSON-safe dict."""
    d = {}
    for c in obj.__table__.columns:
        val = getattr(obj, c.key)
        if isinstance(val, Decimal):
            val = float(val)
        elif isinstance(val, enum.Enum):
            val = val.value
        elif isinstance(val, (date, datetime)):
            val = val.isoformat()
        d[c.key] = val
    return d


@router.get("/dashboard", response_model=APIResponse)
async def fleet_dashboard(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    data = await dashboard_service.get_fleet_manager_dashboard(db)
    return APIResponse(success=True, data=data)


@router.get("/vehicles", response_model=APIResponse)
async def fleet_vehicles(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=500),
    search: Optional[str] = None, status: Optional[str] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
):
    vehicles, total = await vehicle_service.list_vehicles(db, page, limit, search, status)
    pages = (total + limit - 1) // limit
    items = []
    for v in vehicles:
        d = _serialize_row(v)
        d["expiry_alerts"] = vehicle_service.get_expiry_alerts(v)
        items.append(d)
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/trips", response_model=APIResponse)
async def fleet_trips(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=500),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
):
    trips, total = await trip_service.list_trips(db, page, limit, status=status)
    pages = (total + limit - 1) // limit
    items = []
    for trip in trips:
        detail = await trip_service.get_trip_with_details(db, trip)
        # Ensure Decimal values are JSON-safe
        for k, v in detail.items():
            if isinstance(v, Decimal):
                detail[k] = float(v)
        items.append(detail)
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/expiring-documents", response_model=APIResponse)
async def expiring_docs(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
):
    vehicles = await vehicle_service.get_vehicles_expiring_soon(db, days)
    items = []
    for v in vehicles:
        d = {"vehicle_id": v.id, "registration": v.registration_number, "type": v.vehicle_type}
        d["alerts"] = vehicle_service.get_expiry_alerts(v)
        items.append(d)
    return APIResponse(success=True, data=items)


@router.get("/vehicle-assignments", response_model=APIResponse)
async def list_vehicle_assignments(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Return all vehicles with their currently assigned default driver."""
    result = await db.execute(
        select(Vehicle).where(Vehicle.is_deleted == False).order_by(Vehicle.registration_number)
    )
    vehicles = result.scalars().all()

    items = []
    for v in vehicles:
        driver_info = None
        if v.default_driver_id:
            dr_result = await db.execute(
                select(Driver).where(Driver.id == v.default_driver_id, Driver.is_deleted == False)
            )
            driver = dr_result.scalars().first()
            if driver:
                lic_result = await db.execute(
                    select(DriverLicense)
                    .where(DriverLicense.driver_id == driver.id)
                    .order_by(DriverLicense.id.desc())
                    .limit(1)
                )
                lic = lic_result.scalars().first()
                driver_info = {
                    "id": driver.id,
                    "name": f"{driver.first_name} {driver.last_name or ''}".strip(),
                    "phone": driver.phone,
                    "status": driver.status.value if driver.status else None,
                    "license_number": lic.license_number if lic else None,
                }
        items.append({
            "vehicle_id": v.id,
            "registration_number": v.registration_number,
            "vehicle_type": v.vehicle_type.value if v.vehicle_type else None,
            "status": v.status.value if v.status else None,
            "default_driver_id": v.default_driver_id,
            "driver": driver_info,
        })
    return APIResponse(success=True, data=items)


@router.post("/vehicles/{vehicle_id}/assign-driver", response_model=APIResponse)
async def assign_driver_to_vehicle(
    vehicle_id: int,
    body: AssignDriverRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Assign (or un-assign) a default driver to a vehicle."""
    veh_result = await db.execute(
        select(Vehicle).where(Vehicle.id == vehicle_id, Vehicle.is_deleted == False)
    )
    vehicle = veh_result.scalars().first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    if body.driver_id:
        dr_result = await db.execute(
            select(Driver).where(Driver.id == body.driver_id, Driver.is_deleted == False)
        )
        driver = dr_result.scalars().first()
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")

    vehicle.default_driver_id = body.driver_id
    await db.commit()
    await db.refresh(vehicle)

    return APIResponse(
        success=True,
        data={"vehicle_id": vehicle_id, "default_driver_id": vehicle.default_driver_id},
        message="Driver assigned successfully" if body.driver_id else "Driver unassigned",
    )


@router.get("/drivers", response_model=APIResponse)
async def fleet_drivers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """List all drivers with their assigned vehicle and completed trip count."""
    query = select(Driver).where(Driver.is_deleted == False)
    count_query = select(func.count(Driver.id)).where(Driver.is_deleted == False)

    if search:
        sf = or_(
            Driver.first_name.ilike(f"%{search}%"),
            Driver.last_name.ilike(f"%{search}%"),
            Driver.phone.ilike(f"%{search}%"),
        )
        query = query.where(sf)
        count_query = count_query.where(sf)

    if status:
        try:
            status_enum = DriverStatus[status.upper()]
            query = query.where(Driver.status == status_enum)
            count_query = count_query.where(Driver.status == status_enum)
        except KeyError:
            pass  # ignore unknown status values

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    drivers_result = await db.execute(query.offset(offset).limit(limit).order_by(Driver.id))
    drivers = drivers_result.scalars().all()

    # Batch: Vehicle assigned per driver (Vehicle.default_driver_id = driver.id)
    driver_ids = [d.id for d in drivers]
    vehicle_map: dict = {}
    if driver_ids:
        veh_result = await db.execute(
            select(Vehicle.default_driver_id, Vehicle.registration_number)
            .where(Vehicle.default_driver_id.in_(driver_ids), Vehicle.is_deleted == False)
        )
        for row in veh_result.all():
            vehicle_map[row.default_driver_id] = row.registration_number

    # Batch: Count completed trips per driver
    trips_map: dict = {}
    if driver_ids:
        trips_result = await db.execute(
            select(Trip.driver_id, func.count(Trip.id).label("cnt"))
            .where(Trip.driver_id.in_(driver_ids), Trip.status == TripStatusEnum.COMPLETED)
            .group_by(Trip.driver_id)
        )
        trips_map = {row.driver_id: row.cnt for row in trips_result.all()}

    # Batch: first license per driver
    lic_map: dict = {}
    if driver_ids:
        lic_result = await db.execute(
            select(DriverLicense)
            .where(DriverLicense.driver_id.in_(driver_ids))
            .order_by(DriverLicense.driver_id, DriverLicense.id.desc())
        )
        for lic in lic_result.scalars().all():
            if lic.driver_id not in lic_map:
                lic_map[lic.driver_id] = lic

    items = []
    for d in drivers:
        status_val = d.status.value if hasattr(d.status, 'value') else str(d.status)
        lic = lic_map.get(d.id)
        items.append({
            "id": d.id,
            "name": f"{d.first_name} {d.last_name or ''}".strip(),
            "phone": d.phone,
            "status": status_val,
            "assigned_vehicle": vehicle_map.get(d.id),
            "trips_completed": trips_map.get(d.id, 0),
            "license_number": lic.license_number if lic else None,
            "license_expiry": str(lic.expiry_date) if lic and lic.expiry_date else None,
            "safety_score": d.safety_score if hasattr(d, 'safety_score') else 0,
        })

    pages = (total + limit - 1) // limit
    return APIResponse(
        success=True,
        data=items,
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


@router.get("/sos-alerts", response_model=APIResponse)
async def fleet_sos_alerts(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Return recent SOS events for Fleet Manager notification screen."""
    from app.models.postgres.driver_event import DriverEvent, DriverEventType
    from sqlalchemy import desc

    result = await db.execute(
        select(DriverEvent)
        .where(DriverEvent.event_type == DriverEventType.SOS)
        .order_by(desc(DriverEvent.created_at))
        .limit(limit)
    )
    events = result.scalars().all()

    # Batch-fetch driver and trip info
    driver_ids = list({e.driver_id for e in events if e.driver_id})
    trip_ids = list({e.trip_id for e in events if e.trip_id})

    drivers_map: dict = {}
    if driver_ids:
        dr = await db.execute(select(Driver).where(Driver.id.in_(driver_ids)))
        for d in dr.scalars().all():
            drivers_map[d.id] = d

    trips_map: dict = {}
    if trip_ids:
        tr = await db.execute(select(Trip).where(Trip.id.in_(trip_ids)))
        for t in tr.scalars().all():
            trips_map[t.id] = t

    items = []
    for e in events:
        driver = drivers_map.get(e.driver_id)
        trip = trips_map.get(e.trip_id) if e.trip_id else None
        driver_name = f"{driver.first_name} {driver.last_name}" if driver else "Unknown"
        ec_name = driver.emergency_contact_name if driver else None
        ec_phone = driver.emergency_contact_phone if driver else None
        items.append({
            "id": e.id,
            "driver_id": e.driver_id,
            "driver_name": driver_name,
            "driver_phone": driver.phone if driver else None,
            "trip_id": e.trip_id,
            "trip_number": trip.trip_number if trip else None,
            "origin": trip.origin if trip else None,
            "destination": trip.destination if trip else None,
            "vehicle_registration": trip.vehicle_registration if trip else None,
            "latitude": e.latitude,
            "longitude": e.longitude,
            "location_name": e.location_name,
            "emergency_contact_name": ec_name,
            "emergency_contact_phone": ec_phone,
            "triggered_at": e.created_at.isoformat() if e.created_at else None,
        })

    return APIResponse(success=True, data=items)

