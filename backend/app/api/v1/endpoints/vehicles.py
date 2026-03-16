# Vehicle Management Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.vehicle import VehicleCreate, VehicleUpdate
from app.services import vehicle_service

router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_vehicles(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None, status: Optional[str] = None,
    vehicle_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_READ)),
):
    vehicles, total = await vehicle_service.list_vehicles(db, page, limit, search, status, vehicle_type)
    pages = (total + limit - 1) // limit
    items = []
    for v in vehicles:
        d = {c.key: getattr(v, c.key) for c in v.__table__.columns}
        d["expiry_alerts"] = vehicle_service.get_expiry_alerts(v)
        items.append(d)
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/summary", response_model=APIResponse)
async def fleet_summary(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    summary = await vehicle_service.get_fleet_summary(db)
    return APIResponse(success=True, data=summary)


@router.get("/expiring", response_model=APIResponse)
async def expiring_vehicles(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    vehicles = await vehicle_service.get_vehicles_expiring_soon(db, days)
    items = []
    for v in vehicles:
        d = {c.key: getattr(v, c.key) for c in v.__table__.columns}
        d["expiry_alerts"] = vehicle_service.get_expiry_alerts(v)
        items.append(d)
    return APIResponse(success=True, data=items)


@router.get("/{vehicle_id}", response_model=APIResponse)
async def get_vehicle(vehicle_id: int, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    vehicle = await vehicle_service.get_vehicle(db, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    d = {c.key: getattr(vehicle, c.key) for c in vehicle.__table__.columns}
    d["expiry_alerts"] = vehicle_service.get_expiry_alerts(vehicle)
    return APIResponse(success=True, data=d)


@router.post("", response_model=APIResponse, status_code=201)
async def create_vehicle(
    data: VehicleCreate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_CREATE)),
):
    vehicle = await vehicle_service.create_vehicle(db, data.model_dump())
    return APIResponse(success=True, data={"id": vehicle.id, "registration_number": vehicle.registration_number}, message="Vehicle created")


@router.put("/{vehicle_id}", response_model=APIResponse)
async def update_vehicle(
    vehicle_id: int, data: VehicleUpdate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    vehicle = await vehicle_service.update_vehicle(db, vehicle_id, data.model_dump(exclude_unset=True))
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return APIResponse(success=True, message="Vehicle updated")


@router.delete("/{vehicle_id}", response_model=APIResponse)
async def delete_vehicle(
    vehicle_id: int, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_DELETE)),
):
    success = await vehicle_service.delete_vehicle(db, vehicle_id)
    if not success:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return APIResponse(success=True, message="Vehicle deleted")
