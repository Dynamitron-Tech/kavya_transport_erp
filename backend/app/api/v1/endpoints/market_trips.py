# Market Trip Management Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.market_trip import MarketTripCreate, MarketTripUpdate, MarketTripAssign, MarketTripSettle
from app.services import market_trip_service

router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_market_trips(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=500),
    search: Optional[str] = None, status: Optional[str] = None,
    supplier_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    trips, total = await market_trip_service.list_market_trips(db, page, limit, search, status, supplier_id)
    pages = (total + limit - 1) // limit
    items = []
    for t in trips:
        row = {c.key: getattr(t, c.key) for c in t.__table__.columns}
        row["margin"] = t.margin
        row["margin_pct"] = round(t.margin_pct, 2)
        items.append(row)
    return APIResponse(
        success=True, data=items,
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


@router.get("/{trip_id}", response_model=APIResponse)
async def get_market_trip(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    trip = await market_trip_service.get_market_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Market trip not found")
    data = {c.key: getattr(trip, c.key) for c in trip.__table__.columns}
    data["margin"] = trip.margin
    data["margin_pct"] = round(trip.margin_pct, 2)
    return APIResponse(success=True, data=data)


@router.post("", response_model=APIResponse, status_code=201)
async def create_market_trip(
    data: MarketTripCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    trip_data = data.model_dump(exclude_unset=True)
    trip_data["created_by"] = current_user.user_id
    trip = await market_trip_service.create_market_trip(db, trip_data)
    return APIResponse(success=True, data={"id": trip.id}, message="Market trip created")


@router.put("/{trip_id}", response_model=APIResponse)
async def update_market_trip(
    trip_id: int, data: MarketTripUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    trip = await market_trip_service.update_market_trip(db, trip_id, data.model_dump(exclude_unset=True))
    if not trip:
        raise HTTPException(status_code=404, detail="Market trip not found")
    return APIResponse(success=True, message="Market trip updated")


@router.put("/{trip_id}/assign", response_model=APIResponse)
async def assign_vehicle(
    trip_id: int, data: MarketTripAssign,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    try:
        trip = await market_trip_service.assign_vehicle(db, trip_id, data.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not trip:
        raise HTTPException(status_code=404, detail="Market trip not found")
    return APIResponse(success=True, message="Vehicle assigned to market trip")


@router.put("/{trip_id}/start", response_model=APIResponse)
async def start_transit(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    try:
        trip = await market_trip_service.start_transit(db, trip_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not trip:
        raise HTTPException(status_code=404, detail="Market trip not found")
    return APIResponse(success=True, message="Market trip in transit")


@router.put("/{trip_id}/deliver", response_model=APIResponse)
async def deliver(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    try:
        trip = await market_trip_service.complete_delivery(db, trip_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not trip:
        raise HTTPException(status_code=404, detail="Market trip not found")
    return APIResponse(success=True, message="Market trip delivered")


@router.post("/{trip_id}/settle", response_model=APIResponse)
async def settle(
    trip_id: int, data: MarketTripSettle,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    try:
        trip = await market_trip_service.settle(db, trip_id, data.settlement_reference, data.settlement_remarks)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not trip:
        raise HTTPException(status_code=404, detail="Market trip not found")
    return APIResponse(success=True, message="Market trip settled")


@router.put("/{trip_id}/cancel", response_model=APIResponse)
async def cancel(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    try:
        trip = await market_trip_service.cancel_market_trip(db, trip_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not trip:
        raise HTTPException(status_code=404, detail="Market trip not found")
    return APIResponse(success=True, message="Market trip cancelled")


@router.get("/{trip_id}/pnl", response_model=APIResponse)
async def get_pnl(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    pnl = await market_trip_service.get_pnl(db, trip_id)
    if not pnl:
        raise HTTPException(status_code=404, detail="Market trip not found")
    return APIResponse(success=True, data=pnl)
