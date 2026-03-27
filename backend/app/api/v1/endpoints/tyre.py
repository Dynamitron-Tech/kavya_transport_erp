from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.db.postgres.connection import get_db
from app.middleware.permissions import Permissions, require_permission
from app.models.postgres.vehicle import Vehicle, VehicleTyre, TyreLifecycleEvent
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.tyre import TyreCreate, TyreEvent, TyreUpdate, TyreRetreadRequest

router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_tyres(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    vehicle_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    query = select(VehicleTyre, Vehicle.registration_number).join(Vehicle, Vehicle.id == VehicleTyre.vehicle_id)
    count_query = select(func.count(VehicleTyre.id))

    query = query.where(VehicleTyre.is_active == True)
    count_query = count_query.where(VehicleTyre.is_active == True)

    if vehicle_id:
        query = query.where(VehicleTyre.vehicle_id == vehicle_id)
        count_query = count_query.where(VehicleTyre.vehicle_id == vehicle_id)

    total = (await db.execute(count_query)).scalar() or 0
    offset = max(page - 1, 0) * limit
    result = await db.execute(query.order_by(VehicleTyre.id.desc()).offset(offset).limit(limit))

    items = []
    good_count = fair_count = replace_soon_count = critical_count = 0
    for tyre, reg_no in result.all():
        condition = str(tyre.condition or "good").lower()
        purchase_cost = float(tyre.purchase_cost or 0)
        current_km = float(tyre.current_km or 0)
        installed_km = float(tyre.km_at_fitment or 0)
        km_run = float(current_km - installed_km)
        # Estimate tread depth based on condition (mm)
        tread = 8.0 if condition == 'new' else (6.5 if condition == 'good' else (4.5 if condition == 'average' else 2.5))
        if condition in ('new', 'good'):
            good_count += 1
        elif condition == 'average':
            fair_count += 1
        elif condition == 'worn':
            replace_soon_count += 1
        else:
            critical_count += 1

        items.append({
            "id": tyre.id,
            "serial_number": tyre.tyre_number,
            "brand": tyre.brand,
            "model": tyre.size or "",
            "size": tyre.size,
            "purchase_date": tyre.purchase_date,
            "installed_date": (tyre.purchase_date.isoformat() if tyre.purchase_date else None),
            "cost": purchase_cost,
            "vehicle_id": tyre.vehicle_id,
            "vehicle_number": reg_no,
            "vehicle": reg_no,
            "axle_position": tyre.position,
            "position": tyre.position,
            "status": condition.upper(),
            "condition": condition,
            "total_km": current_km,
            "current_km": current_km,
            "installed_km": installed_km,
            "km_run": km_run,
            "tread_depth_mm": tread,
            "cost_per_km": float(purchase_cost / max(km_run, 1.0)) if km_run > 0 else 0,
            "retread_count": tyre.retread_count or 0,
            "max_retreads": tyre.max_retreads or 2,
            "retread_eligible": (tyre.retread_count or 0) < (tyre.max_retreads or 2),
            "total_retread_cost": float(tyre.total_retread_cost or 0),
        })

    pages = (total + limit - 1) // limit
    return APIResponse(success=True, data={
        "items": items,
        "summary": {
            "total_tyres": total,
            "good": good_count,
            "fair": fair_count,
            "replace_soon": replace_soon_count,
            "critical": critical_count,
        },
    }, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.post("", response_model=APIResponse, status_code=201)
async def create_tyre(
    data: TyreCreate,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    tyre = VehicleTyre(
        vehicle_id=data.vehicle_id,
        tyre_number=data.serial_number,
        position=data.axle_position,
        brand=data.brand,
        size=data.size,
        purchase_date=data.purchase_date,
        purchase_cost=data.cost or 0,
        condition=str(data.status).lower(),
        is_active=True,
    )
    db.add(tyre)
    await db.commit()
    await db.refresh(tyre)
    return APIResponse(success=True, data={"id": tyre.id}, message="Tyre created")


@router.put("/{tyre_id}", response_model=APIResponse)
async def update_tyre(
    tyre_id: int,
    data: TyreUpdate,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    tyre = await db.get(VehicleTyre, tyre_id)
    if not tyre or not tyre.is_active:
        raise HTTPException(status_code=404, detail="Tyre not found")

    payload = data.model_dump(exclude_unset=True)
    field_map = {
        "serial_number": "tyre_number",
        "axle_position": "position",
        "cost": "purchase_cost",
        "status": "condition",
    }
    for key, value in payload.items():
        attr = field_map.get(key, key)
        if attr == "condition" and value is not None:
            value = str(value).lower()
        setattr(tyre, attr, value)

    await db.commit()
    return APIResponse(success=True, message="Tyre updated")


@router.delete("/{tyre_id}", response_model=APIResponse)
async def delete_tyre(
    tyre_id: int,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    tyre = await db.get(VehicleTyre, tyre_id)
    if not tyre or not tyre.is_active:
        raise HTTPException(status_code=404, detail="Tyre not found")
    tyre.is_active = False
    await db.commit()
    return APIResponse(success=True, message="Tyre deleted")


@router.post("/{tyre_id}/event", response_model=APIResponse)
async def log_tyre_event(
    tyre_id: int,
    data: TyreEvent,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    tyre = await db.get(VehicleTyre, tyre_id)
    if not tyre or not tyre.is_active:
        raise HTTPException(status_code=404, detail="Tyre not found")

    tyre.current_km = data.odometer
    event = str(data.event_type).upper()
    if event == "REMOVED":
        tyre.condition = "removed"
    elif event in ("SCRAPPED", "SCRAP"):
        tyre.condition = "scrapped"
        tyre.is_active = False
    elif event in ("RETREADED", "RETREADING"):
        tyre.condition = "retreading"
    else:
        tyre.condition = "mounted"

    # Record lifecycle event
    lifecycle = TyreLifecycleEvent(
        vehicle_tyre_id=tyre_id,
        event_type=event,
        odometer_km=data.odometer,
        notes=data.reason,
        performed_by=current_user.user_id,
    )
    db.add(lifecycle)
    await db.commit()
    return APIResponse(success=True, data={"tyre_id": tyre_id, "event_type": event, "odometer": data.odometer, "reason": data.reason, "logged_at": datetime.utcnow().isoformat()}, message="Tyre event logged")


@router.post("/{tyre_id}/retread", response_model=APIResponse)
async def retread_tyre(
    tyre_id: int,
    data: TyreRetreadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    """Record a tyre retread. Validates retread eligibility."""
    tyre = await db.get(VehicleTyre, tyre_id)
    if not tyre or not tyre.is_active:
        raise HTTPException(status_code=404, detail="Tyre not found")

    current_retreads = tyre.retread_count or 0
    max_allowed = tyre.max_retreads or 2
    if current_retreads >= max_allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Tyre has reached maximum retreads ({max_allowed}). Must be scrapped.",
        )

    tyre.retread_count = current_retreads + 1
    tyre.last_retread_date = date.today()
    tyre.total_retread_cost = float(tyre.total_retread_cost or 0) + data.cost
    tyre.condition = "good"
    if data.odometer_km:
        tyre.current_km = data.odometer_km

    # Record lifecycle event
    lifecycle = TyreLifecycleEvent(
        vehicle_tyre_id=tyre_id,
        event_type="RETREAD",
        odometer_km=data.odometer_km,
        cost=data.cost,
        vendor_name=data.vendor_name,
        notes=data.notes,
        performed_by=current_user.user_id,
    )
    db.add(lifecycle)
    await db.commit()

    return APIResponse(
        success=True,
        data={
            "tyre_id": tyre_id,
            "retread_number": tyre.retread_count,
            "remaining_retreads": max_allowed - tyre.retread_count,
            "total_retread_cost": float(tyre.total_retread_cost),
        },
        message=f"Retread #{tyre.retread_count} recorded",
    )


@router.get("/{tyre_id}/history", response_model=APIResponse)
async def get_tyre_history(
    tyre_id: int,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Get full lifecycle history of a tyre."""
    tyre = await db.get(VehicleTyre, tyre_id)
    if not tyre:
        raise HTTPException(status_code=404, detail="Tyre not found")

    result = await db.execute(
        select(TyreLifecycleEvent)
        .where(TyreLifecycleEvent.vehicle_tyre_id == tyre_id)
        .order_by(TyreLifecycleEvent.created_at.desc())
    )
    events = result.scalars().all()

    return APIResponse(
        success=True,
        data={
            "tyre_id": tyre_id,
            "serial_number": tyre.tyre_number,
            "brand": tyre.brand,
            "retread_count": tyre.retread_count or 0,
            "events": [
                {
                    "id": e.id,
                    "event_type": e.event_type,
                    "odometer_km": float(e.odometer_km) if e.odometer_km else None,
                    "cost": float(e.cost) if e.cost else None,
                    "vendor_name": e.vendor_name,
                    "notes": e.notes,
                    "timestamp": e.created_at.isoformat() if e.created_at else None,
                }
                for e in events
            ],
        },
    )


@router.get("/analytics/cost-per-km", response_model=APIResponse)
async def tyre_cost_analytics(
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Fleet-wide tyre cost/km analytics: by brand, by vehicle, overall."""
    result = await db.execute(
        select(VehicleTyre, Vehicle.registration_number)
        .join(Vehicle, Vehicle.id == VehicleTyre.vehicle_id)
        .where(VehicleTyre.is_active == True)
    )
    tyres = result.all()

    brand_stats: dict = {}
    vehicle_stats: dict = {}
    fleet_total_cost = 0.0
    fleet_total_km = 0.0
    fleet_total_retread_cost = 0.0
    retread_eligible_count = 0
    retread_done_count = 0

    for tyre, reg_no in tyres:
        purchase_cost = float(tyre.purchase_cost or 0)
        retread_cost = float(tyre.total_retread_cost or 0)
        total_cost = purchase_cost + retread_cost
        km_run = float((tyre.current_km or 0) - (tyre.km_at_fitment or 0))
        if km_run < 0:
            km_run = 0
        cost_per_km = total_cost / max(km_run, 1.0) if km_run > 0 else 0

        fleet_total_cost += total_cost
        fleet_total_km += km_run
        fleet_total_retread_cost += retread_cost
        if (tyre.retread_count or 0) < (tyre.max_retreads or 2):
            retread_eligible_count += 1
        if (tyre.retread_count or 0) > 0:
            retread_done_count += 1

        # By brand
        brand = tyre.brand or "Unknown"
        if brand not in brand_stats:
            brand_stats[brand] = {"count": 0, "total_cost": 0, "total_km": 0, "retread_count": 0}
        brand_stats[brand]["count"] += 1
        brand_stats[brand]["total_cost"] += total_cost
        brand_stats[brand]["total_km"] += km_run
        brand_stats[brand]["retread_count"] += (tyre.retread_count or 0)

        # By vehicle
        if reg_no not in vehicle_stats:
            vehicle_stats[reg_no] = {"count": 0, "total_cost": 0, "total_km": 0}
        vehicle_stats[reg_no]["count"] += 1
        vehicle_stats[reg_no]["total_cost"] += total_cost
        vehicle_stats[reg_no]["total_km"] += km_run

    # Format brand analytics
    brand_list = []
    for brand, stats in brand_stats.items():
        cpk = stats["total_cost"] / max(stats["total_km"], 1.0) if stats["total_km"] > 0 else 0
        brand_list.append({
            "brand": brand,
            "tyre_count": stats["count"],
            "total_cost": round(stats["total_cost"], 2),
            "total_km": round(stats["total_km"]),
            "cost_per_km": round(cpk, 4),
            "avg_retreads": round(stats["retread_count"] / max(stats["count"], 1), 1),
        })
    brand_list.sort(key=lambda x: x["cost_per_km"])

    # Format vehicle analytics
    vehicle_list = []
    for reg, stats in vehicle_stats.items():
        cpk = stats["total_cost"] / max(stats["total_km"], 1.0) if stats["total_km"] > 0 else 0
        vehicle_list.append({
            "vehicle": reg,
            "tyre_count": stats["count"],
            "total_cost": round(stats["total_cost"], 2),
            "total_km": round(stats["total_km"]),
            "cost_per_km": round(cpk, 4),
        })
    vehicle_list.sort(key=lambda x: x["cost_per_km"])

    fleet_cpk = fleet_total_cost / max(fleet_total_km, 1.0) if fleet_total_km > 0 else 0

    return APIResponse(
        success=True,
        data={
            "fleet_summary": {
                "total_tyres": len(tyres),
                "total_cost": round(fleet_total_cost, 2),
                "total_retread_cost": round(fleet_total_retread_cost, 2),
                "total_km": round(fleet_total_km),
                "cost_per_km": round(fleet_cpk, 4),
                "retread_eligible": retread_eligible_count,
                "retreaded_tyres": retread_done_count,
            },
            "by_brand": brand_list,
            "by_vehicle": vehicle_list,
        },
    )
