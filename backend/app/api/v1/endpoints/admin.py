from typing import Dict, Optional
import importlib

from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import TokenData, get_current_user
from app.db.mongodb.connection import MongoDB
from app.db.postgres.connection import get_db
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse

router = APIRouter()


@router.get("/health", response_model=APIResponse)
async def admin_health(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    roles = {role.lower() for role in (current_user.roles or [])}
    if "admin" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    checks: Dict[str, str] = {
        "postgresql": "error",
        "mongodb": "error",
        "redis": "error",
        "celery": "stopped",
    }

    # PostgreSQL
    try:
        await db.execute(text("SELECT 1"))
        checks["postgresql"] = "connected"
    except Exception:
        checks["postgresql"] = "error"

    # MongoDB
    try:
        if MongoDB.client is not None:
            await MongoDB.client.admin.command("ping")
            checks["mongodb"] = "connected"
        else:
            checks["mongodb"] = "error"
    except Exception:
        checks["mongodb"] = "error"

    # Redis
    try:
        import redis.asyncio as redis

        redis_client = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2, socket_timeout=2)
        await redis_client.ping()
        checks["redis"] = "connected"
        await redis_client.close()
    except Exception:
        checks["redis"] = "error"

    # Celery worker
    try:
        celery_module = importlib.import_module("celery")
        Celery = getattr(celery_module, "Celery")
        celery_app = Celery("transport_erp", broker=settings.REDIS_URL)
        inspector = celery_app.control.inspect(timeout=1)
        ping_result = inspector.ping() if inspector else None
        checks["celery"] = "running" if ping_result else "stopped"
    except Exception:
        checks["celery"] = "stopped"

    return APIResponse(success=True, data=checks, message="ok")


# ==================== TRIP COMPLETION APPROVAL ====================

def _require_admin(current_user: TokenData) -> None:
    roles = {str(r).lower() for r in (current_user.roles or [])}
    if "admin" not in roles and "fleet_manager" not in roles:
        raise HTTPException(status_code=403, detail="Admin or Fleet Manager access required")


@router.get("/trips/pending-completion", response_model=APIResponse)
async def admin_trips_pending_completion(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_UPDATE)),
):
    """List trips that are COMPLETED but not yet payment-approved by admin."""
    _require_admin(current_user)
    from app.models.postgres.trip import Trip, TripStatus
    from app.models.postgres.driver import Driver

    q = (
        select(
            Trip.id, Trip.trip_number, Trip.driver_id, Trip.driver_name,
            Trip.origin, Trip.destination, Trip.driver_pay,
            Trip.actual_end, Trip.status, Trip.payment_approved,
        )
        .where(
            Trip.status == TripStatus.COMPLETED,
            Trip.payment_approved == False,
            Trip.is_deleted == False,
            Trip.driver_pay > 0,
        )
        .order_by(Trip.actual_end.desc().nullslast())
        .limit(100)
    )
    result = await db.execute(q)
    items = [
        {
            "id": r[0], "trip_number": r[1], "driver_id": r[2],
            "driver_name": r[3], "origin": r[4], "destination": r[5],
            "driver_pay": float(r[6] or 0), "actual_end": str(r[7]) if r[7] else None,
            "status": r[8].value if hasattr(r[8], "value") else str(r[8]),
            "payment_approved": r[9],
        }
        for r in result.all()
    ]
    return APIResponse(success=True, data=items)


@router.post("/trips/{trip_id}/approve-completion", response_model=APIResponse)
async def admin_approve_trip_completion(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_UPDATE)),
):
    """Admin approves a completed trip → creates PENDING driver payment entry."""
    _require_admin(current_user)

    from app.models.postgres.trip import Trip, TripStatus
    from app.models.postgres.finance import Payment, PaymentStatus, PaymentMethod
    from datetime import date as d
    import random, string

    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.status != TripStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Trip is not in COMPLETED status")
    if trip.payment_approved:
        raise HTTPException(status_code=400, detail="Trip payment already approved")
    if not trip.driver_pay or trip.driver_pay <= 0:
        raise HTTPException(status_code=400, detail="No driver_pay amount set for this trip")

    # Mark trip as payment-approved
    from datetime import datetime as dt
    trip.payment_approved = True
    trip.payment_approved_at = dt.utcnow()
    trip.payment_approved_by = current_user.user_id

    # Generate a unique payment number
    suffix = ''.join(random.choices(string.digits, k=6))
    pay_number = f"DPY-{suffix}"

    payment = Payment(
        payment_number=pay_number,
        payment_date=d.today(),
        payment_type="paid",               # outgoing – company pays driver
        trip_id=trip.id,
        driver_id=trip.driver_id,
        source_ref=f"trip_pay:{trip.trip_number}",
        amount=trip.driver_pay,
        net_amount=trip.driver_pay,
        currency="INR",
        payment_method=PaymentMethod.BANK_TRANSFER,
        status=PaymentStatus.PENDING,
        remarks=f"Driver payment for trip {trip.trip_number} ({trip.origin} → {trip.destination})",
        tenant_id=trip.tenant_id,
        branch_id=trip.branch_id,
        created_by=current_user.user_id,
    )
    db.add(payment)
    await db.commit()

    return APIResponse(
        success=True,
        message=f"Trip completion approved. ₹{float(trip.driver_pay):,.0f} pending payment queued for driver.",
        data={"payment_number": pay_number, "amount": float(trip.driver_pay)},
    )
