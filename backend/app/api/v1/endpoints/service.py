from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData
from app.db.postgres.connection import get_db
from app.middleware.permissions import Permissions, require_permission
from app.models.postgres.vehicle import Vehicle, VehicleMaintenance
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.service import ServiceCreate, ServiceUpdate

router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_service_records(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    vehicle_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.MAINTENANCE_READ)),
):
    query = select(VehicleMaintenance, Vehicle.registration_number).join(Vehicle, Vehicle.id == VehicleMaintenance.vehicle_id)
    count_query = select(func.count(VehicleMaintenance.id))

    if vehicle_id:
        query = query.where(VehicleMaintenance.vehicle_id == vehicle_id)
        count_query = count_query.where(VehicleMaintenance.vehicle_id == vehicle_id)

    total = (await db.execute(count_query)).scalar() or 0
    offset = max(page - 1, 0) * limit
    result = await db.execute(query.order_by(VehicleMaintenance.id.desc()).offset(offset).limit(limit))

    items = []
    for service, reg_no in result.all():
        items.append({
            "id": service.id,
            "vehicle_id": service.vehicle_id,
            "vehicle_number": reg_no,
            "service_type": service.service_type or service.maintenance_type,
            "service_date": service.service_date,
            "odometer": float(service.odometer_at_service or 0),
            "workshop": service.vendor_name,
            "job_card_number": service.invoice_number,
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
        invoice_number=data.job_card_number,
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
