# Trip Management Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.trip import TripCreate, TripUpdate, TripStatusChange, TripExpenseCreate, TripFuelCreate
from app.services import trip_service

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
