# Trip Service - CRUD + Status workflow + Expenses + Fuel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from datetime import datetime

from app.models.postgres.trip import Trip, TripExpense, TripFuelEntry, TripStatus, TripStatusEnum, ExpenseCategory
from app.models.postgres.job import Job
from app.models.postgres.vehicle import Vehicle, VehicleStatus
from app.models.postgres.driver import Driver, DriverStatus
from app.models.postgres.lr import LR
from app.utils.generators import generate_trip_number


VALID_TRIP_TRANSITIONS = {
    "planned": ["vehicle_assigned", "started", "cancelled"],
    "vehicle_assigned": ["driver_assigned", "planned", "cancelled"],
    "driver_assigned": ["ready", "vehicle_assigned", "cancelled"],
    "ready": ["started", "cancelled"],
    "started": ["loading", "in_transit", "cancelled"],
    "loading": ["in_transit"],
    "in_transit": ["unloading", "completed"],
    "unloading": ["completed"],
    "completed": [],
    "cancelled": ["planned"],
}


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


async def list_trips(db: AsyncSession, page: int = 1, limit: int = 20, search: str = None, status: str = None, vehicle_id: int = None, driver_id: int = None):
    query = select(Trip).where(Trip.is_deleted == False)
    count_query = select(func.count(Trip.id)).where(Trip.is_deleted == False)

    if search:
        sf = or_(
            Trip.trip_number.ilike(f"%{search}%"),
            Trip.origin.ilike(f"%{search}%"),
            Trip.destination.ilike(f"%{search}%"),
            Trip.driver_name.ilike(f"%{search}%"),
            Trip.vehicle_registration.ilike(f"%{search}%"),
        )
        query = query.where(sf)
        count_query = count_query.where(sf)

    if status:
        normalized_status = _coerce_enum(TripStatusEnum, status)
        query = query.where(Trip.status == normalized_status)
        count_query = count_query.where(Trip.status == normalized_status)

    if vehicle_id:
        query = query.where(Trip.vehicle_id == vehicle_id)
        count_query = count_query.where(Trip.vehicle_id == vehicle_id)

    if driver_id:
        query = query.where(Trip.driver_id == driver_id)
        count_query = count_query.where(Trip.driver_id == driver_id)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(Trip.id.desc()))
    return result.scalars().all(), total


async def get_trip(db: AsyncSession, trip_id: int):
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.is_deleted == False)
    )
    return result.scalar_one_or_none()


async def create_trip(db: AsyncSession, data: dict, user_id: int = None) -> Trip:
    data = dict(data)
    lr_ids = data.pop("lr_ids", [])
    data["trip_number"] = generate_trip_number()
    data["created_by"] = user_id
    data["status"] = _coerce_enum(TripStatusEnum, data.get("status", "planned"))

    # Denormalize vehicle and driver info
    vehicle_result = await db.execute(select(Vehicle).where(Vehicle.id == data["vehicle_id"]))
    vehicle = vehicle_result.scalar_one_or_none()
    if vehicle:
        data["vehicle_registration"] = vehicle.registration_number

    driver_result = await db.execute(select(Driver).where(Driver.id == data["driver_id"]))
    driver = driver_result.scalar_one_or_none()
    if driver:
        data["driver_name"] = f"{driver.first_name} {driver.last_name or ''}".strip()
        data["driver_phone"] = driver.phone

    trip = Trip(**data)
    db.add(trip)
    await db.flush()

    # Link LRs to trip
    for lr_id in lr_ids:
        lr_result = await db.execute(select(LR).where(LR.id == lr_id))
        lr = lr_result.scalar_one_or_none()
        if lr:
            lr.trip_id = trip.id
            lr.vehicle_id = data["vehicle_id"]
            lr.driver_id = data["driver_id"]

    # Update vehicle status
    if vehicle:
        vehicle.status = VehicleStatus.ON_TRIP

    # Update driver status
    if driver:
        driver.status = DriverStatus.ON_TRIP

    # Status history
    history = TripStatus(
        trip_id=trip.id, from_status=None, to_status="planned", changed_by=user_id, remarks="Trip created"
    )
    db.add(history)
    await db.flush()
    return trip


async def update_trip(db: AsyncSession, trip_id: int, data: dict):
    trip = await get_trip(db, trip_id)
    if not trip:
        return None

    data = dict(data)
    if "status" in data:
        data["status"] = _coerce_enum(TripStatusEnum, data.get("status"))

    for k, v in data.items():
        if v is not None:
            setattr(trip, k, v)
    return trip


async def delete_trip(db: AsyncSession, trip_id: int) -> bool:
    trip = await get_trip(db, trip_id)
    if not trip:
        return False
    trip.is_deleted = True
    return True


async def change_trip_status(db: AsyncSession, trip_id: int, new_status: str, user_id: int = None, remarks: str = None, odometer_reading: float = None, latitude: float = None, longitude: float = None, location_name: str = None):
    trip = await get_trip(db, trip_id)
    if not trip:
        return None, "Trip not found"

    current = trip.status.value if hasattr(trip.status, 'value') else str(trip.status)
    allowed = VALID_TRIP_TRANSITIONS.get(current, [])
    if new_status not in allowed:
        return None, f"Cannot transition from '{current}' to '{new_status}'. Allowed: {allowed}"

    old_status = current
    trip.status = _coerce_enum(TripStatusEnum, new_status)

    now = datetime.utcnow()
    if new_status == "started":
        trip.actual_start = now
        if odometer_reading:
            trip.start_odometer = odometer_reading
    elif new_status == "loading":
        trip.loading_start = now
    elif new_status == "in_transit":
        if not trip.loading_end and trip.loading_start:
            trip.loading_end = now
    elif new_status == "unloading":
        trip.unloading_start = now
    elif new_status == "completed":
        trip.actual_end = now
        if trip.unloading_start and not trip.unloading_end:
            trip.unloading_end = now
        if odometer_reading:
            trip.end_odometer = odometer_reading
            if trip.start_odometer:
                trip.actual_distance_km = float(odometer_reading) - float(trip.start_odometer)
        # Release vehicle and driver
        if trip.vehicle_id:
            vr = await db.execute(select(Vehicle).where(Vehicle.id == trip.vehicle_id))
            v = vr.scalar_one_or_none()
            if v:
                v.status = VehicleStatus.AVAILABLE
                if odometer_reading:
                    v.odometer_reading = odometer_reading
        if trip.driver_id:
            dr = await db.execute(select(Driver).where(Driver.id == trip.driver_id))
            d = dr.scalar_one_or_none()
            if d:
                d.status = DriverStatus.AVAILABLE
        # Calculate profit/loss
        trip.profit_loss = float(trip.revenue or 0) - float(trip.total_expense or 0)

    history = TripStatus(
        trip_id=trip.id, from_status=old_status, to_status=new_status,
        changed_by=user_id, remarks=remarks,
        latitude=latitude, longitude=longitude, location_name=location_name,
    )
    db.add(history)
    await db.flush()
    return trip, None


# --- Expenses ---
async def list_trip_expenses(db: AsyncSession, trip_id: int):
    result = await db.execute(
        select(TripExpense).where(TripExpense.trip_id == trip_id).order_by(TripExpense.expense_date.desc())
    )
    return result.scalars().all()


async def add_trip_expense(db: AsyncSession, trip_id: int, data: dict, user_id: int = None):
    data = dict(data)
    data["category"] = _coerce_enum(ExpenseCategory, data.get("category", "misc"))
    expense = TripExpense(trip_id=trip_id, entered_by=user_id, **data)
    db.add(expense)
    await db.flush()

    # Update trip total
    trip = await get_trip(db, trip_id)
    if trip:
        total_result = await db.execute(
            select(func.sum(TripExpense.amount)).where(TripExpense.trip_id == trip_id)
        )
        trip.total_expense = total_result.scalar() or 0
        trip.profit_loss = float(trip.revenue or 0) - float(trip.total_expense or 0)

    return expense


async def verify_expense(db: AsyncSession, expense_id: int, user_id: int, remarks: str = None):
    result = await db.execute(select(TripExpense).where(TripExpense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        return None
    expense.is_verified = True
    expense.verified_by = user_id
    expense.verified_at = datetime.utcnow()
    expense.verification_remarks = remarks
    return expense


# --- Fuel Entries ---
async def list_trip_fuel(db: AsyncSession, trip_id: int):
    result = await db.execute(
        select(TripFuelEntry).where(TripFuelEntry.trip_id == trip_id).order_by(TripFuelEntry.fuel_date.desc())
    )
    return result.scalars().all()


async def add_trip_fuel(db: AsyncSession, trip_id: int, data: dict):
    trip = await get_trip(db, trip_id)
    if not trip:
        return None
    fuel = TripFuelEntry(trip_id=trip_id, vehicle_id=trip.vehicle_id, **data)
    db.add(fuel)
    await db.flush()

    # Update trip fuel totals
    total_fuel = await db.execute(
        select(func.sum(TripFuelEntry.total_amount)).where(TripFuelEntry.trip_id == trip_id)
    )
    trip.fuel_cost = total_fuel.scalar() or 0
    total_litres = await db.execute(
        select(func.sum(TripFuelEntry.quantity_litres)).where(TripFuelEntry.trip_id == trip_id)
    )
    trip.actual_fuel_litres = total_litres.scalar() or 0

    return fuel


async def get_trip_with_details(db: AsyncSession, trip: Trip) -> dict:
    """Build response dict with related data."""
    job_number = None
    if trip.job_id:
        result = await db.execute(select(Job.job_number).where(Job.id == trip.job_id))
        job_number = result.scalar_one_or_none()

    lr_count = (await db.execute(select(func.count(LR.id)).where(LR.trip_id == trip.id))).scalar() or 0
    expense_count = (await db.execute(select(func.count(TripExpense.id)).where(TripExpense.trip_id == trip.id))).scalar() or 0

    return {
        **{c.key: getattr(trip, c.key) for c in trip.__table__.columns},
        "job_number": job_number,
        "status": trip.status.value if hasattr(trip.status, 'value') else str(trip.status),
        "lr_count": lr_count,
        "expense_count": expense_count,
    }
