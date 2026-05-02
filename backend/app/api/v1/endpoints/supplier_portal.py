# Supplier Portal API Endpoints
# Transport ERP — Phase D: Supplier Self-Service Portal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.postgres.connection import get_db
from app.core.security import get_current_user, TokenData
from app.services import portal_service
from app.schemas.portal import SupplierInvoiceSubmit

router = APIRouter()


@router.post("/login")
async def supplier_login(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Supplier login by email."""
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    result = await portal_service.authenticate_supplier(db, email)
    if not result:
        raise HTTPException(status_code=401, detail="No supplier account found with this email")
    return {"success": True, "data": result, "message": "Supplier login successful"}


@router.get("/trips")
async def list_trips(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """List supplier's market trips."""
    if "supplier" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Supplier portal access only")
    data = await portal_service.get_supplier_trips(
        db, supplier_id=current_user.user_id, status=status, skip=skip, limit=limit,
    )
    return {"success": True, "data": data}


@router.get("/trips/{trip_id}")
async def get_trip_detail(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get detailed trip info including related job."""
    if "supplier" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Supplier portal access only")
    data = await portal_service.get_supplier_trip_detail(
        db, trip_id=trip_id, supplier_id=current_user.user_id,
    )
    if not data:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"success": True, "data": data}


@router.post("/trips/{trip_id}/invoice")
async def submit_invoice(
    trip_id: int,
    payload: SupplierInvoiceSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Submit invoice for a completed trip."""
    if "supplier" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Supplier portal access only")

    from app.models.postgres.market_trip import MarketTrip
    from sqlalchemy import select

    trip_result = await db.execute(
        select(MarketTrip).where(
            MarketTrip.id == trip_id,
            MarketTrip.supplier_id == current_user.user_id,
        )
    )
    trip = trip_result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.status not in ("completed", "delivered"):
        raise HTTPException(status_code=400, detail="Invoice can only be submitted for completed trips")

    trip.invoice_submitted = True
    trip.invoice_amount = payload.amount
    trip.invoice_number_supplier = payload.invoice_number
    trip.invoice_remarks = payload.remarks
    await db.commit()
    await db.refresh(trip)

    return {
        "success": True,
        "data": {"trip_id": trip.id, "invoice_submitted": True},
        "message": "Invoice submitted successfully",
    }


@router.get("/payments")
async def list_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """List supplier's payment / settlement history."""
    if "supplier" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Supplier portal access only")
    data = await portal_service.get_supplier_payments(
        db, supplier_id=current_user.user_id, skip=skip, limit=limit,
    )
    return {"success": True, "data": data}


@router.get("/statement")
async def get_statement(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get supplier's account statement summary."""
    if "supplier" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Supplier portal access only")

    from app.models.postgres.market_trip import MarketTrip
    from sqlalchemy import select, func

    supplier_id = current_user.user_id

    total_q = await db.execute(
        select(
            func.count(MarketTrip.id).label("total_trips"),
            func.coalesce(func.sum(MarketTrip.net_payable), 0).label("total_earned"),
        ).where(MarketTrip.supplier_id == supplier_id)
    )
    row = total_q.first()

    settled_q = await db.execute(
        select(
            func.count(MarketTrip.id).label("settled_count"),
            func.coalesce(func.sum(MarketTrip.net_payable), 0).label("settled_amount"),
        ).where(
            MarketTrip.supplier_id == supplier_id,
            MarketTrip.status == "settled",
        )
    )
    settled = settled_q.first()

    return {
        "success": True,
        "data": {
            "total_trips": row.total_trips if row else 0,
            "total_earned": float(row.total_earned) if row else 0,
            "settled_trips": settled.settled_count if settled else 0,
            "settled_amount": float(settled.settled_amount) if settled else 0,
            "pending_amount": float((row.total_earned or 0) - (settled.settled_amount or 0)),
        },
    }
