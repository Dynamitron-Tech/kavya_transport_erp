from datetime import datetime, date, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, case, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.db.postgres.connection import get_db
from app.middleware.permissions import Permissions, require_permission
from app.models.postgres.vehicle import Vehicle, VehicleTyre, TyreLifecycleEvent, TyreSensorReading
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
