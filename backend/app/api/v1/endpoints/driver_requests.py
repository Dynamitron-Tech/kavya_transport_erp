# Driver Leave & Advance Request Endpoints
import logging
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse
from app.services.notification_service import notification_service
from app.models.postgres.driver import Driver
from app.models.postgres.trip import Trip
from app.models.postgres.user import User
from app.models.postgres.driver_requests import (
    DriverLeave,
    DriverAdvanceRequest,
    DriverSalaryAdvanceRequest,
    LeaveStatusEnum,
    AdvanceStatusEnum,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── helpers ──────────────────────────────────────────────────────────────────

async def _get_driver_id(current_user: TokenData, db: AsyncSession) -> int:
    result = await db.execute(select(Driver.id).where(Driver.user_id == current_user.user_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    return row


async def _get_driver(current_user: TokenData, db: AsyncSession) -> Driver:
    result = await db.execute(select(Driver).where(Driver.user_id == current_user.user_id))
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    return driver


def _working_days_between(start: date, today: date) -> int:
    """Count working days (Mon-Fri) from today up to (but not including) start."""
    count = 0
    cursor = today
    while cursor < start:
        if cursor.weekday() < 5:  # Mon–Fri
            count += 1
        cursor += timedelta(days=1)
    return count


# ── Schemas ───────────────────────────────────────────────────────────────────

class LeaveApplyPayload(BaseModel):
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveReviewPayload(BaseModel):
    action: str  # "approve" | "reject"
    note: Optional[str] = None


class AdvanceRequestPayload(BaseModel):
    trip_id: Optional[int] = None


# ── Driver: Apply Leave ───────────────────────────────────────────────────────

@router.post("/leaves", response_model=APIResponse)
async def apply_leave(
    payload: LeaveApplyPayload,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.TRIP_READ)),
):
    """Driver submits a leave application. Must be at least 5 working days in advance."""
    today = date.today()
    if payload.start_date <= today:
        raise HTTPException(status_code=400, detail="Leave start date must be in the future.")
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="End date cannot be before start date.")

    working_days = _working_days_between(payload.start_date, today)
    if working_days < 5:
        raise HTTPException(
            status_code=400,
            detail=f"Leave must be applied at least 5 working days in advance. Currently only {working_days} working day(s) until start date.",
        )

    driver = await _get_driver(current_user, db)

    leave = DriverLeave(
        driver_id=driver.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason,
        status=LeaveStatusEnum.PENDING,
    )
    db.add(leave)
    await db.flush()
    await db.refresh(leave)
    await db.commit()

    # Notify fleet managers
    driver_name = f"{driver.first_name or ''} {driver.last_name or ''}".strip() or "Driver"
    try:
        await notification_service.send(
            db,
            event_type="DRIVER_LEAVE_REQUEST",
            title="Leave Approval Request",
            body=f"{driver_name} has applied for leave from {payload.start_date} to {payload.end_date}",
            target_roles=["FLEET_MANAGER"],
            data={
                "leave_id": leave.id,
                "driver_id": driver.id,
                "driver_name": driver_name,
                "start_date": payload.start_date.isoformat(),
                "end_date": payload.end_date.isoformat(),
                "action_type": "leave_request",
            },
        )
    except Exception:
        pass

    return APIResponse(
        success=True,
        data={
            "id": leave.id,
            "start_date": payload.start_date.isoformat(),
            "end_date": payload.end_date.isoformat(),
            "status": "PENDING",
        },
        message="Leave application submitted successfully.",
    )


@router.get("/leaves", response_model=APIResponse)
async def list_my_leaves(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.TRIP_READ)),
):
    """Driver lists their own leave applications."""
    driver_id = await _get_driver_id(current_user, db)
    result = await db.execute(
        select(DriverLeave)
        .where(DriverLeave.driver_id == driver_id)
        .order_by(DriverLeave.created_at.desc())
    )
    leaves = result.scalars().all()
    data = [
        {
            "id": l.id,
            "start_date": l.start_date.isoformat(),
            "end_date": l.end_date.isoformat(),
            "reason": l.reason,
            "status": l.status.value,
            "review_note": l.review_note,
            "created_at": l.created_at.isoformat(),
        }
        for l in leaves
    ]
    return APIResponse(success=True, data=data)


# ── Fleet Manager: Review Leave ───────────────────────────────────────────────

@router.post("/leaves/{leave_id}/review", response_model=APIResponse)
async def review_leave(
    leave_id: int,
    payload: LeaveReviewPayload,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.DRIVER_READ)),
):
    """Fleet manager approves or rejects a leave application."""
    if payload.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    result = await db.execute(select(DriverLeave).where(DriverLeave.id == leave_id))
    leave = result.scalar_one_or_none()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if leave.status != LeaveStatusEnum.PENDING:
        raise HTTPException(status_code=400, detail="Leave request already reviewed")

    # Fetch reviewer's display name
    reviewer_result = await db.execute(
        select(User).where(User.id == current_user.user_id)
    )
    reviewer = reviewer_result.scalar_one_or_none()
    reviewer_name = (
        f"{reviewer.first_name or ''} {reviewer.last_name or ''}".strip()
        if reviewer else "Fleet Manager"
    ) or "Fleet Manager"

    leave.status = LeaveStatusEnum.APPROVED if payload.action == "approve" else LeaveStatusEnum.REJECTED
    leave.reviewed_by = current_user.user_id
    leave.reviewed_at = datetime.utcnow()
    leave.review_note = payload.note
    await db.flush()
    await db.commit()

    # Notify the driver
    start_str = leave.start_date.isoformat()
    end_str = leave.end_date.isoformat()
    result2 = await db.execute(select(Driver).where(Driver.id == leave.driver_id))
    driver = result2.scalar_one_or_none()

    if driver:
        if payload.action == "approve":
            body = f"Your Leave Request is approved from {start_str} to {end_str} by {reviewer_name}"
        else:
            body = f"Your Leave Request is rejected for the {start_str} to {end_str} by {reviewer_name}"
        try:
            await notification_service.send(
                db,
                event_type="DRIVER_LEAVE_REVIEWED",
                title="Leave Request " + ("Approved" if payload.action == "approve" else "Rejected"),
                body=body,
                target_user_ids=[driver.user_id] if driver.user_id else [],
                data={
                    "leave_id": leave.id,
                    "action": payload.action,
                    "start_date": start_str,
                    "end_date": end_str,
                },
            )
        except Exception:
            pass

    return APIResponse(
        success=True,
        data={"leave_id": leave.id, "status": leave.status.value},
        message=f"Leave request {payload.action}d successfully.",
    )


@router.get("/leaves/pending", response_model=APIResponse)
async def list_pending_leaves(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.DRIVER_READ)),
):
    """Fleet manager: list all pending leave applications."""
    result = await db.execute(
        select(DriverLeave, Driver)
        .join(Driver, Driver.id == DriverLeave.driver_id)
        .where(DriverLeave.status == LeaveStatusEnum.PENDING)
        .order_by(DriverLeave.created_at.desc())
    )
    rows = result.all()
    data = [
        {
            "id": l.id,
            "driver_id": l.driver_id,
            "driver_name": f"{d.first_name or ''} {d.last_name or ''}".strip(),
            "start_date": l.start_date.isoformat(),
            "end_date": l.end_date.isoformat(),
            "reason": l.reason,
            "status": l.status.value,
            "created_at": l.created_at.isoformat(),
        }
        for l, d in rows
    ]
    return APIResponse(success=True, data=data)


# ── Driver: Request Advance ───────────────────────────────────────────────────

@router.post("/advance-requests", response_model=APIResponse)
async def request_advance(
    payload: AdvanceRequestPayload,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.TRIP_READ)),
):
    """Driver requests a ₹1500 advance, optionally for a specific trip."""
    driver = await _get_driver(current_user, db)

    # Validate trip belongs to driver if provided
    trip_number = None
    if payload.trip_id:
        trip_result = await db.execute(select(Trip).where(Trip.id == payload.trip_id))
        trip = trip_result.scalar_one_or_none()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        if trip.driver_id != driver.id:
            raise HTTPException(status_code=403, detail="Not your trip")
        trip_number = trip.trip_number

    advance = DriverAdvanceRequest(
        driver_id=driver.id,
        trip_id=payload.trip_id,
        amount=1500,
        status=AdvanceStatusEnum.PENDING,
    )
    db.add(advance)
    await db.flush()
    await db.refresh(advance)
    await db.commit()

    driver_name = f"{driver.first_name or ''} {driver.last_name or ''}".strip() or "Driver"
    trip_label = f"Trip:{trip_number}" if trip_number else "no specific trip"
    try:
        await notification_service.send(
            db,
            event_type="DRIVER_ADVANCE_REQUEST",
            title="Advance Payment Request",
            body=f"{driver_name} has requested for Advance payment for the {trip_label}",
            target_roles=["FLEET_MANAGER"],
            data={
                "advance_id": advance.id,
                "driver_id": driver.id,
                "driver_name": driver_name,
                "trip_id": payload.trip_id,
                "trip_number": trip_number,
                "amount": 1500,
                "action_type": "advance_request",
            },
        )
    except Exception:
        pass

    return APIResponse(
        success=True,
        data={"id": advance.id, "amount": 1500, "status": "PENDING"},
        message="Advance request of ₹1500 submitted successfully.",
    )


@router.get("/advance-requests", response_model=APIResponse)
async def list_my_advance_requests(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.TRIP_READ)),
):
    """Driver lists their own advance requests."""
    driver_id = await _get_driver_id(current_user, db)
    result = await db.execute(
        select(DriverAdvanceRequest)
        .where(DriverAdvanceRequest.driver_id == driver_id)
        .order_by(DriverAdvanceRequest.created_at.desc())
    )
    items = result.scalars().all()
    data = [
        {
            "id": r.id,
            "trip_id": r.trip_id,
            "amount": float(r.amount),
            "status": r.status.value,
            "review_note": r.review_note,
            "created_at": r.created_at.isoformat(),
        }
        for r in items
    ]
    return APIResponse(success=True, data=data)


# ── Fleet Manager: List all advance requests ─────────────────────────────────

@router.get("/advance-requests/fleet", response_model=APIResponse)
async def list_fleet_advance_requests(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.DRIVER_READ)),
):
    """Fleet manager: list all advance requests (all statuses)."""
    result = await db.execute(
        select(DriverAdvanceRequest, Driver, Trip)
        .join(Driver, Driver.id == DriverAdvanceRequest.driver_id)
        .outerjoin(Trip, Trip.id == DriverAdvanceRequest.trip_id)
        .order_by(DriverAdvanceRequest.created_at.desc())
    )
    rows = result.all()
    data = [
        {
            "id": adv.id,
            "driver_id": adv.driver_id,
            "driver_name": f"{d.first_name or ''} {d.last_name or ''}".strip(),
            "trip_id": adv.trip_id,
            "trip_number": t.trip_number if t else None,
            "amount": float(adv.amount),
            "status": adv.status.value,
            "review_note": adv.review_note,
            "created_at": adv.created_at.isoformat(),
        }
        for adv, d, t in rows
    ]
    return APIResponse(success=True, data=data)


# ── Fleet Manager: Acknowledge (process) advance request ─────────────────────

class AdvanceAckPayload(BaseModel):
    note: Optional[str] = None


@router.post("/advance-requests/{advance_id}/acknowledge", response_model=APIResponse)
async def acknowledge_advance(
    advance_id: int,
    payload: AdvanceAckPayload,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.DRIVER_READ)),
):
    """Fleet manager marks an advance request as APPROVED (processed)."""
    result = await db.execute(
        select(DriverAdvanceRequest).where(DriverAdvanceRequest.id == advance_id)
    )
    advance = result.scalar_one_or_none()
    if not advance:
        raise HTTPException(status_code=404, detail="Advance request not found")
    if advance.status != AdvanceStatusEnum.PENDING:
        raise HTTPException(status_code=400, detail="Advance request already processed")

    advance.status = AdvanceStatusEnum.APPROVED
    advance.reviewed_by = current_user.user_id
    advance.reviewed_at = datetime.utcnow()
    advance.review_note = payload.note
    await db.flush()
    await db.commit()

    # Notify driver
    drv_result = await db.execute(select(Driver).where(Driver.id == advance.driver_id))
    driver = drv_result.scalar_one_or_none()
    if driver and driver.user_id:
        try:
            await notification_service.send(
                db,
                event_type="DRIVER_ADVANCE_APPROVED",
                title="Advance Request Approved",
                body=f"Your advance request of ₹{int(advance.amount)} has been approved.",
                target_user_ids=[driver.user_id],
                data={"advance_id": advance.id, "amount": float(advance.amount)},
            )
        except Exception:
            pass

    return APIResponse(
        success=True,
        data={"advance_id": advance.id, "status": "APPROVED"},
        message="Advance request marked as processed.",
    )


# ── Driver: Request Salary Advance ───────────────────────────────────────────

class SalaryAdvancePayload(BaseModel):
    amount: int  # 1 – 20000


@router.post("/salary-advance", response_model=APIResponse)
async def request_salary_advance(
    payload: SalaryAdvancePayload,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.TRIP_READ)),
):
    """Driver requests a salary advance (₹1–₹20,000). Allowed only on days 23–31."""
    today = date.today()
    if today.day < 23:
        raise HTTPException(
            status_code=400,
            detail=f"Salary advance requests are only accepted on days 23–31 of the month. Today is the {today.day}th.",
        )
    if not (1 <= payload.amount <= 20000):
        raise HTTPException(status_code=400, detail="Amount must be between ₹1 and ₹20,000.")

    driver = await _get_driver(current_user, db)

    adv = DriverSalaryAdvanceRequest(
        driver_id=driver.id,
        amount=payload.amount,
        status=AdvanceStatusEnum.PENDING,
    )
    db.add(adv)
    await db.flush()
    await db.refresh(adv)
    await db.commit()

    driver_name = f"{driver.first_name or ''} {driver.last_name or ''}".strip() or "Driver"
    try:
        await notification_service.send(
            db,
            event_type="DRIVER_SALARY_ADVANCE_REQUEST",
            title="Salary Advance Request",
            body=f"{driver_name} has requested for salary advance of amount ₹{payload.amount}",
            target_roles=["FLEET_MANAGER"],
            data={
                "salary_advance_id": adv.id,
                "driver_id": driver.id,
                "driver_name": driver_name,
                "amount": payload.amount,
                "action_type": "salary_advance_request",
            },
        )
    except Exception:
        pass

    return APIResponse(
        success=True,
        data={"id": adv.id, "amount": payload.amount, "status": "PENDING"},
        message=f"Salary advance request of ₹{payload.amount} submitted successfully.",
    )


@router.get("/salary-advance", response_model=APIResponse)
async def list_my_salary_advances(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.TRIP_READ)),
):
    """Driver lists their own salary advance requests."""
    driver_id = await _get_driver_id(current_user, db)
    result = await db.execute(
        select(DriverSalaryAdvanceRequest)
        .where(DriverSalaryAdvanceRequest.driver_id == driver_id)
        .order_by(DriverSalaryAdvanceRequest.created_at.desc())
        .limit(10)
    )
    items = result.scalars().all()
    data = [
        {
            "id": r.id,
            "amount": float(r.amount),
            "status": r.status.value,
            "review_note": r.review_note,
            "created_at": r.created_at.isoformat(),
        }
        for r in items
    ]
    return APIResponse(success=True, data=data)
