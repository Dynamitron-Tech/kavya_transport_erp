# Fleet Manager Endpoints
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse, PaginationMeta
from app.services import dashboard_service, vehicle_service, trip_service

router = APIRouter()


@router.get("/dashboard", response_model=APIResponse)
async def fleet_dashboard(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    data = await dashboard_service.get_fleet_manager_dashboard(db)
    return APIResponse(success=True, data=data)


@router.get("/vehicles", response_model=APIResponse)
async def fleet_vehicles(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None, status: Optional[str] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
):
    vehicles, total = await vehicle_service.list_vehicles(db, page, limit, search, status)
    pages = (total + limit - 1) // limit
    items = []
    for v in vehicles:
        d = {c.key: getattr(v, c.key) for c in v.__table__.columns}
        d["expiry_alerts"] = vehicle_service.get_expiry_alerts(v)
        items.append(d)
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/trips", response_model=APIResponse)
async def fleet_trips(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
):
    trips, total = await trip_service.list_trips(db, page, limit, status=status)
    pages = (total + limit - 1) // limit
    items = []
    for trip in trips:
        items.append(await trip_service.get_trip_with_details(db, trip))
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
