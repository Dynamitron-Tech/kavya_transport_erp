# PA Dashboard Endpoints — stats summary + priority action cards
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse
from app.models.postgres.job import Job
from app.models.postgres.trip import Trip
from app.models.postgres.eway_bill import EwayBill
from app.models.postgres.lr import LR
from app.models.postgres.client import Client
from app.models.postgres.vehicle import Vehicle

logger = logging.getLogger(__name__)
router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/pa/dashboard/stats
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/stats", response_model=APIResponse)
async def pa_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_READ)),
):
    """Four KPI numbers for the PA dashboard + earliest expiring EWB info."""
    now = datetime.utcnow()
    six_hours_later = now + timedelta(hours=6)

    # Jobs awaiting LR: status = IN_PROGRESS (vehicle assigned, trip being created)
    jobs_lr_res = await db.execute(
        select(func.count()).select_from(Job).where(
            Job.status.in_(["IN_PROGRESS", "DOCUMENTATION"]),
            Job.is_deleted.is_(False),
        )
    )
    jobs_awaiting_lr = jobs_lr_res.scalar() or 0

    # EWBs expiring within 6 hours
    ewb_expiring_res = await db.execute(
        select(func.count()).select_from(EwayBill).where(
            EwayBill.status.in_(["ACTIVE", "GENERATED", "EXTENDED"]),
            EwayBill.valid_until <= six_hours_later,
            EwayBill.valid_until >= now,
        )
    )
    ewb_expiring = ewb_expiring_res.scalar() or 0

    # Trips in transit
    trips_transit_res = await db.execute(
        select(func.count()).select_from(Trip).where(
            Trip.status.in_(["IN_TRANSIT", "STARTED"]),
            Trip.is_deleted.is_(False),
        )
    )
    trips_in_transit = trips_transit_res.scalar() or 0

    # POD pending closure: status = COMPLETED but trip not yet invoiced
    pods_pending_res = await db.execute(
        select(func.count()).select_from(Trip).where(
            Trip.status == "COMPLETED",
            Trip.is_deleted.is_(False),
        )
    )
    pods_pending = pods_pending_res.scalar() or 0

    # Earliest expiring EWB details (for alert banner)
    earliest_ewb_res = await db.execute(
        select(EwayBill, LR)
        .join(LR, LR.id == EwayBill.lr_id, isouter=True)
        .where(
            EwayBill.status.in_(["ACTIVE", "GENERATED", "EXTENDED"]),
            EwayBill.valid_until <= six_hours_later,
            EwayBill.valid_until >= now,
        )
        .order_by(EwayBill.valid_until.asc())
        .limit(1)
    )
    earliest_row = earliest_ewb_res.first()
    earliest_ewb_id = None
    earliest_ewb_lr_number = None
    hours_until_expiry = None

    if earliest_row:
        ewb_obj, lr_obj = earliest_row
        earliest_ewb_id = ewb_obj.id
        earliest_ewb_lr_number = lr_obj.lr_number if lr_obj else None
        delta = ewb_obj.valid_until - now
        hours_until_expiry = round(delta.total_seconds() / 3600, 2)

    return APIResponse(
        success=True,
        data={
            "jobs_awaiting_lr": jobs_awaiting_lr,
            "ewb_expiring": ewb_expiring,
            "trips_in_transit": trips_in_transit,
            "pods_pending": pods_pending,
            "earliest_ewb_id": earliest_ewb_id,
            "earliest_ewb_lr_number": earliest_ewb_lr_number,
            "hours_until_expiry": hours_until_expiry,
        },
    )


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/pa/dashboard/priority-actions
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/priority-actions", response_model=APIResponse)
async def pa_priority_actions(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_READ)),
):
    """
    Return up to 5 highest-priority job cards for the PA action queue.
    Priority order: POD_UPLOADED → EWB_EXPIRING → VEHICLE_ASSIGNED → LR_CREATED
    """
    now = datetime.utcnow()
    six_hours_later = now + timedelta(hours=6)
    actions: list[dict] = []

    # ── 1. POD uploaded (trip completed, needs closure)
    pod_res = await db.execute(
        select(Trip, Job, Client, Vehicle)
        .join(Job, Job.id == Trip.job_id, isouter=True)
        .join(Client, Client.id == Job.client_id, isouter=True)
        .join(Vehicle, Vehicle.id == Trip.vehicle_id, isouter=True)
        .where(
            Trip.status == "COMPLETED",
            Trip.is_deleted.is_(False),
        )
        .order_by(Trip.updated_at.asc())
        .limit(5)
    )
    for trip, job, client, vehicle in pod_res.fetchall():
        if job:
            actions.append(_build_action(job, trip, client, vehicle, "POD_UPLOADED", None, None))

    # ── 2. EWB expiring
    ewb_exp_res = await db.execute(
        select(EwayBill, LR, Job, Client, Vehicle)
        .join(LR, LR.id == EwayBill.lr_id, isouter=True)
        .join(Job, Job.id == LR.job_id, isouter=True)
        .join(Client, Client.id == Job.client_id, isouter=True)
        .join(Vehicle, Vehicle.id == LR.vehicle_id, isouter=True)
        .where(
            EwayBill.status.in_(["ACTIVE", "GENERATED", "EXTENDED"]),
            EwayBill.valid_until <= six_hours_later,
            EwayBill.valid_until >= now,
        )
        .order_by(EwayBill.valid_until.asc())
        .limit(5)
    )
    for ewb, lr, job, client, vehicle in ewb_exp_res.fetchall():
        if job:
            actions.append(_build_action(job, None, client, vehicle, "EWB_EXPIRING", None, ewb))

    # ── 3. Vehicle assigned → needs LR
    va_res = await db.execute(
        select(Job, Client)
        .join(Client, Client.id == Job.client_id, isouter=True)
        .where(
            Job.status.in_(["IN_PROGRESS", "DOCUMENTATION"]),
            Job.is_deleted.is_(False),
        )
        .order_by(Job.pickup_date.asc())
        .limit(5)
    )
    for job, client in va_res.fetchall():
        actions.append(_build_action(job, None, client, None, "VEHICLE_ASSIGNED", None, None))

    # ── 4. LR created → needs trip sheet
    lr_res = await db.execute(
        select(Job, Trip, Client, Vehicle)
        .join(Trip, Trip.job_id == Job.id, isouter=True)
        .join(Client, Client.id == Job.client_id, isouter=True)
        .join(Vehicle, Vehicle.id == Trip.vehicle_id, isouter=True)
        .where(
            Job.status.in_(["IN_PROGRESS", "TRIP_CREATED"]),
            Job.is_deleted.is_(False),
        )
        .order_by(Job.pickup_date.asc())
        .limit(5)
    )
    for job, trip, client, vehicle in lr_res.fetchall():
        actions.append(_build_action(job, trip, client, vehicle, "LR_CREATED", None, None))

    # Deduplicate by job_id and cut to 5
    seen: set[int] = set()
    unique_actions: list[dict] = []
    for item in actions:
        if item["job_id"] not in seen:
            seen.add(item["job_id"])
            unique_actions.append(item)
        if len(unique_actions) >= 5:
            break

    return APIResponse(success=True, data=unique_actions)


def _build_action(
    job: Job,
    trip: Trip | None,
    client: Client | None,
    vehicle: Vehicle | None,
    display_status: str,
    lr: LR | None,
    ewb: EwayBill | None,
) -> dict:
    route_str = f"{job.origin_city or ''} → {job.destination_city or ''}"
    return {
        "job_id": job.id,
        "job_number": job.job_number,
        "client_name": client.name if client else "—",
        "route": route_str,
        "freight_amount": float(job.total_amount or 0),
        "weight": float(job.quantity or 0),
        "vehicle_reg": vehicle.registration_number if vehicle else None,
        "status": display_status,
        "trip_id": trip.id if trip else None,
        "ewb_id": ewb.id if ewb else None,
        "ewb_expires_at": ewb.valid_until.isoformat() if ewb else None,
    }
