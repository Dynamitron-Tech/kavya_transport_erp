# Manager Dashboard Endpoints — KPIs, sparkline, approvals
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case, extract

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse
from app.models.postgres.job import Job
from app.models.postgres.trip import Trip
from app.models.postgres.vehicle import Vehicle
from app.models.postgres.client import Client
from app.models.postgres.banking import BankingEntry

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/stats", response_model=APIResponse)
async def manager_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.JOB_READ)),
):
    """Manager dashboard KPIs."""
    now = datetime.utcnow()
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Active trips (in transit / started)
    active_trips_res = await db.execute(
        select(func.count()).select_from(Trip).where(
            Trip.status.in_(["IN_TRANSIT", "STARTED", "LOADING", "UNLOADING"]),
            Trip.is_deleted.is_(False),
        )
    )
    active_trips = active_trips_res.scalar() or 0

    # Pending assignment (jobs without vehicle)
    pending_res = await db.execute(
        select(func.count()).select_from(Job).where(
            Job.status.in_(["DRAFT", "PENDING_APPROVAL", "APPROVED"]),
            Job.is_deleted.is_(False),
        )
    )
    pending_assignment = pending_res.scalar() or 0

    # Monthly revenue (sum of total_amount from completed jobs this month)
    revenue_res = await db.execute(
        select(func.coalesce(func.sum(Job.total_amount), 0)).where(
            Job.status.in_(["COMPLETED", "CLOSED", "DELIVERED", "CLOSURE_PENDING"]),
            Job.is_deleted.is_(False),
            Job.completed_at >= first_of_month,
        )
    )
    monthly_revenue = float(revenue_res.scalar() or 0)

    # Approvals needed: pending expenses (trips with unverified expenses)
    # We'll count jobs pending approval
    approvals_res = await db.execute(
        select(func.count()).select_from(Job).where(
            Job.status == "PENDING_APPROVAL",
            Job.is_deleted.is_(False),
        )
    )
    approvals_needed = approvals_res.scalar() or 0

    # Overdue service: vehicles past service date
    overdue_svc_res = await db.execute(
        select(Vehicle).where(
            Vehicle.status != "INACTIVE",
            Vehicle.is_deleted.is_(False),
        ).order_by(Vehicle.id.asc()).limit(1)
    )
    overdue_vehicle = overdue_svc_res.scalars().first()

    return APIResponse(
        success=True,
        data={
            "active_trips": active_trips,
            "pending_assignment": pending_assignment,
            "monthly_revenue": monthly_revenue,
            "approvals_needed": approvals_needed,
            "overdue_service_count": 0,
            "overdue_service_vehicle": overdue_vehicle.registration_number if overdue_vehicle else None,
            "overdue_service_km": None,
        },
    )


@router.get("/revenue-sparkline", response_model=APIResponse)
async def manager_revenue_sparkline(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.REPORT_VIEW)),
):
    """7-day revenue sparkline data for dashboard bar chart."""
    today = datetime.utcnow().date()
    days = []
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        day_start = datetime(d.year, d.month, d.day)
        day_end = day_start + timedelta(days=1)

        rev_res = await db.execute(
            select(func.coalesce(func.sum(Job.total_amount), 0)).where(
                Job.status.in_(["COMPLETED", "CLOSED", "DELIVERED"]),
                Job.is_deleted.is_(False),
                Job.completed_at >= day_start,
                Job.completed_at < day_end,
            )
        )
        amount = float(rev_res.scalar() or 0)
        days.append({
            "day": day_names[d.weekday()],
            "amount": amount,
            "is_today": i == 0,
        })

    # Calculate week-over-week change
    this_week_total = sum(d["amount"] for d in days)
    prev_week_start = today - timedelta(days=13)
    prev_week_end = today - timedelta(days=6)
    prev_res = await db.execute(
        select(func.coalesce(func.sum(Job.total_amount), 0)).where(
            Job.status.in_(["COMPLETED", "CLOSED", "DELIVERED"]),
            Job.is_deleted.is_(False),
            Job.completed_at >= datetime(prev_week_start.year, prev_week_start.month, prev_week_start.day),
            Job.completed_at < datetime(prev_week_end.year, prev_week_end.month, prev_week_end.day),
        )
    )
    prev_week_total = float(prev_res.scalar() or 0)
    pct_change = 0
    if prev_week_total > 0:
        pct_change = round(((this_week_total - prev_week_total) / prev_week_total) * 100)

    return APIResponse(
        success=True,
        data={
            "days": days,
            "pct_change": pct_change,
        },
    )


@router.get("/approvals", response_model=APIResponse)
async def manager_approvals(
    type: Optional[str] = Query("all", regex="^(all|expenses|banking)$"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EXPENSE_APPROVE)),
):
    """Combined pending approvals: expenses + banking entries."""
    items = []

    if type in ("all", "expenses"):
        # Pending-approval jobs serve as expense approvals
        exp_res = await db.execute(
            select(Job, Client).join(Client, Client.id == Job.client_id, isouter=True).where(
                Job.status == "PENDING_APPROVAL",
                Job.is_deleted.is_(False),
            ).order_by(Job.created_at.desc()).limit(20)
        )
        for job, client in exp_res.fetchall():
            items.append({
                "id": job.id,
                "type": "expense",
                "title": f"Job {job.job_number}",
                "submitter_name": client.name if client else "—",
                "trip_number": None,
                "amount": float(job.total_amount or 0),
                "description": f"{job.origin_city} → {job.destination_city}",
                "date": job.created_at.isoformat() if job.created_at else None,
                "receipt_url": None,
                "status": "pending",
            })

    if type in ("all", "banking"):
        bank_res = await db.execute(
            select(BankingEntry).where(
                BankingEntry.reconciled.is_(False),
                BankingEntry.is_deleted.is_(False),
            ).order_by(BankingEntry.created_at.desc()).limit(20)
        )
        for entry in bank_res.scalars().all():
            items.append({
                "id": entry.id,
                "type": "banking",
                "title": entry.entry_type.value.replace("_", " ").title(),
                "submitter_name": "—",
                "trip_number": None,
                "amount": entry.amount_paise / 100,
                "description": entry.description or "",
                "date": entry.entry_date.isoformat() if entry.entry_date else None,
                "receipt_url": None,
                "status": "pending",
            })

    return APIResponse(success=True, data=items)
