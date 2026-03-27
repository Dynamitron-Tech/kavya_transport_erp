# Fleet Manager Endpoints
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from decimal import Decimal
from datetime import date, datetime
import enum

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse, PaginationMeta
from app.services import dashboard_service, vehicle_service, trip_service

router = APIRouter()


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
