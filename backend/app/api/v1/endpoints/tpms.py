# TPMS API Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional

from app.db.postgres.connection import get_db
from app.core.security import get_current_user, TokenData
from app.services import tpms_service

router = APIRouter()


class SensorReadingIn(BaseModel):
    sensor_id: str = Field(..., min_length=1, max_length=50)
    psi: float = Field(..., gt=0, lt=200)
    temperature_c: Optional[float] = Field(None, ge=-40, le=150)
    tread_depth_mm: Optional[float] = Field(None, ge=0, le=30)


@router.post("/reading")
async def ingest_reading(
    payload: SensorReadingIn,
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(get_current_user),
):
    """Ingest TPMS sensor reading (from BLE/GPRS gateway)."""
    result = await tpms_service.ingest_reading(
        db,
        sensor_id=payload.sensor_id,
        psi=payload.psi,
        temperature_c=payload.temperature_c,
        tread_depth_mm=payload.tread_depth_mm,
    )
    if not result:
        raise HTTPException(status_code=404, detail="No active tyre found for this sensor_id")
    return {"success": True, "data": result}


@router.get("/vehicle/{vehicle_id}")
async def get_tyre_dashboard(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(get_current_user),
):
    """Per-wheel live TPMS data for a vehicle."""
    data = await tpms_service.get_tyre_dashboard(db, vehicle_id)
    return {"success": True, "data": data}


@router.get("/fleet")
async def get_fleet_tyre_health(
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(get_current_user),
):
    """Fleet-wide tyre health overview."""
    data = await tpms_service.get_fleet_tyre_health(db, tenant_id=user.tenant_id)
    return {"success": True, "data": data}


@router.get("/alerts")
async def get_tpms_alerts(
    hours: int = Query(24, ge=1, le=720),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(get_current_user),
):
    """Active TPMS alerts in last N hours."""
    data = await tpms_service.get_tpms_alerts(
        db, tenant_id=user.tenant_id, hours=hours, limit=limit,
    )
    return {"success": True, "data": data}


@router.get("/history/{tyre_id}")
async def get_reading_history(
    tyre_id: int,
    hours: int = Query(168, ge=1, le=720),
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(get_current_user),
):
    """Historical TPMS readings for a single tyre (for charts)."""
    data = await tpms_service.get_reading_history(db, tyre_id, hours=hours)
    return {"success": True, "data": data}


@router.get("/predict/{vehicle_id}")
async def predict_next_service(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(get_current_user),
):
    """Predict next maintenance for a vehicle based on history."""
    data = await tpms_service.predict_next_service(db, vehicle_id)
    if not data:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"success": True, "data": data}


@router.get("/predict-fleet")
async def get_fleet_predictions(
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(get_current_user),
):
    """Fleet-wide predicted upcoming maintenance."""
    data = await tpms_service.get_fleet_maintenance_predictions(db, tenant_id=user.tenant_id)
    return {"success": True, "data": data}


@router.get("/tyre-replacement/{vehicle_id}")
async def predict_tyre_replacement(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    user: TokenData = Depends(get_current_user),
):
    """Predict tyre replacement dates based on tread wear rate from TPMS data."""
    data = await tpms_service.predict_tyre_replacement(db, vehicle_id)
    return {"success": True, "data": data}
