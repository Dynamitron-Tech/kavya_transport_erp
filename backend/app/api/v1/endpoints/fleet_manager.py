# Fleet Manager Endpoints
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
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
from app.models.postgres.driver import Driver, DriverLicense

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
