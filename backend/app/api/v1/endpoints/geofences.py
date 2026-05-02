# Geofence API Endpoints
# Transport ERP — Phase B

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.postgres.connection import get_db
from app.core.security import get_current_user
from app.services import geofence_service
from app.schemas.geofence import GeofenceCreate, GeofenceUpdate, GeofenceCheckRequest

router = APIRouter()


@router.get("")
async def list_geofences(
    trip_id: Optional[int] = Query(None),
    route_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    geofences = await geofence_service.list_geofences(
        db,
        tenant_id=current_user.tenant_id,
        trip_id=trip_id,
        route_id=route_id,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )
    return {"success": True, "data": geofences}


@router.get("/{geofence_id}")
async def get_geofence(
    geofence_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    gf = await geofence_service.get_geofence(db, geofence_id)
    if not gf:
        raise HTTPException(status_code=404, detail="Geofence not found")
    return {"success": True, "data": gf}


@router.post("")
async def create_geofence(
    payload: GeofenceCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    data = payload.dict(exclude_unset=True)
    gf = await geofence_service.create_geofence(
        db, data,
        tenant_id=current_user.tenant_id,
        branch_id=getattr(current_user, "branch_id", None),
    )
    return {"success": True, "data": gf, "message": "Geofence created"}


@router.put("/{geofence_id}")
async def update_geofence(
    geofence_id: int,
    payload: GeofenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    data = payload.dict(exclude_unset=True)
    gf = await geofence_service.update_geofence(db, geofence_id, data)
    if not gf:
        raise HTTPException(status_code=404, detail="Geofence not found")
    return {"success": True, "data": gf, "message": "Geofence updated"}


@router.delete("/{geofence_id}")
async def delete_geofence(
    geofence_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ok = await geofence_service.delete_geofence(db, geofence_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Geofence not found")
    return {"success": True, "message": "Geofence deactivated"}


@router.post("/check")
async def check_position(
    payload: GeofenceCheckRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    breaches = await geofence_service.check_position(
        db, payload.lat, payload.lng,
        vehicle_id=payload.vehicle_id,
        tenant_id=current_user.tenant_id,
    )
    return {"success": True, "data": {"breaches": breaches, "total": len(breaches)}}


@router.get("/trip/{trip_id}")
async def get_trip_geofences(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    geofences = await geofence_service.get_trip_geofences(db, trip_id)
    return {"success": True, "data": geofences}
