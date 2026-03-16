# Vehicle Service - CRUD + Fleet operations
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from datetime import date, timedelta

from app.models.postgres.vehicle import (
    Vehicle,
    VehicleDocument,
    VehicleMaintenance,
    VehicleStatus,
    VehicleType,
    OwnershipType,
)


def _coerce_enum(enum_cls, raw_value):
    if raw_value is None:
        return None
    if isinstance(raw_value, enum_cls):
        return raw_value

    text = str(raw_value).strip()
    if not text:
        return None

    for member in enum_cls:
        if text.lower() == str(member.value).lower() or text.upper() == member.name.upper():
            return member

    return raw_value


async def list_vehicles(db: AsyncSession, page: int = 1, limit: int = 20, search: str = None, status: str = None, vehicle_type: str = None):
    query = select(Vehicle).where(Vehicle.is_deleted == False)
    count_query = select(func.count(Vehicle.id)).where(Vehicle.is_deleted == False)

    if search:
        sf = or_(
            Vehicle.registration_number.ilike(f"%{search}%"),
            Vehicle.make.ilike(f"%{search}%"),
            Vehicle.model.ilike(f"%{search}%"),
        )
        query = query.where(sf)
        count_query = count_query.where(sf)

    if status:
        normalized_status = _coerce_enum(VehicleStatus, status)
        query = query.where(Vehicle.status == normalized_status)
        count_query = count_query.where(Vehicle.status == normalized_status)

    if vehicle_type:
        normalized_type = _coerce_enum(VehicleType, vehicle_type)
        query = query.where(Vehicle.vehicle_type == normalized_type)
        count_query = count_query.where(Vehicle.vehicle_type == normalized_type)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(Vehicle.id.desc()))
    return result.scalars().all(), total


async def get_vehicle(db: AsyncSession, vehicle_id: int):
    result = await db.execute(
        select(Vehicle).where(Vehicle.id == vehicle_id, Vehicle.is_deleted == False)
    )
    return result.scalar_one_or_none()


async def create_vehicle(db: AsyncSession, data: dict) -> Vehicle:
    data = dict(data)
    data["vehicle_type"] = _coerce_enum(VehicleType, data.get("vehicle_type"))
    data["ownership_type"] = _coerce_enum(OwnershipType, data.get("ownership_type"))
    data["status"] = _coerce_enum(VehicleStatus, data.get("status"))
    vehicle = Vehicle(**data)
    db.add(vehicle)
    await db.flush()
    return vehicle


async def update_vehicle(db: AsyncSession, vehicle_id: int, data: dict):
    vehicle = await get_vehicle(db, vehicle_id)
    if not vehicle:
        return None

    data = dict(data)
    if "vehicle_type" in data:
        data["vehicle_type"] = _coerce_enum(VehicleType, data.get("vehicle_type"))
    if "ownership_type" in data:
        data["ownership_type"] = _coerce_enum(OwnershipType, data.get("ownership_type"))
    if "status" in data:
        data["status"] = _coerce_enum(VehicleStatus, data.get("status"))

    for k, v in data.items():
        if v is not None:
            setattr(vehicle, k, v)
    return vehicle


async def delete_vehicle(db: AsyncSession, vehicle_id: int) -> bool:
    vehicle = await get_vehicle(db, vehicle_id)
    if not vehicle:
        return False
    vehicle.is_deleted = True
    return True


def get_expiry_alerts(vehicle: Vehicle) -> list[dict]:
    """Calculate days till expiry for all vehicle documents."""
    alerts = []
    today = date.today()
    fields = [
        ("fitness_valid_until", "Fitness Certificate"),
        ("permit_valid_until", "Permit"),
        ("insurance_valid_until", "Insurance"),
        ("puc_valid_until", "PUC Certificate"),
    ]
    for field, label in fields:
        expiry = getattr(vehicle, field, None)
        if expiry:
            days = (expiry - today).days
            if days <= 30:
                alerts.append({
                    "type": label,
                    "expiry_date": expiry.isoformat(),
                    "days_remaining": days,
                    "severity": "critical" if days <= 7 else "warning",
                })
    return alerts


async def get_vehicles_expiring_soon(db: AsyncSession, days: int = 30):
    """Get vehicles with documents expiring within given days."""
    threshold = date.today() + timedelta(days=days)
    result = await db.execute(
        select(Vehicle).where(
            Vehicle.is_deleted == False,
            or_(
                Vehicle.fitness_valid_until <= threshold,
                Vehicle.permit_valid_until <= threshold,
                Vehicle.insurance_valid_until <= threshold,
                Vehicle.puc_valid_until <= threshold,
            )
        )
    )
    return result.scalars().all()


async def get_fleet_summary(db: AsyncSession) -> dict:
    """Get fleet-wide status summary."""
    total = (await db.execute(
        select(func.count(Vehicle.id)).where(Vehicle.is_deleted == False)
    )).scalar() or 0

    available = (await db.execute(
        select(func.count(Vehicle.id)).where(Vehicle.is_deleted == False, Vehicle.status == VehicleStatus.AVAILABLE)
    )).scalar() or 0

    on_trip = (await db.execute(
        select(func.count(Vehicle.id)).where(Vehicle.is_deleted == False, Vehicle.status == VehicleStatus.ON_TRIP)
    )).scalar() or 0

    maintenance = (await db.execute(
        select(func.count(Vehicle.id)).where(Vehicle.is_deleted == False, Vehicle.status == VehicleStatus.MAINTENANCE)
    )).scalar() or 0

    expiring = len(await get_vehicles_expiring_soon(db, 30))

    return {
        "total_vehicles": total,
        "available": available,
        "on_trip": on_trip,
        "maintenance": maintenance,
        "expiring_soon": expiring,
    }
