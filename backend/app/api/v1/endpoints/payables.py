# Payables Endpoints — Driver Settlements (per-trip)
# Used by: Driver "My Earnings" screen, Accountant "Settlements" screen
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional
from datetime import date, datetime
from decimal import Decimal

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse
from app.models.postgres.finance_automation import DriverSettlement, SettlementStatus
from app.models.postgres.driver import Driver
from app.models.postgres.trip import Trip
from app.models.postgres.user import User

router = APIRouter()


def _settlement_to_dict(s, driver=None, trip=None):
    """Convert DriverSettlement row to the dict format the Flutter screens expect."""
    gross_paise = int(float(s.gross_amount or 0) * 100)
    advance_paise = int(float(s.advance_deducted or 0) * 100)
    expenses_paise = int(float(s.total_deductions or 0) * 100) - advance_paise
    if expenses_paise < 0:
        expenses_paise = 0
    net_paise = int(float(s.net_amount or 0) * 100)

    status_val = s.status.value.lower() if hasattr(s.status, "value") else str(s.status).lower()

    d = {
        "id": s.id,
        "settlement_number": s.settlement_number,
        "trip_id": s.trip_id,
        "driver_id": s.driver_id,
        "gross_amount_paise": gross_paise,
        "advance_paise": advance_paise,
        "expenses_paise": expenses_paise,
        "net_amount_paise": net_paise,
        "status": status_val,
        "date_from": s.period_from.isoformat() if s.period_from else None,
        "date_to": s.period_to.isoformat() if s.period_to else None,
        "paid_date": s.paid_date.isoformat() if s.paid_date else None,
        "payment_method": s.payment_method_str,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }

    if trip:
        d["trip_date"] = trip.trip_date.isoformat() if trip.trip_date else None
        d["origin"] = trip.origin
        d["destination"] = trip.destination
    else:
        d["trip_date"] = s.period_from.isoformat() if s.period_from else None
        d["origin"] = None
        d["destination"] = None

    if driver:
        d["driver_first_name"] = driver.first_name
        d["driver_last_name"] = driver.last_name
    else:
        d["driver_first_name"] = None
        d["driver_last_name"] = None

    return d


# ─── Driver: get own earnings ────────────────────────────────────────────────

@router.get("/driver/{user_id}", response_model=APIResponse)
async def get_driver_settlements(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get settlements for a driver (identified by user_id). Used by My Earnings."""
    # Resolve user_id → driver_id
    driver_result = await db.execute(
        select(Driver).where(Driver.user_id == user_id, Driver.is_deleted == False)
    )
    driver = driver_result.scalar_one_or_none()

    if not driver:
        # Fallback: try direct driver_id
        driver = await db.get(Driver, user_id)
        if not driver:
            return APIResponse(success=True, data=[], message="No driver profile found")

    result = await db.execute(
        select(DriverSettlement)
        .where(
            DriverSettlement.driver_id == driver.id,
            DriverSettlement.is_deleted == False,
        )
        .order_by(DriverSettlement.created_at.desc())
    )
    settlements = result.scalars().all()

    # Pre-load trips for settlement rows
    trip_ids = [s.trip_id for s in settlements if s.trip_id]
    trips_map = {}
    if trip_ids:
        trip_rows = (await db.execute(select(Trip).where(Trip.id.in_(trip_ids)))).scalars().all()
        trips_map = {t.id: t for t in trip_rows}

    data = [
        _settlement_to_dict(s, driver=driver, trip=trips_map.get(s.trip_id))
        for s in settlements
    ]
    return APIResponse(success=True, data=data)


# ─── Accountant: list settlements ────────────────────────────────────────────

@router.get("/", response_model=APIResponse)
async def list_payables(
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """List driver settlements with optional status filter. Used by accountant screen."""
    query = select(DriverSettlement).where(DriverSettlement.is_deleted == False)

    if status:
        status_upper = status.strip().upper()
        try:
            status_enum = SettlementStatus(status_upper)
            query = query.where(DriverSettlement.status == status_enum)
        except ValueError:
            pass

    query = query.order_by(DriverSettlement.created_at.desc())
    result = await db.execute(query)
    settlements = result.scalars().all()

    # Pre-load drivers and trips
    driver_ids = list({s.driver_id for s in settlements})
    trip_ids = [s.trip_id for s in settlements if s.trip_id]

    drivers_map = {}
    if driver_ids:
        rows = (await db.execute(select(Driver).where(Driver.id.in_(driver_ids)))).scalars().all()
        drivers_map = {d.id: d for d in rows}

    trips_map = {}
    if trip_ids:
        rows = (await db.execute(select(Trip).where(Trip.id.in_(trip_ids)))).scalars().all()
        trips_map = {t.id: t for t in rows}

    data = [
        _settlement_to_dict(
            s,
            driver=drivers_map.get(s.driver_id),
            trip=trips_map.get(s.trip_id),
        )
        for s in settlements
    ]
    return APIResponse(success=True, data=data)


# ─── Approve settlement ──────────────────────────────────────────────────────

@router.patch("/{settlement_id}/approve", response_model=APIResponse)
async def approve_settlement(
    settlement_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    settlement = await db.get(DriverSettlement, settlement_id)
    if not settlement or settlement.is_deleted:
        raise HTTPException(status_code=404, detail="Settlement not found")
    if settlement.status != SettlementStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending settlements can be approved")

    settlement.status = SettlementStatus.APPROVED
    settlement.approved_by = current_user.user_id
    settlement.approved_at = datetime.utcnow()
    await db.commit()
    return APIResponse(success=True, message="Settlement approved")


# ─── Reject settlement ───────────────────────────────────────────────────────

@router.patch("/{settlement_id}/reject", response_model=APIResponse)
async def reject_settlement(
    settlement_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    settlement = await db.get(DriverSettlement, settlement_id)
    if not settlement or settlement.is_deleted:
        raise HTTPException(status_code=404, detail="Settlement not found")
    if settlement.status != SettlementStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending settlements can be rejected")

    settlement.status = SettlementStatus.DISPUTED
    await db.commit()
    return APIResponse(success=True, message="Settlement rejected")


# ─── Mark paid ───────────────────────────────────────────────────────────────

@router.patch("/{settlement_id}/mark-paid", response_model=APIResponse)
async def mark_settlement_paid(
    settlement_id: int,
    body: dict = Body({}),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    settlement = await db.get(DriverSettlement, settlement_id)
    if not settlement or settlement.is_deleted:
        raise HTTPException(status_code=404, detail="Settlement not found")
    if settlement.status != SettlementStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Only approved settlements can be marked paid")

    payment_method = body.get("payment_method", "NEFT")
    paid_date_str = body.get("paid_date")
    paid_date_val = date.today()
    if paid_date_str:
        try:
            paid_date_val = date.fromisoformat(paid_date_str)
        except (ValueError, TypeError):
            pass

    settlement.status = SettlementStatus.PAID
    settlement.paid_at = datetime.utcnow()
    settlement.paid_date = paid_date_val
    settlement.payment_method_str = payment_method
    await db.commit()
    return APIResponse(success=True, message="Settlement marked as paid")
