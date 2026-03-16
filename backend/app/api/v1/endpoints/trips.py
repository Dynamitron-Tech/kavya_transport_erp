# Trip Management Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.trip import TripCreate, TripUpdate, TripStatusChange, TripExpenseCreate, TripFuelCreate
from app.services import trip_service
from app.models.postgres.job import Job
from app.models.postgres.vehicle import Vehicle
from app.models.postgres.driver import Driver
from app.models.postgres.lr import LR
from app.models.postgres.route import Route

router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_trips(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None, status: Optional[str] = None,
    vehicle_id: Optional[int] = None, driver_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_READ)),
):
    trips, total = await trip_service.list_trips(db, page, limit, search, status, vehicle_id, driver_id)
    pages = (total + limit - 1) // limit
    items = []
    for trip in trips:
        items.append(await trip_service.get_trip_with_details(db, trip))
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/{trip_id}", response_model=APIResponse)
async def get_trip(trip_id: int, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    trip = await trip_service.get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    data = await trip_service.get_trip_with_details(db, trip)
    return APIResponse(success=True, data=data)


@router.post("", response_model=APIResponse, status_code=201)
async def create_trip(
    data: TripCreate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_CREATE)),
):
    trip = await trip_service.create_trip(db, data.model_dump(), current_user.user_id)
    return APIResponse(success=True, data={"id": trip.id, "trip_number": trip.trip_number}, message="Trip created")


@router.put("/{trip_id}", response_model=APIResponse)
async def update_trip(
    trip_id: int, data: TripUpdate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_UPDATE)),
):
    trip = await trip_service.update_trip(db, trip_id, data.model_dump(exclude_unset=True))
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return APIResponse(success=True, message="Trip updated")


@router.delete("/{trip_id}", response_model=APIResponse)
async def delete_trip(
    trip_id: int, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_DELETE)),
):
    success = await trip_service.delete_trip(db, trip_id)
    if not success:
        raise HTTPException(status_code=404, detail="Trip not found")
    return APIResponse(success=True, message="Trip deleted")


@router.post("/{trip_id}/status", response_model=APIResponse)
async def change_trip_status(
    trip_id: int, data: TripStatusChange, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_UPDATE)),
):
    trip, error = await trip_service.change_trip_status(
        db, trip_id, data.status, current_user.user_id, data.remarks,
        data.odometer_reading, data.latitude, data.longitude, data.location_name,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return APIResponse(success=True, message=f"Trip status changed to {data.status}")


@router.put("/{trip_id}/start", response_model=APIResponse)
async def start_trip(
    trip_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_UPDATE)),
):
    odometer = payload.get("start_odometer") if isinstance(payload, dict) else None
    trip, error = await trip_service.change_trip_status(
        db,
        trip_id,
        "started",
        current_user.user_id,
        "Trip started",
        odometer_reading=odometer,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return APIResponse(success=True, data={"id": trip.id}, message="Trip started")


@router.put("/{trip_id}/reach", response_model=APIResponse)
async def reach_trip_destination(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_UPDATE)),
):
    trip, error = await trip_service.change_trip_status(
        db,
        trip_id,
        "unloading",
        current_user.user_id,
        "Reached destination",
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return APIResponse(success=True, data={"id": trip.id}, message="Trip marked as reached")


@router.put("/{trip_id}/close", response_model=APIResponse)
async def close_trip(
    trip_id: int,
    payload: dict | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_UPDATE)),
):
    odometer = None
    if isinstance(payload, dict):
        odometer = payload.get("end_odometer")
    trip, error = await trip_service.change_trip_status(
        db,
        trip_id,
        "completed",
        current_user.user_id,
        "Trip closed",
        odometer_reading=odometer,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return APIResponse(success=True, data={"id": trip.id}, message="Trip closed")


# --- Expenses ---
@router.get("/{trip_id}/expenses", response_model=APIResponse)
async def list_expenses(trip_id: int, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    expenses = await trip_service.list_trip_expenses(db, trip_id)
    items = [{c.key: getattr(e, c.key) for c in e.__table__.columns} for e in expenses]
    return APIResponse(success=True, data=items)


@router.post("/{trip_id}/expenses", response_model=APIResponse, status_code=201)
async def add_expense(
    trip_id: int, data: TripExpenseCreate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EXPENSE_CREATE)),
):
    trip = await trip_service.get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    expense = await trip_service.add_trip_expense(db, trip_id, data.model_dump(), current_user.user_id)
    return APIResponse(success=True, data={"id": expense.id}, message="Expense added")


@router.post("/expenses/{expense_id}/verify", response_model=APIResponse)
async def verify_expense(
    expense_id: int, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EXPENSE_VERIFY)),
):
    expense = await trip_service.verify_expense(db, expense_id, current_user.user_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return APIResponse(success=True, message="Expense verified")


# --- Fuel ---
@router.get("/{trip_id}/fuel", response_model=APIResponse)
async def list_fuel(trip_id: int, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    entries = await trip_service.list_trip_fuel(db, trip_id)
    items = [{c.key: getattr(f, c.key) for c in f.__table__.columns} for f in entries]
    return APIResponse(success=True, data=items)


@router.post("/{trip_id}/fuel", response_model=APIResponse, status_code=201)
async def add_fuel(
    trip_id: int, data: TripFuelCreate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    fuel = await trip_service.add_trip_fuel(db, trip_id, data.model_dump())
    if not fuel:
        raise HTTPException(status_code=404, detail="Trip not found")
    return APIResponse(success=True, data={"id": fuel.id}, message="Fuel entry added")


# ── Lookup endpoints ─────────────────────────────────────
@router.get("/next-trip-number", response_model=APIResponse)
async def next_trip_number(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    from app.utils.generators import generate_trip_number
    return APIResponse(success=True, data={"trip_number": generate_trip_number()})


@router.get("/lookup/jobs", response_model=APIResponse)
async def lookup_jobs(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    query = select(Job.id, Job.job_number, Job.origin_city, Job.destination_city).where(Job.is_deleted == False)
    if search:
        query = query.where(Job.job_number.ilike(f"%{search}%"))
    query = query.order_by(Job.id.desc()).limit(50)
    result = await db.execute(query)
    items = [{"id": r.id, "job_number": r.job_number, "origin_city": r.origin_city, "destination_city": r.destination_city} for r in result.all()]
    return APIResponse(success=True, data=items)


@router.get("/lookup/vehicles", response_model=APIResponse)
async def lookup_vehicles(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    query = select(Vehicle.id, Vehicle.registration_number, Vehicle.vehicle_type).where(Vehicle.is_deleted == False)
    if search:
        query = query.where(Vehicle.registration_number.ilike(f"%{search}%"))
    query = query.order_by(Vehicle.registration_number).limit(50)
    result = await db.execute(query)
    items = [{"id": r.id, "registration_number": r.registration_number, "vehicle_type": r.vehicle_type} for r in result.all()]
    return APIResponse(success=True, data=items)


@router.get("/lookup/drivers", response_model=APIResponse)
async def lookup_drivers(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    query = select(Driver.id, Driver.first_name, Driver.last_name, Driver.phone).where(Driver.is_deleted == False)
    if search:
        query = query.where(Driver.first_name.ilike(f"%{search}%"))
    query = query.order_by(Driver.first_name).limit(50)
    result = await db.execute(query)
    items = [{"id": r.id, "name": f"{r.first_name} {r.last_name}".strip(), "phone": r.phone} for r in result.all()]
    return APIResponse(success=True, data=items)


@router.get("/lookup/lrs", response_model=APIResponse)
async def lookup_lrs(
    job_id: Optional[int] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    query = select(LR).where(LR.is_deleted == False)
    if job_id:
        query = query.where(LR.job_id == job_id)
    if search:
        query = query.where(LR.lr_number.ilike(f"%{search}%"))
    query = query.order_by(LR.id.desc()).limit(50)
    result = await db.execute(query)
    items = [{c.key: getattr(lr, c.key) for c in lr.__table__.columns} for lr in result.scalars().all()]
    return APIResponse(success=True, data=items)


@router.get("/lookup/routes", response_model=APIResponse)
async def lookup_routes(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    query = select(Route).limit(50)
    if search:
        query = query.where(Route.name.ilike(f"%{search}%"))
    result = await db.execute(query)
    items = [{c.key: getattr(r, c.key) for c in r.__table__.columns} for r in result.scalars().all()]
    return APIResponse(success=True, data=items)


@router.get("/lookup/trip-types", response_model=APIResponse)
async def lookup_trip_types(current_user: TokenData = Depends(get_current_user)):
    types = [
        {"value": "ftl", "label": "Full Truck Load (FTL)"},
        {"value": "ptl", "label": "Part Truck Load (PTL)"},
        {"value": "express", "label": "Express"},
        {"value": "local", "label": "Local"},
        {"value": "return", "label": "Return Trip"},
    ]
    return APIResponse(success=True, data=types)


@router.get("/lookup/priorities", response_model=APIResponse)
async def lookup_priorities(current_user: TokenData = Depends(get_current_user)):
    priorities = [
        {"value": "low", "label": "Low"},
        {"value": "normal", "label": "Normal"},
        {"value": "high", "label": "High"},
        {"value": "urgent", "label": "Urgent"},
    ]
    return APIResponse(success=True, data=priorities)
