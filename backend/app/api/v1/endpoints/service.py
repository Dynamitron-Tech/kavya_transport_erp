from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData
from app.db.postgres.connection import get_db
from app.middleware.permissions import Permissions, require_permission
from app.models.postgres.vehicle import Vehicle, VehicleMaintenance, Workshop
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.service import ServiceCreate, ServiceUpdate, WorkshopCreate, WorkshopUpdate

router = APIRouter()


# ── Service Records ───────────────────────────────────────


@router.get("", response_model=APIResponse)
async def list_service_records(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    vehicle_id: Optional[int] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.MAINTENANCE_READ)),
):
    query = (
        select(VehicleMaintenance, Vehicle.registration_number, Workshop.name)
        .join(Vehicle, Vehicle.id == VehicleMaintenance.vehicle_id)
        .outerjoin(Workshop, Workshop.id == VehicleMaintenance.workshop_id)
    )
    count_query = select(func.count(VehicleMaintenance.id))

    if vehicle_id:
        query = query.where(VehicleMaintenance.vehicle_id == vehicle_id)
        count_query = count_query.where(VehicleMaintenance.vehicle_id == vehicle_id)
    if status:
        query = query.where(VehicleMaintenance.status == status.lower())
        count_query = count_query.where(VehicleMaintenance.status == status.lower())

    total = (await db.execute(count_query)).scalar() or 0
    offset = max(page - 1, 0) * limit
    result = await db.execute(query.order_by(VehicleMaintenance.id.desc()).offset(offset).limit(limit))

    items = []
    for service, reg_no, workshop_name in result.all():
        items.append({
            "id": service.id,
            "vehicle_id": service.vehicle_id,
            "vehicle_number": reg_no,
            "service_type": service.service_type or service.maintenance_type,
            "service_date": service.service_date,
            "odometer": float(service.odometer_at_service or 0),
            "workshop": workshop_name or service.vendor_name,
            "workshop_id": service.workshop_id,
            "job_card_number": service.invoice_number,
            "work_order_number": service.work_order_number,
            "parts_description": service.parts_description,
            "parts_cost": float(service.parts_cost or 0),
            "labour_cost": float(service.labor_cost or 0),
            "total_cost": float(service.total_cost or 0),
            "next_service_km": float(service.next_service_km or 0),
            "next_service_date": service.next_service_date,
            "notes": service.description,
            "status": service.status,
        })

    pages = (total + limit - 1) // limit
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.post("", response_model=APIResponse, status_code=201)
async def create_service_record(
    data: ServiceCreate,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.MAINTENANCE_CREATE)),
):
    maintenance_type = "scheduled" if str(data.service_type).upper() == "SCHEDULED" else "breakdown"
    service = VehicleMaintenance(
        vehicle_id=data.vehicle_id,
        maintenance_type=maintenance_type,
        service_type=data.service_type,
        service_date=data.service_date,
        odometer_at_service=data.odometer,
        vendor_name=data.workshop,
        workshop_id=data.workshop_id,
        invoice_number=data.job_card_number,
        work_order_number=data.work_order_number,
        parts_description=data.parts_description,
        parts_cost=data.parts_cost,
        labor_cost=data.labour_cost,
        total_cost=data.total_cost,
        next_service_km=data.next_service_km,
        next_service_date=data.next_service_date,
        description=data.notes,
        status="completed",
    )
    db.add(service)
    await db.commit()
    await db.refresh(service)
    return APIResponse(success=True, data={"id": service.id}, message="Service record created")


@router.put("/{service_id}", response_model=APIResponse)
async def update_service_record(
    service_id: int,
    data: ServiceUpdate,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.MAINTENANCE_CREATE)),
):
    service = await db.get(VehicleMaintenance, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service record not found")

    payload = data.model_dump(exclude_unset=True)
    field_map = {
        "odometer": "odometer_at_service",
        "workshop": "vendor_name",
        "job_card_number": "invoice_number",
        "labour_cost": "labor_cost",
        "notes": "description",
    }

    for key, value in payload.items():
        attr = field_map.get(key, key)
        if attr == "maintenance_type":
            continue
        setattr(service, attr, value)

    if "service_type" in payload:
        service.maintenance_type = "scheduled" if str(payload["service_type"]).upper() == "SCHEDULED" else "breakdown"

    await db.commit()
    return APIResponse(success=True, message="Service record updated")


@router.delete("/{service_id}", response_model=APIResponse)
async def delete_service_record(
    service_id: int,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.MAINTENANCE_CREATE)),
):
    service = await db.get(VehicleMaintenance, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service record not found")

    await db.delete(service)
    await db.commit()
    return APIResponse(success=True, message="Service record deleted")


# ── Service Analytics ─────────────────────────────────────


@router.get("/analytics/cost", response_model=APIResponse)
async def service_cost_analytics(
    months: int = Query(6, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.MAINTENANCE_READ)),
):
    """Maintenance cost analytics: by vehicle, by workshop, monthly trend."""
    since = date.today() - timedelta(days=months * 30)

    result = await db.execute(
        select(VehicleMaintenance, Vehicle.registration_number, Workshop.name)
        .join(Vehicle, Vehicle.id == VehicleMaintenance.vehicle_id)
        .outerjoin(Workshop, Workshop.id == VehicleMaintenance.workshop_id)
        .where(VehicleMaintenance.service_date >= since)
    )
    records = result.all()

    by_vehicle: dict = {}
    by_workshop: dict = {}
    by_month: dict = {}
    total_parts = 0.0
    total_labor = 0.0
    total_cost = 0.0

    for svc, reg_no, ws_name in records:
        cost = float(svc.total_cost or 0)
        parts = float(svc.parts_cost or 0)
        labor = float(svc.labor_cost or 0)
        total_parts += parts
        total_labor += labor
        total_cost += cost

        # By vehicle
        if reg_no not in by_vehicle:
            by_vehicle[reg_no] = {"count": 0, "total_cost": 0, "parts_cost": 0, "labor_cost": 0}
        by_vehicle[reg_no]["count"] += 1
        by_vehicle[reg_no]["total_cost"] += cost
        by_vehicle[reg_no]["parts_cost"] += parts
        by_vehicle[reg_no]["labor_cost"] += labor

        # By workshop
        ws = ws_name or svc.vendor_name or "Unknown"
        if ws not in by_workshop:
            by_workshop[ws] = {"count": 0, "total_cost": 0}
        by_workshop[ws]["count"] += 1
        by_workshop[ws]["total_cost"] += cost

        # Monthly trend
        month_key = svc.service_date.strftime("%Y-%m") if svc.service_date else "unknown"
        if month_key not in by_month:
            by_month[month_key] = {"count": 0, "total_cost": 0, "parts_cost": 0, "labor_cost": 0}
        by_month[month_key]["count"] += 1
        by_month[month_key]["total_cost"] += cost
        by_month[month_key]["parts_cost"] += parts
        by_month[month_key]["labor_cost"] += labor

    # Format
    vehicle_list = [
        {"vehicle": k, "service_count": v["count"], "total_cost": round(v["total_cost"], 2), "parts_cost": round(v["parts_cost"], 2), "labor_cost": round(v["labor_cost"], 2)}
        for k, v in by_vehicle.items()
    ]
    vehicle_list.sort(key=lambda x: x["total_cost"], reverse=True)

    workshop_list = [
        {"workshop": k, "service_count": v["count"], "total_cost": round(v["total_cost"], 2)}
        for k, v in by_workshop.items()
    ]
    workshop_list.sort(key=lambda x: x["total_cost"], reverse=True)

    monthly_trend = [
        {"month": k, "service_count": v["count"], "total_cost": round(v["total_cost"], 2), "parts_cost": round(v["parts_cost"], 2), "labor_cost": round(v["labor_cost"], 2)}
        for k, v in sorted(by_month.items())
    ]

    return APIResponse(success=True, data={
        "summary": {
            "total_records": len(records),
            "total_cost": round(total_cost, 2),
            "total_parts_cost": round(total_parts, 2),
            "total_labor_cost": round(total_labor, 2),
        },
        "by_vehicle": vehicle_list,
        "by_workshop": workshop_list,
        "monthly_trend": monthly_trend,
    })


@router.get("/overdue", response_model=APIResponse)
async def overdue_services(
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.MAINTENANCE_READ)),
):
    """Vehicles with overdue or upcoming service (by date or km)."""
    today = date.today()
    soon = today + timedelta(days=14)

    result = await db.execute(
        select(VehicleMaintenance, Vehicle.registration_number, Vehicle.odometer_reading)
        .join(Vehicle, Vehicle.id == VehicleMaintenance.vehicle_id)
        .where(
            VehicleMaintenance.next_service_date.isnot(None),
            VehicleMaintenance.next_service_date <= soon,
        )
        .order_by(VehicleMaintenance.next_service_date.asc())
    )

    items = []
    for svc, reg_no, odo in result.all():
        days_until = (svc.next_service_date - today).days if svc.next_service_date else None
        km_remaining = None
        if svc.next_service_km and odo:
            km_remaining = float(svc.next_service_km) - float(odo)

        urgency = "normal"
        if days_until is not None and days_until < 0:
            urgency = "overdue"
        elif days_until is not None and days_until <= 3:
            urgency = "critical"
        elif days_until is not None and days_until <= 7:
            urgency = "soon"
        if km_remaining is not None and km_remaining < 0:
            urgency = "overdue"

        items.append({
            "vehicle_id": svc.vehicle_id,
            "vehicle_number": reg_no,
            "service_type": svc.service_type,
            "last_service_date": svc.service_date,
            "next_service_date": svc.next_service_date,
            "days_until": days_until,
            "next_service_km": float(svc.next_service_km) if svc.next_service_km else None,
            "km_remaining": round(km_remaining) if km_remaining is not None else None,
            "urgency": urgency,
        })

    return APIResponse(success=True, data=items)


# ── Workshop Management ───────────────────────────────────


@router.get("/workshops", response_model=APIResponse)
async def list_workshops(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.MAINTENANCE_READ)),
):
    count_query = select(func.count(Workshop.id)).where(Workshop.is_deleted == False)
    total = (await db.execute(count_query)).scalar() or 0
    offset = max(page - 1, 0) * limit

    result = await db.execute(
        select(Workshop)
        .where(Workshop.is_deleted == False)
        .order_by(Workshop.name)
        .offset(offset).limit(limit)
    )
    workshops = result.scalars().all()

    # Get service counts per workshop
    svc_counts = {}
    svc_result = await db.execute(
        select(VehicleMaintenance.workshop_id, func.count(VehicleMaintenance.id))
        .where(VehicleMaintenance.workshop_id.isnot(None))
        .group_by(VehicleMaintenance.workshop_id)
    )
    for ws_id, cnt in svc_result.all():
        svc_counts[ws_id] = cnt

    items = []
    for ws in workshops:
        items.append({
            "id": ws.id,
            "name": ws.name,
            "code": ws.code,
            "address": ws.address,
            "city": ws.city,
            "state": ws.state,
            "pincode": ws.pincode,
            "contact_person": ws.contact_person,
            "phone": ws.phone,
            "email": ws.email,
            "specialization": ws.specialization,
            "rating": float(ws.rating) if ws.rating else None,
            "is_empanelled": ws.is_empanelled,
            "service_count": svc_counts.get(ws.id, 0),
        })

    pages = (total + limit - 1) // limit
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.post("/workshops", response_model=APIResponse, status_code=201)
async def create_workshop(
    data: WorkshopCreate,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.MAINTENANCE_CREATE)),
):
    ws = Workshop(**data.model_dump())
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    return APIResponse(success=True, data={"id": ws.id}, message="Workshop created")


@router.put("/workshops/{workshop_id}", response_model=APIResponse)
async def update_workshop(
    workshop_id: int,
    data: WorkshopUpdate,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.MAINTENANCE_CREATE)),
):
    ws = await db.get(Workshop, workshop_id)
    if not ws or ws.is_deleted:
        raise HTTPException(status_code=404, detail="Workshop not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(ws, key, value)

    await db.commit()
    return APIResponse(success=True, message="Workshop updated")


@router.delete("/workshops/{workshop_id}", response_model=APIResponse)
async def delete_workshop(
    workshop_id: int,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.MAINTENANCE_CREATE)),
):
    ws = await db.get(Workshop, workshop_id)
    if not ws or ws.is_deleted:
        raise HTTPException(status_code=404, detail="Workshop not found")

    ws.is_deleted = True
    await db.commit()
    return APIResponse(success=True, message="Workshop deleted")
