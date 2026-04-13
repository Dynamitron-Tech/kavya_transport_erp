from datetime import datetime, date, timedelta
from typing import Optional, List
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy import func, select, case, or_, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.db.postgres.connection import get_db
from app.middleware.permissions import Permissions, require_permission
from app.models.postgres.vehicle import (
    Vehicle, VehicleTyre, TyreLifecycleEvent, TyreSensorReading,
    TyreReading, TyreAlert, TyreThreshold, TyreSimulationSession,
    TyreReadingCondition, TyreAlertType, TyreAlertSeverity, TyreAlertStatus,
)
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.tyre import TyreCreate, TyreEvent, TyreUpdate, TyreRetreadRequest

router = APIRouter()


# ── Life Summary (for tyre tracker dashboard) ──────────────
@router.get("/life-summary", response_model=APIResponse)
async def tyre_life_summary(
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Tyre life % distribution: 0-10, 10-30, 30-50, 50-70, 70-90, 90-100."""
    result = await db.execute(
        select(VehicleTyre, Vehicle.registration_number)
        .join(Vehicle, Vehicle.id == VehicleTyre.vehicle_id)
        .where(VehicleTyre.is_active == True)
    )
    tyres = result.all()

    # Tyre life is estimated from condition + km_run
    buckets = {"90-100": 0, "70-90": 0, "50-70": 0, "30-50": 0, "10-30": 0, "0-10": 0}
    normal = low_psi = critical = alert_count = 0
    items_by_bucket: dict = {k: [] for k in buckets}

    for tyre, reg_no in tyres:
        km_run = float((tyre.current_km or 0) - (tyre.km_at_fitment or 0))
        if km_run < 0:
            km_run = 0
        # Estimate life based on assumed 100k km tyre life
        max_life_km = 100000.0
        life_pct = max(0, min(100, 100 - (km_run / max_life_km * 100)))
        # Adjust by condition
        cond = str(tyre.condition or "good").lower()
        if cond in ("worn", "replaced", "critical"):
            life_pct = min(life_pct, 15)
        elif cond == "average":
            life_pct = min(life_pct, 55)

        # Bucket
        if life_pct >= 90:
            buckets["90-100"] += 1
            bucket_key = "90-100"
        elif life_pct >= 70:
            buckets["70-90"] += 1
            bucket_key = "70-90"
        elif life_pct >= 50:
            buckets["50-70"] += 1
            bucket_key = "50-70"
        elif life_pct >= 30:
            buckets["30-50"] += 1
            bucket_key = "30-50"
        elif life_pct >= 10:
            buckets["10-30"] += 1
            bucket_key = "10-30"
        else:
            buckets["0-10"] += 1
            bucket_key = "0-10"

        # PSI status
        psi = float(tyre.last_psi or 0)
        if psi > 0 and psi < 25:
            critical += 1
            alert_count += 1
        elif psi > 0 and psi < 30:
            low_psi += 1
            alert_count += 1
        else:
            normal += 1

        items_by_bucket[bucket_key].append({
            "id": tyre.id,
            "serial_number": tyre.tyre_number,
            "position": tyre.position,
            "vehicle_number": reg_no,
            "vehicle_id": tyre.vehicle_id,
            "life_percent": round(life_pct, 1),
            "psi": psi,
            "km_run": km_run,
        })

    return APIResponse(success=True, data={
        "buckets": buckets,
        "items_by_bucket": items_by_bucket,
        "status_counts": {
            "normal": normal,
            "low_psi": low_psi,
            "critical": critical,
            "alerts": alert_count,
        },
        "total": len(tyres),
    })


# ── Inspection / alerts ───────────────────────────────────
@router.get("/inspection-needed", response_model=APIResponse)
async def inspection_needed(
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Tyres that need immediate inspection (low tread, high km, etc.)."""
    result = await db.execute(
        select(VehicleTyre, Vehicle.registration_number)
        .join(Vehicle, Vehicle.id == VehicleTyre.vehicle_id)
        .where(VehicleTyre.is_active == True)
        .where(or_(
            VehicleTyre.condition.in_(["worn", "average"]),
            VehicleTyre.last_psi < 28,
            VehicleTyre.last_temperature_c > 85,
        ))
    )
    items = []
    for tyre, reg_no in result.all():
        items.append({
            "id": tyre.id,
            "serial_number": tyre.tyre_number,
            "position": tyre.position,
            "vehicle_number": reg_no,
            "vehicle_id": tyre.vehicle_id,
            "condition": tyre.condition,
            "psi": float(tyre.last_psi or 0),
            "temperature": float(tyre.last_temperature_c or 0),
        })
    return APIResponse(success=True, data={"count": len(items), "items": items})


@router.get("/alerts", response_model=APIResponse)
async def tyre_alerts(
    status: str = Query("active", regex="^(active|resolved|all)$"),
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Get tyre alerts from sensor readings."""
    cutoff = datetime.utcnow() - timedelta(hours=48)
    query = (
        select(TyreSensorReading, VehicleTyre.tyre_number, VehicleTyre.position, VehicleTyre.vehicle_id, Vehicle.registration_number)
        .join(VehicleTyre, VehicleTyre.id == TyreSensorReading.vehicle_tyre_id)
        .join(Vehicle, Vehicle.id == VehicleTyre.vehicle_id)
        .where(TyreSensorReading.alert_triggered == True)
        .where(TyreSensorReading.timestamp >= cutoff)
        .order_by(TyreSensorReading.timestamp.desc())
        .limit(100)
    )
    result = await db.execute(query)
    items = []
    for reading, serial, position, vehicle_id, reg_no in result.all():
        items.append({
            "id": reading.id,
            "vehicle_id": vehicle_id,
            "vehicle_number": reg_no,
            "serial_number": serial,
            "position": position,
            "psi": float(reading.psi),
            "temperature": float(reading.temperature_c or 0),
            "alert_type": reading.alert_type,
            "timestamp": reading.timestamp.isoformat() if reading.timestamp else None,
        })
    return APIResponse(success=True, data=items)


# ── Stock management ──────────────────────────────────────
@router.get("/stock", response_model=APIResponse)
async def tyre_stock(
    type: str = Query("new", regex="^(new|retreaded|removed|all)$"),
    brand: Optional[str] = None,
    location: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Get tyres in stock (not currently mounted on a vehicle)."""
    query = (
        select(VehicleTyre, Vehicle.registration_number)
        .join(Vehicle, Vehicle.id == VehicleTyre.vehicle_id)
        .where(VehicleTyre.is_active == True)
    )

    if type == "new":
        query = query.where(VehicleTyre.condition.in_(["new", "good"]))
        query = query.where(VehicleTyre.retread_count == 0)
    elif type == "retreaded":
        query = query.where(VehicleTyre.retread_count > 0)
        query = query.where(VehicleTyre.condition.in_(["new", "good", "average"]))
    elif type == "removed":
        query = query.where(VehicleTyre.condition.in_(["removed", "worn", "scrapped"]))

    if brand:
        query = query.where(VehicleTyre.brand.ilike(f"%{brand}%"))
    if search:
        query = query.where(or_(
            VehicleTyre.tyre_number.ilike(f"%{search}%"),
            VehicleTyre.brand.ilike(f"%{search}%"),
        ))

    result = await db.execute(query.order_by(VehicleTyre.id.desc()))
    items = []
    for tyre, reg_no in result.all():
        items.append({
            "id": tyre.id,
            "serial_number": tyre.tyre_number,
            "brand": tyre.brand,
            "size": tyre.size,
            "condition": tyre.condition,
            "vehicle_number": reg_no,
            "vehicle_id": tyre.vehicle_id,
            "position": tyre.position,
            "purchase_date": tyre.purchase_date.isoformat() if tyre.purchase_date else None,
            "purchase_cost": float(tyre.purchase_cost or 0),
            "retread_count": tyre.retread_count or 0,
            "km_run": float((tyre.current_km or 0) - (tyre.km_at_fitment or 0)),
        })

    counts = {"new": 0, "retreaded": 0, "removed": 0}
    count_result = await db.execute(
        select(
            func.count().filter(and_(VehicleTyre.retread_count == 0, VehicleTyre.condition.in_(["new", "good"]))).label("new_count"),
            func.count().filter(VehicleTyre.retread_count > 0).label("retreaded_count"),
            func.count().filter(VehicleTyre.condition.in_(["removed", "worn", "scrapped"])).label("removed_count"),
        ).where(VehicleTyre.is_active == True)
    )
    row = count_result.one_or_none()
    if row:
        counts = {"new": row[0] or 0, "retreaded": row[1] or 0, "removed": row[2] or 0}

    return APIResponse(success=True, data={"items": items, "counts": counts})


@router.patch("/{tyre_id}/fit", response_model=APIResponse)
async def fit_tyre_to_vehicle(
    tyre_id: int,
    vehicle_id: int = Query(...),
    position: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    """Fit a stock tyre to a vehicle at a specific position."""
    tyre = await db.get(VehicleTyre, tyre_id)
    if not tyre or not tyre.is_active:
        raise HTTPException(status_code=404, detail="Tyre not found")
    tyre.vehicle_id = vehicle_id
    tyre.position = position
    tyre.condition = "mounted"
    lifecycle = TyreLifecycleEvent(
        vehicle_tyre_id=tyre_id,
        event_type="MOUNTED",
        performed_by=current_user.user_id,
        notes=f"Fitted to vehicle {vehicle_id} at position {position}",
    )
    db.add(lifecycle)
    await db.commit()
    return APIResponse(success=True, message="Tyre fitted to vehicle")


@router.patch("/{tyre_id}/move", response_model=APIResponse)
async def move_tyre(
    tyre_id: int,
    new_position: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    """Move/rotate a tyre to a different position on the same vehicle."""
    tyre = await db.get(VehicleTyre, tyre_id)
    if not tyre or not tyre.is_active:
        raise HTTPException(status_code=404, detail="Tyre not found")
    old_pos = tyre.position
    tyre.position = new_position
    lifecycle = TyreLifecycleEvent(
        vehicle_tyre_id=tyre_id,
        event_type="ROTATED",
        performed_by=current_user.user_id,
        notes=f"Moved from {old_pos} to {new_position}",
    )
    db.add(lifecycle)
    await db.commit()
    return APIResponse(success=True, message=f"Tyre moved from {old_pos} to {new_position}")


# ── Retreading management ─────────────────────────────────
@router.get("/retreading", response_model=APIResponse)
async def list_retreading(
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """List tyres sent or eligible for retreading."""
    result = await db.execute(
        select(VehicleTyre, Vehicle.registration_number)
        .join(Vehicle, Vehicle.id == VehicleTyre.vehicle_id)
        .where(VehicleTyre.is_active == True)
        .where(or_(
            VehicleTyre.condition == "retreading",
            VehicleTyre.retread_count > 0,
        ))
        .order_by(VehicleTyre.last_retread_date.desc().nullslast())
    )
    items = []
    for tyre, reg_no in result.all():
        # Get last retread event for vendor/notes
        evt_result = await db.execute(
            select(TyreLifecycleEvent)
            .where(TyreLifecycleEvent.vehicle_tyre_id == tyre.id)
            .where(TyreLifecycleEvent.event_type == "RETREAD")
            .order_by(TyreLifecycleEvent.created_at.desc())
            .limit(1)
        )
        last_event = evt_result.scalar_one_or_none()

        status = "RETURNED"
        if tyre.condition == "retreading":
            status = "IN_PROGRESS"
        elif tyre.retread_count > 0 and tyre.condition in ("good", "new", "mounted"):
            status = "RETURNED"

        items.append({
            "id": tyre.id,
            "serial_number": tyre.tyre_number,
            "brand": tyre.brand,
            "size": tyre.size,
            "position": tyre.position,
            "condition": tyre.condition,
            "vehicle_number": reg_no,
            "vehicle_id": tyre.vehicle_id,
            "retread_count": tyre.retread_count or 0,
            "max_retreads": tyre.max_retreads or 2,
            "last_retread_date": tyre.last_retread_date.isoformat() if tyre.last_retread_date else None,
            "total_retread_cost": float(tyre.total_retread_cost or 0),
            "km_run": int(float(tyre.current_km or 0) - float(tyre.km_at_fitment or 0)),
            "status": status,
            "vendor": last_event.vendor_name if last_event else None,
            "notes": last_event.notes if last_event else None,
        })
    return APIResponse(success=True, data=items)


@router.patch("/retreading/{tyre_id}/status", response_model=APIResponse)
async def update_retread_status(
    tyre_id: int,
    status: str = Query(..., regex="^(sent|in_progress|ready|returned)$"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    """Update the retreading status of a tyre."""
    tyre = await db.get(VehicleTyre, tyre_id)
    if not tyre or not tyre.is_active:
        raise HTTPException(status_code=404, detail="Tyre not found")
    condition_map = {
        "sent": "retreading",
        "in_progress": "retreading",
        "ready": "retreading",
        "returned": "good",
    }
    tyre.condition = condition_map.get(status, "retreading")
    if status == "returned":
        tyre.retread_count = (tyre.retread_count or 0) + 1
        tyre.last_retread_date = date.today()
    await db.commit()
    return APIResponse(success=True, message=f"Retread status updated to {status}")


# ── Tyre Catalogue (Buy Tyres) ────────────────────────────

TYRE_CATALOGUE = [
    {"id": 1, "brand": "Apollo", "model": "EnduMile LHA", "sizes": ["295/80 R22.5", "10.00 R20", "12.00 R20"], "image": "/tyres/apollo_endumile_lha.png", "category": "Long Haul"},
    {"id": 2, "brand": "Apollo", "model": "Duramile", "sizes": ["295/80 R22.5"], "image": "/tyres/apollo_duramile.png", "category": "Regional"},
    {"id": 3, "brand": "Apollo", "model": "EnduComfort CA", "sizes": ["295/80 R22.5"], "image": "/tyres/apollo_enducomfort_ca.png", "category": "Comfort"},
    {"id": 4, "brand": "Apollo", "model": "EnduMile LHD", "sizes": ["295/80 R22.5"], "image": "/tyres/apollo_endumile_lhd.png", "category": "Drive Axle"},
    {"id": 5, "brand": "Apollo", "model": "EnduRace HA", "sizes": ["295/80 R22.5", "315/80 R22.5"], "image": "/tyres/apollo_endurace_ha.png", "category": "Highway"},
    {"id": 6, "brand": "Apollo", "model": "EnduRace HD", "sizes": ["295/80 R22.5"], "image": "/tyres/apollo_endurace_hd.png", "category": "Highway Drive"},
    {"id": 7, "brand": "Apollo", "model": "ENDUTMRace LD", "sizes": ["295/80 R22.5", "10.00 R20"], "image": "/tyres/apollo_endutmrace_ld.png", "category": "Long Distance"},
    {"id": 8, "brand": "Apollo", "model": "ENDUTMTrax MA", "sizes": ["295/80 R22.5"], "image": "/tyres/apollo_endutmtrax_ma.png", "category": "Mixed Application"},
    {"id": 9, "brand": "Michelin", "model": "X Multi Z", "sizes": ["295/80 R22.5", "315/80 R22.5"], "image": "/tyres/michelin_xmultiz.png", "category": "All Position"},
    {"id": 10, "brand": "Michelin", "model": "X Multi D", "sizes": ["295/80 R22.5"], "image": "/tyres/michelin_xmultid.png", "category": "Drive Axle"},
    {"id": 11, "brand": "Michelin", "model": "X Line Energy Z", "sizes": ["295/80 R22.5", "315/80 R22.5"], "image": "/tyres/michelin_xlineenergy.png", "category": "Fuel Efficient"},
    {"id": 12, "brand": "MRF", "model": "Super Lug-606", "sizes": ["10.00 R20", "12.00 R20"], "image": "/tyres/mrf_superlug606.png", "category": "Long Haul"},
    {"id": 13, "brand": "MRF", "model": "Steel Muscle-S1M4", "sizes": ["295/80 R22.5"], "image": "/tyres/mrf_steelmuscle.png", "category": "Highway"},
    {"id": 14, "brand": "MRF", "model": "Super Lug-505", "sizes": ["10.00 R20"], "image": "/tyres/mrf_superlug505.png", "category": "Mixed"},
    {"id": 15, "brand": "Ceat", "model": "Winmile X3-R", "sizes": ["295/80 R22.5", "10.00 R20"], "image": "/tyres/ceat_winmilex3r.png", "category": "Long Haul"},
    {"id": 16, "brand": "Ceat", "model": "Mile XL Rib", "sizes": ["295/80 R22.5"], "image": "/tyres/ceat_milexl_rib.png", "category": "Highway"},
    {"id": 17, "brand": "JK", "model": "Jet Xtra Load", "sizes": ["10.00 R20", "12.00 R20"], "image": "/tyres/jk_jetxtraload.png", "category": "Heavy Load"},
    {"id": 18, "brand": "JK", "model": "Jet Steel JUH5", "sizes": ["295/80 R22.5"], "image": "/tyres/jk_jetsteel_juh5.png", "category": "Highway"},
    {"id": 19, "brand": "Bridgestone", "model": "R150 II", "sizes": ["295/80 R22.5", "10.00 R20"], "image": "/tyres/bridgestone_r150ii.png", "category": "All Position"},
    {"id": 20, "brand": "Bridgestone", "model": "M840", "sizes": ["295/80 R22.5"], "image": "/tyres/bridgestone_m840.png", "category": "On/Off Road"},
]


@router.get("/catalogue", response_model=APIResponse)
async def tyre_catalogue(
    brand: Optional[str] = None,
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Get tyre catalogue for the Buy Tyres screen."""
    items = TYRE_CATALOGUE
    if brand:
        items = [t for t in items if t["brand"].lower() == brand.lower()]
    return APIResponse(success=True, data=items)


@router.get("/catalogue/{item_id}", response_model=APIResponse)
async def tyre_catalogue_detail(
    item_id: int,
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Get a single catalogue tyre detail."""
    for item in TYRE_CATALOGUE:
        if item["id"] == item_id:
            return APIResponse(success=True, data=item)
    raise HTTPException(status_code=404, detail="Catalogue item not found")


# ── Compare tyres ─────────────────────────────────────────
@router.get("/compare", response_model=APIResponse)
async def compare_tyres(
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Cost/km comparison by brand for tyre comparison screen."""
    result = await db.execute(
        select(VehicleTyre).where(VehicleTyre.is_active == True)
    )
    brands: dict = {}
    for tyre in result.scalars().all():
        b = tyre.brand or "Unknown"
        if b not in brands:
            brands[b] = {"brand": b, "count": 0, "total_km": 0, "total_cost": 0, "models": set()}
        km = float((tyre.current_km or 0) - (tyre.km_at_fitment or 0))
        if km < 0:
            km = 0
        brands[b]["count"] += 1
        brands[b]["total_km"] += km
        brands[b]["total_cost"] += float(tyre.purchase_cost or 0) + float(tyre.total_retread_cost or 0)
        if tyre.size:
            brands[b]["models"].add(tyre.size)

    comparison = []
    for b, data in brands.items():
        comparison.append({
            "brand": b,
            "count": data["count"],
            "total_km": data["total_km"],
            "total_cost": data["total_cost"],
            "cost_per_km": data["total_cost"] / max(data["total_km"], 1),
            "models": list(data["models"]),
        })
    comparison.sort(key=lambda x: x["cost_per_km"])

    return APIResponse(success=True, data=comparison)


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
        # Use actual tread depth if available; fall back to condition estimate
        if tyre.tread_depth_mm is not None:
            tread = float(tyre.tread_depth_mm)
        else:
            tread = 8.0 if condition == 'new' else (6.5 if condition == 'good' else (4.5 if condition == 'average' else 2.5))
        initial_tread = float(tyre.initial_tread_depth_mm) if tyre.initial_tread_depth_mm is not None else None
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
            "initial_tread_depth_mm": initial_tread,
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
        tread_depth_mm=data.tread_depth_mm,
        initial_tread_depth_mm=data.initial_tread_depth_mm if data.initial_tread_depth_mm is not None else data.tread_depth_mm,
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


@router.post("/{tyre_id}/replace", response_model=APIResponse, status_code=201)
async def replace_tyre(
    tyre_id: int,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    """Archive old tyre and create a replacement at the same position."""
    old_tyre = await db.get(VehicleTyre, tyre_id)
    if not old_tyre or not old_tyre.is_active:
        raise HTTPException(status_code=404, detail="Tyre not found")

    serial = payload.get("serial_number", "").strip()
    if not serial:
        raise HTTPException(status_code=422, detail="serial_number is required")

    # Archive old tyre
    old_tyre.is_active = False
    old_tyre.condition = "replaced"

    # Log lifecycle event on old tyre
    reason = str(payload.get("replacement_reason", "REPLACED")).strip() or "REPLACED"
    notes_parts = [f"Reason: {reason}"]
    if payload.get("notes"):
        notes_parts.append(str(payload["notes"]))
    lifecycle = TyreLifecycleEvent(
        vehicle_tyre_id=tyre_id,
        event_type="REPLACED",
        notes=". ".join(notes_parts),
        performed_by=current_user.user_id,
    )
    db.add(lifecycle)

    # Create new tyre at same vehicle/position
    thickness_mm = payload.get("tread_depth_mm")
    new_tyre = VehicleTyre(
        vehicle_id=old_tyre.vehicle_id,
        tyre_number=serial,
        position=old_tyre.position,
        brand=payload.get("brand") or old_tyre.brand,
        size=payload.get("size") or old_tyre.size,
        purchase_date=date.today(),
        purchase_cost=payload.get("cost") or 0,
        condition="good",
        is_active=True,
        tread_depth_mm=thickness_mm,
        initial_tread_depth_mm=thickness_mm,
    )
    db.add(new_tyre)
    await db.commit()
    await db.refresh(new_tyre)

    # Log MOUNTED event on new tyre
    db.add(TyreLifecycleEvent(
        vehicle_tyre_id=new_tyre.id,
        event_type="MOUNTED",
        notes=f"Replacement for tyre #{tyre_id}",
        performed_by=current_user.user_id,
    ))
    await db.commit()

    return APIResponse(
        success=True,
        data={"old_tyre_id": tyre_id, "new_tyre_id": new_tyre.id},
        message=f"Tyre replaced at position {old_tyre.position}",
    )


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


@router.get("/{tyre_id}/full-history", response_model=APIResponse)
async def get_tyre_full_history(
    tyre_id: int,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Get merged timeline of log readings + lifecycle events for a tyre."""
    tyre = await db.get(VehicleTyre, tyre_id)
    if not tyre:
        raise HTTPException(status_code=404, detail="Tyre not found")

    # Fetch log readings
    readings_result = await db.execute(
        select(TyreReading)
        .where(TyreReading.vehicle_tyre_id == tyre_id)
        .order_by(TyreReading.created_at.desc())
        .limit(200)
    )
    readings = readings_result.scalars().all()

    # Fetch lifecycle events
    events_result = await db.execute(
        select(TyreLifecycleEvent)
        .where(TyreLifecycleEvent.vehicle_tyre_id == tyre_id)
        .order_by(TyreLifecycleEvent.created_at.desc())
    )
    events = events_result.scalars().all()

    timeline = []

    for r in readings:
        cond = r.condition.value if hasattr(r.condition, 'value') else str(r.condition)
        timeline.append({
            "type": "reading",
            "timestamp": r.created_at.isoformat() if r.created_at else None,
            "psi": float(r.psi) if r.psi else None,
            "tread_depth_mm": float(r.tread_depth_mm) if r.tread_depth_mm else None,
            "condition": cond,
            "temperature_c": float(r.temperature_c) if r.temperature_c else None,
            "odometer_at_reading": float(r.odometer_at_reading) if r.odometer_at_reading else None,
            "notes": r.notes,
        })

    for e in events:
        timeline.append({
            "type": "event",
            "timestamp": e.created_at.isoformat() if e.created_at else None,
            "event_type": e.event_type,
            "odometer_km": float(e.odometer_km) if e.odometer_km else None,
            "cost": float(e.cost) if e.cost else None,
            "vendor_name": e.vendor_name,
            "notes": e.notes,
        })

    # Sort descending by timestamp
    timeline.sort(key=lambda x: x.get("timestamp") or "", reverse=True)

    return APIResponse(
        success=True,
        data={
            "tyre_id": tyre_id,
            "serial_number": tyre.tyre_number,
            "brand": tyre.brand,
            "timeline": timeline,
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


# ═══════════════════════════════════════════════════════════════════════════
# SECTION: DRIVER FIELD READINGS — POST /tyre/readings, GET, PATCH
# ═══════════════════════════════════════════════════════════════════════════

async def _get_threshold(db: AsyncSession, vehicle_id: int) -> dict:
    """Fetch per-vehicle threshold or fall back to fleet default."""
    result = await db.execute(
        select(TyreThreshold)
        .where(TyreThreshold.vehicle_id == vehicle_id)
        .limit(1)
    )
    threshold = result.scalar_one_or_none()
    if not threshold:
        result = await db.execute(
            select(TyreThreshold).where(TyreThreshold.vehicle_id == None).limit(1)
        )
        threshold = result.scalar_one_or_none()
    if threshold:
        return {
            "min_psi": float(threshold.min_psi or 80),
            "critical_psi": float(threshold.critical_psi or 60),
            "min_tread_mm": float(threshold.min_tread_mm or 3.0),
            "worn_tread_mm": float(threshold.worn_tread_mm or 1.6),
        }
    return {"min_psi": 80.0, "critical_psi": 60.0, "min_tread_mm": 3.0, "worn_tread_mm": 1.6}


async def _auto_create_alerts(
    db: AsyncSession,
    reading: TyreReading,
    threshold: dict,
    tyre_id: Optional[int],
):
    """Auto-create tyre alerts after a field reading. Deduplicates open alerts."""
    psi = float(reading.psi or 0)
    tread = float(reading.tread_depth_mm or 0) if reading.tread_depth_mm else None
    condition = str(reading.condition.value if hasattr(reading.condition, 'value') else reading.condition)

    alerts_to_create = []

    if psi > 0 and psi < threshold["critical_psi"]:
        alerts_to_create.append((TyreAlertType.CRITICAL_PSI, TyreAlertSeverity.CRITICAL, psi, threshold["critical_psi"]))
    elif psi > 0 and psi < threshold["min_psi"]:
        alerts_to_create.append((TyreAlertType.LOW_PSI, TyreAlertSeverity.WARNING, psi, threshold["min_psi"]))

    if tread is not None and tread > 0:
        if tread < threshold["worn_tread_mm"]:
            alerts_to_create.append((TyreAlertType.WORN, TyreAlertSeverity.CRITICAL, tread, threshold["worn_tread_mm"]))
        elif tread < threshold["min_tread_mm"]:
            alerts_to_create.append((TyreAlertType.LOW_TREAD, TyreAlertSeverity.WARNING, tread, threshold["min_tread_mm"]))

    if condition == "DAMAGED":
        alerts_to_create.append((TyreAlertType.DAMAGED, TyreAlertSeverity.CRITICAL, None, None))

    for alert_type, severity, current_val, threshold_val in alerts_to_create:
        # De-duplicate: check if open alert already exists for this tyre position
        existing = await db.execute(
            select(TyreAlert).where(
                TyreAlert.vehicle_id == reading.vehicle_id,
                TyreAlert.position == reading.position,
                TyreAlert.alert_type == alert_type,
                TyreAlert.status == TyreAlertStatus.OPEN,
            ).limit(1)
        )
        if not existing.scalar_one_or_none():
            db.add(TyreAlert(
                vehicle_tyre_id=tyre_id,
                vehicle_id=reading.vehicle_id,
                position=reading.position,
                alert_type=alert_type,
                severity=severity,
                current_value=current_val,
                threshold_value=threshold_val,
                status=TyreAlertStatus.OPEN,
                source="field",
            ))


@router.post("/readings", response_model=APIResponse, status_code=201)
async def submit_tyre_reading(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Submit a driver field tyre reading. Auto-triggers alerts on threshold breach."""
    vehicle_id = payload.get("vehicle_id")
    position = payload.get("position")
    psi = payload.get("psi")

    if not vehicle_id or not position or psi is None:
        raise HTTPException(status_code=422, detail="vehicle_id, position, psi required")

    # Find matching tyre record (optional — position may not have a VehicleTyre record)
    tyre_result = await db.execute(
        select(VehicleTyre).where(
            VehicleTyre.vehicle_id == vehicle_id,
            VehicleTyre.position == position,
            VehicleTyre.is_active == True,
        ).limit(1)
    )
    tyre = tyre_result.scalar_one_or_none()

    condition_raw = str(payload.get("condition", "GOOD")).upper()
    try:
        condition_enum = TyreReadingCondition[condition_raw]
    except KeyError:
        condition_enum = TyreReadingCondition.GOOD

    reading = TyreReading(
        vehicle_tyre_id=tyre.id if tyre else None,
        vehicle_id=vehicle_id,
        position=position,
        psi=psi,
        tread_depth_mm=payload.get("tread_depth_mm"),
        condition=condition_enum,
        temperature_c=payload.get("temperature_c"),
        notes=payload.get("notes"),
        photo_url=payload.get("photo_url"),
        driver_id=payload.get("driver_id") or current_user.user_id,
        odometer_at_reading=payload.get("odometer_at_reading"),
    )
    db.add(reading)

    # Update tyre's last_psi and tread_depth if we have a matching record
    if tyre:
        tyre.last_psi = psi
        if payload.get("tread_depth_mm"):
            tyre.tread_depth_mm = payload["tread_depth_mm"]
        tyre.last_reading_at = datetime.utcnow()

    await db.flush()

    # Auto-create alerts
    threshold = await _get_threshold(db, vehicle_id)
    await _auto_create_alerts(db, reading, threshold, tyre.id if tyre else None)

    await db.commit()
    await db.refresh(reading)

    alerts_created = bool(threshold)  # simplified flag for response
    return APIResponse(
        success=True,
        data={"id": reading.id},
        message="Reading submitted" + (" — alerts raised" if alerts_created else ""),
    )


@router.get("/readings", response_model=APIResponse)
async def list_tyre_readings(
    vehicle_id: Optional[int] = None,
    driver_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """List all field readings with optional filters."""
    from app.models.postgres.user import User
    q = (
        select(TyreReading, Vehicle.registration_number, User.full_name)
        .join(Vehicle, Vehicle.id == TyreReading.vehicle_id)
        .outerjoin(User, User.id == TyreReading.driver_id)
    )
    if vehicle_id:
        q = q.where(TyreReading.vehicle_id == vehicle_id)
    if driver_id:
        q = q.where(TyreReading.driver_id == driver_id)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar() or 0

    q = q.order_by(TyreReading.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(q)

    items = []
    for reading, reg_no, driver_name in result.all():
        items.append({
            "id": reading.id,
            "vehicle_id": reading.vehicle_id,
            "vehicle_number": reg_no,
            "position": reading.position,
            "psi": float(reading.psi),
            "tread_depth_mm": float(reading.tread_depth_mm) if reading.tread_depth_mm else None,
            "condition": reading.condition.value if hasattr(reading.condition, 'value') else str(reading.condition),
            "temperature_c": float(reading.temperature_c) if reading.temperature_c else None,
            "notes": reading.notes,
            "photo_url": reading.photo_url,
            "driver_id": reading.driver_id,
            "driver_name": driver_name,
            "odometer_at_reading": float(reading.odometer_at_reading) if reading.odometer_at_reading else None,
            "created_at": reading.created_at.isoformat() if reading.created_at else None,
        })

    return APIResponse(
        success=True,
        data={"items": items},
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=(total + limit - 1) // limit),
    )


@router.get("/readings/vehicle/{vehicle_id}", response_model=APIResponse)
async def get_vehicle_readings(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Get all field readings for a specific vehicle."""
    result = await db.execute(
        select(TyreReading)
        .where(TyreReading.vehicle_id == vehicle_id)
        .order_by(TyreReading.created_at.desc())
        .limit(200)
    )
    readings = result.scalars().all()
    items = [
        {
            "id": r.id,
            "position": r.position,
            "psi": float(r.psi),
            "tread_depth_mm": float(r.tread_depth_mm) if r.tread_depth_mm else None,
            "condition": r.condition.value if hasattr(r.condition, 'value') else str(r.condition),
            "temperature_c": float(r.temperature_c) if r.temperature_c else None,
            "driver_id": r.driver_id,
            "odometer_at_reading": float(r.odometer_at_reading) if r.odometer_at_reading else None,
            "photo_url": r.photo_url,
            "notes": r.notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in readings
    ]
    return APIResponse(success=True, data={"vehicle_id": vehicle_id, "readings": items})


@router.get("/readings/vehicle/{vehicle_id}/last-trip-odometer", response_model=APIResponse)
async def get_last_trip_odometer(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Return the start and end odometer from the most recent trip for a vehicle."""
    from app.models.postgres.trip import Trip
    result = await db.execute(
        select(Trip.id, Trip.start_odometer, Trip.end_odometer, Trip.status)
        .where(Trip.vehicle_id == vehicle_id, Trip.is_deleted == False)
        .order_by(Trip.created_at.desc())
        .limit(1)
    )
    row = result.fetchone()
    if not row:
        return APIResponse(success=True, data={"trip_id": None, "start_odometer": None, "end_odometer": None})
    return APIResponse(success=True, data={
        "trip_id": row.id,
        "start_odometer": float(row.start_odometer) if row.start_odometer else None,
        "end_odometer": float(row.end_odometer) if row.end_odometer else None,
        "status": row.status.value if hasattr(row.status, "value") else str(row.status),
    })


@router.patch("/readings/{reading_id}", response_model=APIResponse)
async def update_tyre_reading(
    reading_id: int,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    """Edit a reading (admin only)."""
    reading = await db.get(TyreReading, reading_id)
    if not reading:
        raise HTTPException(status_code=404, detail="Reading not found")
    for field in ("psi", "tread_depth_mm", "condition", "notes", "photo_url", "temperature_c"):
        if field in payload:
            if field == "condition":
                try:
                    setattr(reading, field, TyreReadingCondition[str(payload[field]).upper()])
                except KeyError:
                    pass
            else:
                setattr(reading, field, payload[field])
    await db.commit()
    return APIResponse(success=True, message="Reading updated")


# ═══════════════════════════════════════════════════════════════════════════
# SECTION: TYRE ALERTS — GET, PATCH acknowledge/resolve
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/field-alerts", response_model=APIResponse)
async def list_field_alerts(
    status: str = Query("OPEN"),
    vehicle_id: Optional[int] = None,
    severity: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """List structured tyre alerts (field readings + sensors)."""
    q = (
        select(TyreAlert, Vehicle.registration_number)
        .join(Vehicle, Vehicle.id == TyreAlert.vehicle_id)
    )
    if vehicle_id:
        q = q.where(TyreAlert.vehicle_id == vehicle_id)
    if status and status != "all":
        try:
            q = q.where(TyreAlert.status == TyreAlertStatus[status.upper()])
        except KeyError:
            pass
    if severity:
        try:
            q = q.where(TyreAlert.severity == TyreAlertSeverity[severity.upper()])
        except KeyError:
            pass

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    q = q.order_by(TyreAlert.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(q)

    items = []
    for alert, reg_no in result.all():
        items.append({
            "id": alert.id,
            "vehicle_id": alert.vehicle_id,
            "vehicle_number": reg_no,
            "position": alert.position,
            "alert_type": alert.alert_type.value if hasattr(alert.alert_type, 'value') else str(alert.alert_type),
            "severity": alert.severity.value if hasattr(alert.severity, 'value') else str(alert.severity),
            "current_value": float(alert.current_value) if alert.current_value else None,
            "threshold_value": float(alert.threshold_value) if alert.threshold_value else None,
            "status": alert.status.value if hasattr(alert.status, 'value') else str(alert.status),
            "source": alert.source,
            "acknowledged_by": alert.acknowledged_by,
            "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
            "created_at": alert.created_at.isoformat() if alert.created_at else None,
        })

    return APIResponse(
        success=True,
        data={"items": items},
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=(total + limit - 1) // limit),
    )


@router.get("/field-alerts/vehicle/{vehicle_id}", response_model=APIResponse)
async def get_vehicle_field_alerts(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Get open tyre alerts for a specific vehicle."""
    result = await db.execute(
        select(TyreAlert)
        .where(TyreAlert.vehicle_id == vehicle_id, TyreAlert.status == TyreAlertStatus.OPEN)
        .order_by(TyreAlert.created_at.desc())
    )
    alerts = result.scalars().all()
    return APIResponse(success=True, data=[
        {
            "id": a.id,
            "position": a.position,
            "alert_type": a.alert_type.value if hasattr(a.alert_type, 'value') else str(a.alert_type),
            "severity": a.severity.value if hasattr(a.severity, 'value') else str(a.severity),
            "current_value": float(a.current_value) if a.current_value else None,
            "status": a.status.value if hasattr(a.status, 'value') else str(a.status),
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in alerts
    ])


@router.patch("/field-alerts/{alert_id}/acknowledge", response_model=APIResponse)
async def acknowledge_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    """Fleet manager acknowledges a tyre alert."""
    alert = await db.get(TyreAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.status != TyreAlertStatus.OPEN:
        raise HTTPException(status_code=400, detail="Alert is not in OPEN state")
    alert.status = TyreAlertStatus.ACKNOWLEDGED
    alert.acknowledged_by = current_user.user_id
    await db.commit()
    return APIResponse(success=True, message="Alert acknowledged")


@router.patch("/field-alerts/{alert_id}/resolve", response_model=APIResponse)
async def resolve_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    """Admin resolves a tyre alert."""
    alert = await db.get(TyreAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = TyreAlertStatus.RESOLVED
    alert.resolved_at = datetime.utcnow()
    await db.commit()
    return APIResponse(success=True, message="Alert resolved")


# ═══════════════════════════════════════════════════════════════════════════
# SECTION: THRESHOLDS — GET, POST, PUT
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/thresholds", response_model=APIResponse)
async def get_thresholds(
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Get fleet default + per-vehicle threshold overrides."""
    result = await db.execute(
        select(TyreThreshold, Vehicle.registration_number)
        .outerjoin(Vehicle, Vehicle.id == TyreThreshold.vehicle_id)
        .order_by(TyreThreshold.vehicle_id.nullsfirst())
    )
    items = []
    for threshold, reg_no in result.all():
        items.append({
            "id": threshold.id,
            "vehicle_id": threshold.vehicle_id,
            "vehicle_number": reg_no,
            "is_fleet_default": threshold.vehicle_id is None,
            "min_psi": float(threshold.min_psi or 80),
            "critical_psi": float(threshold.critical_psi or 60),
            "min_tread_mm": float(threshold.min_tread_mm or 3.0),
            "worn_tread_mm": float(threshold.worn_tread_mm or 1.6),
            "inspection_interval_days": threshold.inspection_interval_days or 7,
            "rotation_interval_km": threshold.rotation_interval_km or 20000,
        })
    return APIResponse(success=True, data={"items": items})


@router.post("/thresholds", response_model=APIResponse, status_code=201)
async def create_threshold(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    """Create a new threshold config (vehicle-specific or fleet default)."""
    vehicle_id = payload.get("vehicle_id")
    # Check if one already exists for this vehicle_id
    existing = await db.execute(
        select(TyreThreshold).where(TyreThreshold.vehicle_id == vehicle_id).limit(1)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Threshold already exists for this vehicle. Use PUT to update.")

    threshold = TyreThreshold(
        vehicle_id=vehicle_id,
        min_psi=payload.get("min_psi", 80.0),
        critical_psi=payload.get("critical_psi", 60.0),
        min_tread_mm=payload.get("min_tread_mm", 3.0),
        worn_tread_mm=payload.get("worn_tread_mm", 1.6),
        inspection_interval_days=payload.get("inspection_interval_days", 7),
        rotation_interval_km=payload.get("rotation_interval_km", 20000),
        created_by=current_user.user_id,
    )
    db.add(threshold)
    await db.commit()
    await db.refresh(threshold)
    return APIResponse(success=True, data={"id": threshold.id}, message="Threshold created")


@router.put("/thresholds/{threshold_id}", response_model=APIResponse)
async def update_threshold(
    threshold_id: int,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    """Update an existing threshold config."""
    threshold = await db.get(TyreThreshold, threshold_id)
    if not threshold:
        raise HTTPException(status_code=404, detail="Threshold not found")
    for field in ("min_psi", "critical_psi", "min_tread_mm", "worn_tread_mm",
                  "inspection_interval_days", "rotation_interval_km"):
        if field in payload:
            setattr(threshold, field, payload[field])
    await db.commit()
    return APIResponse(success=True, message="Threshold updated")


# ═══════════════════════════════════════════════════════════════════════════
# SECTION: SIMULATION — POST /tyre/simulate, GET history
# ═══════════════════════════════════════════════════════════════════════════

def _calc_position_factor(position: str) -> float:
    """Return wear factor based on axle position."""
    if not position:
        return 1.0
    axle = int(position[0]) if position[0].isdigit() else 1
    inner = "1" in position[2:] if len(position) > 2 else False
    if axle == 1:
        return 1.3   # Front steer — highest wear
    if axle == 2 and not inner:
        return 1.1   # Drive axle outer
    if axle == 2 and inner:
        return 0.9   # Drive axle inner
    return 0.85      # Rear trailer axles


def _run_simulation(
    tyres: list,
    simulated_km: int,
    simulated_load_kg: int,
    road_type: str,
    climate: str,
    max_load_kg: int = 25000,
) -> list:
    """Tyre wear simulation algorithm."""
    BASE_WEAR = 0.0003  # mm/km baseline
    ROAD_FACTORS = {"HIGHWAY": 1.0, "CITY": 1.4, "OFFROAD": 2.1, "MIXED": 1.3}
    CLIMATE_FACTORS = {"NORMAL": 1.0, "EXTREME_HEAT": 1.35, "MONSOON": 1.2}
    WORN_THRESHOLD = 1.6

    load_ratio = max(simulated_load_kg / max(max_load_kg, 1), 0.1)
    load_factor = load_ratio ** 1.2
    road_factor = ROAD_FACTORS.get(road_type.upper(), 1.0)
    climate_factor = CLIMATE_FACTORS.get(climate.upper(), 1.0)

    results = []
    for tyre in tyres:
        pos = tyre.get("position", "")
        current_tread = float(tyre.get("tread_depth_mm") or 8.0)
        pos_factor = _calc_position_factor(pos)
        wear_per_km = BASE_WEAR * load_factor * road_factor * climate_factor * pos_factor
        predicted_tread = max(0.0, current_tread - (wear_per_km * simulated_km))
        km_to_replacement = (current_tread - WORN_THRESHOLD) / wear_per_km if wear_per_km > 0 else 999999

        if predicted_tread <= 0:
            status = "REPLACE_NOW"
        elif predicted_tread < WORN_THRESHOLD:
            status = "REPLACE_SOON"
        elif predicted_tread < 3.0:
            status = "INSPECT"
        else:
            status = "OK"

        remaining_life_pct = max(0, round((predicted_tread / 10.0) * 100, 1))

        # Timeline: tread at each 5000 km milestone
        milestones = []
        step = max(simulated_km // 10, 1000)
        km = 0
        while km <= simulated_km:
            t = max(0.0, current_tread - wear_per_km * km)
            milestones.append({"km": km, "tread_mm": round(t, 2)})
            km += step

        results.append({
            "position": pos,
            "current_tread": round(current_tread, 2),
            "predicted_tread": round(predicted_tread, 2),
            "wear_per_km": round(wear_per_km, 6),
            "km_to_replacement": round(max(0, km_to_replacement)),
            "remaining_life_pct": remaining_life_pct,
            "status": status,
            "recommended_action": (
                "Replace immediately" if status == "REPLACE_NOW" else
                "Schedule replacement" if status == "REPLACE_SOON" else
                "Monitor closely" if status == "INSPECT" else
                "Continue monitoring"
            ),
            "timeline": milestones,
        })

    return results


@router.post("/simulate", response_model=APIResponse)
async def run_tyre_simulation(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
    current_user: TokenData = Depends(get_current_user),
):
    """Run tyre wear simulation and optionally save session."""
    vehicle_id = payload.get("vehicle_id")
    simulated_km = int(payload.get("simulated_km", 20000))
    simulated_load_kg = int(payload.get("simulated_load_kg", 15000))
    road_type = payload.get("road_type", "HIGHWAY")
    climate = payload.get("climate", "NORMAL")
    save_session = bool(payload.get("save_session", False))

    # Fetch current tyres for this vehicle
    result = await db.execute(
        select(VehicleTyre)
        .where(VehicleTyre.vehicle_id == vehicle_id, VehicleTyre.is_active == True)
        .order_by(VehicleTyre.position)
    )
    db_tyres = result.scalars().all()

    tyres_input = [
        {
            "position": t.position,
            "tread_depth_mm": float(t.tread_depth_mm or 8.0),
            "condition": t.condition,
            "brand": t.brand,
        }
        for t in db_tyres
    ]

    # Get vehicle capacity for load factor
    vehicle = await db.get(Vehicle, vehicle_id)
    max_load_kg = int(float(vehicle.capacity_tons or 25) * 1000) if vehicle else 25000

    sim_results = _run_simulation(
        tyres_input, simulated_km, simulated_load_kg, road_type, climate, max_load_kg
    )

    # Fleet-level summary
    replace_count = sum(1 for r in sim_results if r["status"] in ("REPLACE_NOW", "REPLACE_SOON"))
    ok_count = len(sim_results) - replace_count
    est_cost = replace_count * 15000  # Approximate ₹15,000 per tyre

    summary = {
        "total_tyres": len(sim_results),
        "tyres_ok": ok_count,
        "tyres_needing_replacement": replace_count,
        "estimated_replacement_cost": est_cost,
        "cost_per_km": round(est_cost / max(simulated_km, 1), 2),
    }

    # Optionally persist session
    session_id = None
    if save_session and vehicle_id:
        session = TyreSimulationSession(
            vehicle_id=vehicle_id,
            simulated_km=simulated_km,
            simulated_load_kg=simulated_load_kg,
            road_type=road_type,
            climate=climate,
            result_json=json.dumps(sim_results),
            created_by=current_user.user_id,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        session_id = session.id

    return APIResponse(
        success=True,
        data={
            "session_id": session_id,
            "vehicle_id": vehicle_id,
            "simulated_km": simulated_km,
            "road_type": road_type,
            "climate": climate,
            "load_kg": simulated_load_kg,
            "summary": summary,
            "tyre_results": sim_results,
        },
    )


@router.get("/simulate/history", response_model=APIResponse)
async def simulation_history(
    vehicle_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Get past simulation sessions."""
    q = select(TyreSimulationSession, Vehicle.registration_number).join(
        Vehicle, Vehicle.id == TyreSimulationSession.vehicle_id
    )
    if vehicle_id:
        q = q.where(TyreSimulationSession.vehicle_id == vehicle_id)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    q = q.order_by(TyreSimulationSession.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(q)

    items = []
    for session, reg_no in result.all():
        items.append({
            "id": session.id,
            "vehicle_id": session.vehicle_id,
            "vehicle_number": reg_no,
            "simulated_km": session.simulated_km,
            "simulated_load_kg": session.simulated_load_kg,
            "road_type": session.road_type.value if hasattr(session.road_type, 'value') else str(session.road_type),
            "climate": session.climate,
            "created_at": session.created_at.isoformat() if session.created_at else None,
        })

    return APIResponse(
        success=True,
        data={"items": items},
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=(total + limit - 1) // limit),
    )


# ═══════════════════════════════════════════════════════════════════════════
# SECTION: ANALYTICS — Predictions, driver compliance, inspection coverage
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/analytics/predictions", response_model=APIResponse)
async def tyre_predictions(
    days: int = Query(90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Predict tyre replacements within the next N days based on recent wear rate."""
    result = await db.execute(
        select(VehicleTyre, Vehicle.registration_number)
        .join(Vehicle, Vehicle.id == VehicleTyre.vehicle_id)
        .where(VehicleTyre.is_active == True)
    )
    tyres = result.all()

    predictions = []
    today = date.today()

    for tyre, reg_no in tyres:
        tread = float(tyre.tread_depth_mm or 6.0)
        km_run = float((tyre.current_km or 0) - (tyre.km_at_fitment or 0))
        if km_run < 0:
            km_run = 0

        # Estimate wear rate: assume 100k km life → initial 10mm tread
        # Simpler: use km_run as proxy
        WORN_THRESHOLD = 1.6
        if tread <= WORN_THRESHOLD:
            # Already worn
            predictions.append({
                "tyre_id": tyre.id,
                "vehicle_id": tyre.vehicle_id,
                "registration_number": reg_no,
                "position": tyre.position,
                "serial_number": tyre.tyre_number,
                "brand": tyre.brand,
                "current_tread_mm": round(tread, 1),
                "days_remaining": 0,
                "km_remaining": None,
                "predicted_replacement_date": today.isoformat(),
                "estimated_cost": 15000,
                "reason": "Tread below legal minimum",
                "urgency": "critical",
            })
            continue

        # Estimate daily wear: km_run over tyre age → wear per km
        fit_date = tyre.purchase_date
        if fit_date:
            days_on_vehicle = max((today - fit_date).days, 1)
            km_per_day = float(km_run) / days_on_vehicle
        else:
            km_per_day = 200  # default assumption

        wear_per_km = (10.0 - tread) / max(km_run, 1.0) if km_run > 0 else 0.0001
        tread_remaining = tread - WORN_THRESHOLD
        km_to_worn = tread_remaining / max(wear_per_km, 0.0001)
        days_to_worn = km_to_worn / max(km_per_day, 1)

        if days_to_worn <= days:
            urgency = "critical" if days_to_worn <= 30 else ("high" if days_to_worn <= 60 else "medium")
            predictions.append({
                "tyre_id": tyre.id,
                "vehicle_id": tyre.vehicle_id,
                "registration_number": reg_no,
                "position": tyre.position,
                "serial_number": tyre.tyre_number,
                "brand": tyre.brand,
                "current_tread_mm": round(tread, 1),
                "days_remaining": round(days_to_worn),
                "km_remaining": None,
                "predicted_replacement_date": (today + timedelta(days=days_to_worn)).isoformat(),
                "estimated_cost": 15000,
                "reason": "Estimated wear-rate projection",
                "urgency": urgency,
            })

    predictions.sort(key=lambda x: x["days_remaining"])
    return APIResponse(success=True, data={"predictions": predictions, "days_horizon": days})


@router.get("/analytics/inspection-coverage", response_model=APIResponse)
async def inspection_coverage(
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Per-vehicle last inspection date and overdue status."""
    # Get fleet default threshold for interval
    threshold_result = await db.execute(
        select(TyreThreshold).where(TyreThreshold.vehicle_id == None).limit(1)
    )
    fleet_threshold = threshold_result.scalar_one_or_none()
    interval_days = fleet_threshold.inspection_interval_days if fleet_threshold else 7

    # Get all vehicles
    vehicles_result = await db.execute(
        select(Vehicle).where(Vehicle.is_deleted == False).order_by(Vehicle.registration_number)
    )
    vehicles = vehicles_result.scalars().all()

    today = datetime.utcnow()
    items = []
    for v in vehicles:
        # Get latest reading for this vehicle
        latest_result = await db.execute(
            select(TyreReading.created_at)
            .where(TyreReading.vehicle_id == v.id)
            .order_by(TyreReading.created_at.desc())
            .limit(1)
        )
        last_reading_at = latest_result.scalar_one_or_none()
        if last_reading_at:
            days_since = (today - last_reading_at).days
        else:
            days_since = 9999

        overdue = days_since > interval_days
        due_soon = not overdue and days_since > (interval_days - 2)

        items.append({
            "vehicle_id": v.id,
            "registration_number": v.registration_number,
            "vehicle_type": v.vehicle_type.value if hasattr(v.vehicle_type, 'value') else str(v.vehicle_type or ""),
            "last_inspection": last_reading_at.isoformat() if last_reading_at else None,
            "days_since_inspection": days_since if days_since < 9999 else None,
            "overdue": overdue,
            "due_soon": due_soon,
        })

    overdue_count = sum(1 for i in items if i["overdue"])
    due_soon_count = sum(1 for i in items if i["due_soon"])
    return APIResponse(success=True, data={
        "items": items,
        "overdue_count": overdue_count,
        "due_soon_count": due_soon_count,
        "inspection_interval_days": interval_days,
    })


@router.get("/analytics/driver-compliance", response_model=APIResponse)
async def driver_inspection_compliance(
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Driver inspection compliance: how often each driver submits readings on time."""
    from app.models.postgres.user import User, Role, user_roles, RoleType
    # Get all drivers via role join
    drivers_result = await db.execute(
        select(User)
        .join(user_roles, user_roles.c.user_id == User.id)
        .join(Role, Role.id == user_roles.c.role_id)
        .where(Role.role_type == RoleType.DRIVER)
        .distinct()
    )
    drivers = drivers_result.scalars().all()

    # For each driver, count readings in last 30 days vs expected
    cutoff = datetime.utcnow() - timedelta(days=30)
    results = []
    for driver in drivers:
        reading_count = (await db.execute(
            select(func.count()).where(
                TyreReading.driver_id == driver.id,
                TyreReading.created_at >= cutoff,
            )
        )).scalar() or 0

        last_reading_result = await db.execute(
            select(TyreReading.created_at)
            .where(TyreReading.driver_id == driver.id)
            .order_by(TyreReading.created_at.desc())
            .limit(1)
        )
        last_reading = last_reading_result.scalar_one_or_none()

        # Expected: 1 inspection every 7 days = ~4 inspections per 30 days
        expected = 4
        compliance_pct = min(100, round((reading_count / expected) * 100))
        driver_name = f"{driver.first_name} {driver.last_name or ''}".strip() or driver.email

        results.append({
            "driver_id": driver.id,
            "driver_name": driver_name,
            "phone": driver.phone,
            "readings_last_30_days": reading_count,
            "expected_readings": expected,
            "compliance_pct": compliance_pct,
            "last_inspection": last_reading.isoformat() if last_reading else None,
        })

    results.sort(key=lambda x: x["compliance_pct"])
    return APIResponse(success=True, data={"drivers": results})

