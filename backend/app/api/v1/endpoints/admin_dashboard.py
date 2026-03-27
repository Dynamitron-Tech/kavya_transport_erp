# Admin Dashboard Endpoints — KPIs, role health, compliance, finance summary
import logging
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case, update, cast, String

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse
from app.models.postgres.job import Job
from app.models.postgres.trip import Trip, TripExpense
from app.models.postgres.vehicle import Vehicle
from app.models.postgres.driver import Driver, DriverLicense
from app.models.postgres.user import User, Role, Branch, user_roles, RoleType
from app.models.postgres.finance import Invoice, InvoicePaymentStatus
from app.models.postgres.client import Client

logger = logging.getLogger(__name__)
router = APIRouter()


def _to_float(val) -> float:
    if val is None:
        return 0.0
    return float(val)


# ─── Dashboard Stats ─────────────────────────────────────────────────────────

@router.get("/dashboard/stats", response_model=APIResponse)
async def admin_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.REPORT_VIEW)),
):
    """Admin dashboard KPIs — company-wide overview."""
    now = datetime.utcnow()
    today = date.today()
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Active trips
    active_trips_r = await db.execute(
        select(func.count()).select_from(Trip).where(
            Trip.status.in_(["IN_TRANSIT", "STARTED", "LOADING", "UNLOADING"]),
            Trip.is_deleted.is_(False),
        )
    )
    active_trips = active_trips_r.scalar() or 0

    # Month revenue
    revenue_r = await db.execute(
        select(func.coalesce(func.sum(Job.total_amount), 0)).where(
            Job.status.in_(["COMPLETED", "CLOSED", "DELIVERED", "CLOSURE_PENDING"]),
            Job.is_deleted.is_(False),
            Job.completed_at >= first_of_month,
        )
    )
    month_revenue = _to_float(revenue_r.scalar())

    # Compliance alerts count
    alert_count = 0
    # Vehicles: insurance, fitness, PUC within 30 days or expired
    threshold = today + timedelta(days=30)
    for col in [Vehicle.insurance_valid_until, Vehicle.fitness_valid_until, Vehicle.puc_valid_until]:
        r = await db.execute(
            select(func.count()).select_from(Vehicle).where(
                Vehicle.is_deleted.is_(False),
                col.isnot(None),
                col <= threshold,
            )
        )
        alert_count += r.scalar() or 0
    # Drivers: license expiry within 30 days
    lic_r = await db.execute(
        select(func.count()).select_from(DriverLicense).where(
            DriverLicense.expiry_date <= threshold,
        )
    )
    alert_count += lic_r.scalar() or 0

    # Active employees
    emp_r = await db.execute(
        select(func.count()).select_from(User).where(
            User.is_active.is_(True),
            User.is_deleted.is_(False),
        )
    )
    active_employees = emp_r.scalar() or 0

    # Pending assignment
    pending_r = await db.execute(
        select(func.count()).select_from(Job).where(
            Job.status.in_(["DRAFT", "PENDING_APPROVAL", "APPROVED"]),
            Job.is_deleted.is_(False),
        )
    )
    pending_assignment = pending_r.scalar() or 0

    # Overdue amount
    overdue_r = await db.execute(
        select(func.coalesce(func.sum(Invoice.amount_due), 0)).where(
            Invoice.due_date < today,
            cast(Invoice.payment_status, String) != "PAID",
            Invoice.is_deleted.is_(False),
        )
    )
    overdue_amount = _to_float(overdue_r.scalar())

    # Total vehicles
    veh_r = await db.execute(
        select(func.count()).select_from(Vehicle).where(
            Vehicle.is_deleted.is_(False),
        )
    )
    total_vehicles = veh_r.scalar() or 0

    # Active drivers
    drv_r = await db.execute(
        select(func.count()).select_from(Driver).where(
            Driver.status == "AVAILABLE",
            Driver.is_deleted.is_(False),
        )
    )
    active_drivers = drv_r.scalar() or 0

    return APIResponse(success=True, data={
        "active_trips": active_trips,
        "month_revenue": month_revenue,
        "compliance_alerts": alert_count,
        "active_employees": active_employees,
        "pending_assignment": pending_assignment,
        "overdue_amount": overdue_amount,
        "total_vehicles": total_vehicles,
        "active_drivers": active_drivers,
    })


# ─── Role Health ──────────────────────────────────────────────────────────────

@router.get("/dashboard/role-health", response_model=APIResponse)
async def admin_role_health(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.REPORT_VIEW)),
):
    """Role health cards — overview of each department."""
    today = date.today()

    role_map = {
        "MANAGER": {"label": "Manager", "color": "blue"},
        "PROJECT_ASSOCIATE": {"label": "Project Associates", "color": "orange"},
        "FLEET_MANAGER": {"label": "Fleet Manager", "color": "green"},
        "ACCOUNTANT": {"label": "Accountant", "color": "purple"},
        "DRIVER": {"label": "Driver", "color": "grey"},
    }

    results = []
    for role_name, meta in role_map.items():
        # Count users with this role
        user_count_r = await db.execute(
            select(func.count(func.distinct(User.id)))
            .select_from(User)
            .join(user_roles, User.id == user_roles.c.user_id)
            .join(Role, Role.id == user_roles.c.role_id)
            .where(Role.role_type == role_name, User.is_active.is_(True), User.is_deleted.is_(False))
        )
        user_count = user_count_r.scalar() or 0

        # Compute status and detail per role
        status_label = "Active"
        detail_text = f"{user_count} users"

        if role_name == "MANAGER":
            pend_r = await db.execute(
                select(func.count()).select_from(Job).where(
                    Job.status.in_(["DRAFT", "PENDING_APPROVAL"]),
                    Job.is_deleted.is_(False),
                )
            )
            pending = pend_r.scalar() or 0
            detail_text = f"{user_count} users · {pending} jobs pending"
            status_label = "Busy" if pending > 5 else "Active"

        elif role_name == "PROJECT_ASSOCIATE":
            from app.models.postgres.lr import LR
            lr_r = await db.execute(
                select(func.count()).select_from(LR).where(
                    LR.status.in_(["DRAFT", "GENERATED"]),  # GENERATED = awaiting trip start
                    LR.is_deleted.is_(False),
                )
            )
            pending_lr = lr_r.scalar() or 0
            detail_text = f"{user_count} users · {pending_lr} LRs pending"
            status_label = "Busy" if pending_lr > 5 else "Active"

        elif role_name == "FLEET_MANAGER":
            threshold_30 = today + timedelta(days=30)
            alert_r = await db.execute(
                select(func.count()).select_from(Vehicle).where(
                    Vehicle.is_deleted.is_(False),
                    Vehicle.insurance_valid_until.isnot(None),
                    Vehicle.insurance_valid_until <= threshold_30,
                )
            )
            alerts = alert_r.scalar() or 0
            detail_text = f"{user_count} user · {alerts} alerts"
            status_label = "Active"

        elif role_name == "ACCOUNTANT":
            od_r = await db.execute(
                select(func.coalesce(func.sum(Invoice.amount_due), 0)).where(
                    Invoice.due_date < today,
                    cast(Invoice.payment_status, String) != "PAID",
                    Invoice.is_deleted.is_(False),
                )
            )
            overdue = _to_float(od_r.scalar())
            if overdue > 0:
                if overdue >= 100000:
                    overdue_str = f"₹{overdue/100000:.1f}L overdue"
                else:
                    overdue_str = f"₹{overdue:,.0f} overdue"
                detail_text = f"{user_count} user · {overdue_str}"
                status_label = "Overdue"
            else:
                detail_text = f"{user_count} user"

        elif role_name == "DRIVER":
            on_trip_r = await db.execute(
                select(func.count()).select_from(Driver).where(
                    Driver.status == "ON_TRIP",
                    Driver.is_deleted.is_(False),
                )
            )
            on_trip = on_trip_r.scalar() or 0
            detail_text = f"{user_count} users · {on_trip} on trip"

        results.append({
            "role": role_name,
            "label": meta["label"],
            "user_count": user_count,
            "status_label": status_label,
            "status_color": meta["color"],
            "detail_text": detail_text,
        })

    return APIResponse(success=True, data=results)


# ─── Compliance Alerts ────────────────────────────────────────────────────────

@router.get("/compliance/alerts", response_model=APIResponse)
async def admin_compliance_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.COMPLIANCE_READ)),
    severity: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
):
    """Full compliance alert list — Admin-exclusive cross-department view."""
    today = date.today()
    threshold = today + timedelta(days=30)
    alerts = []

    def _severity(days_until_due: int) -> str:
        if days_until_due <= 0:
            return "CRITICAL"
        if days_until_due <= 7:
            return "URGENT"
        return "WARNING"

    # ── Vehicle Insurance ──
    ins_r = await db.execute(
        select(Vehicle.id, Vehicle.registration_number, Vehicle.insurance_valid_until)
        .where(
            Vehicle.is_deleted.is_(False),
            Vehicle.insurance_valid_until.isnot(None),
            Vehicle.insurance_valid_until <= threshold,
        )
    )
    for v in ins_r.all():
        days = (v.insurance_valid_until - today).days
        alerts.append({
            "id": f"v-ins-{v.id}",
            "category": "VEHICLE_INSURANCE",
            "title": "Insurance expired" if days <= 0 else "Insurance expiring",
            "description": f"{v.registration_number} · {'Expired' if days <= 0 else 'Expires'} {v.insurance_valid_until.strftime('%d %b %Y')}",
            "severity": _severity(days),
            "entity_type": "VEHICLE",
            "entity_id": v.id,
            "entity_name": v.registration_number,
            "days_until_due": days,
        })

    # ── Vehicle Fitness ──
    fit_r = await db.execute(
        select(Vehicle.id, Vehicle.registration_number, Vehicle.fitness_valid_until)
        .where(
            Vehicle.is_deleted.is_(False),
            Vehicle.fitness_valid_until.isnot(None),
            Vehicle.fitness_valid_until <= threshold,
        )
    )
    for v in fit_r.all():
        days = (v.fitness_valid_until - today).days
        alerts.append({
            "id": f"v-fit-{v.id}",
            "category": "VEHICLE_FITNESS",
            "title": "Fitness expired" if days <= 0 else "Fitness due",
            "description": f"{v.registration_number} · {'Expired' if days <= 0 else 'Due in'} {abs(days)} days",
            "severity": _severity(days),
            "entity_type": "VEHICLE",
            "entity_id": v.id,
            "entity_name": v.registration_number,
            "days_until_due": days,
        })

    # ── Vehicle PUC ──
    puc_r = await db.execute(
        select(Vehicle.id, Vehicle.registration_number, Vehicle.puc_valid_until)
        .where(
            Vehicle.is_deleted.is_(False),
            Vehicle.puc_valid_until.isnot(None),
            Vehicle.puc_valid_until <= threshold,
        )
    )
    for v in puc_r.all():
        days = (v.puc_valid_until - today).days
        alerts.append({
            "id": f"v-puc-{v.id}",
            "category": "VEHICLE_PUC",
            "title": "PUC expired" if days <= 0 else "PUC expiring",
            "description": f"{v.registration_number} · {'Expired' if days <= 0 else 'Expires'} {v.puc_valid_until.strftime('%d %b %Y')}",
            "severity": _severity(days),
            "entity_type": "VEHICLE",
            "entity_id": v.id,
            "entity_name": v.registration_number,
            "days_until_due": days,
        })

    # ── Driver License ──
    lic_r = await db.execute(
        select(
            DriverLicense.id,
            DriverLicense.driver_id,
            DriverLicense.expiry_date,
            Driver.first_name,
            Driver.last_name,
        )
        .join(Driver, Driver.id == DriverLicense.driver_id)
        .where(
            Driver.is_deleted.is_(False),
            DriverLicense.expiry_date <= threshold,
        )
    )
    for lic in lic_r.all():
        days = (lic.expiry_date - today).days
        name = f"{lic.first_name} {lic.last_name or ''}".strip()
        alerts.append({
            "id": f"d-lic-{lic.driver_id}",
            "category": "DRIVER_LICENSE",
            "title": "License expired" if days <= 0 else "License expiring soon",
            "description": f"{name} · Expires {lic.expiry_date.strftime('%d %b %Y')} ({abs(days)} days)",
            "severity": _severity(days),
            "entity_type": "DRIVER",
            "entity_id": lic.driver_id,
            "entity_name": name,
            "days_until_due": days,
        })

    # ── GST (synthetic — GSTR-1 assumed due 11th of next month) ──
    gst_due = today.replace(day=11)
    if today.day > 11:
        # Next month
        if today.month == 12:
            gst_due = today.replace(year=today.year + 1, month=1, day=11)
        else:
            gst_due = today.replace(month=today.month + 1, day=11)
    gst_days = (gst_due - today).days
    if gst_days <= 15:
        alerts.append({
            "id": "gst-gstr1",
            "category": "GST",
            "title": "GSTR-1 due",
            "description": f"Filing due: {gst_due.strftime('%d %b %Y')} · ₹85,000 GST payable",
            "severity": _severity(gst_days) if gst_days <= 7 else "WARNING",
            "entity_type": "GST",
            "entity_id": 0,
            "entity_name": "GSTR-1",
            "days_until_due": gst_days,
        })

    # Sort: CRITICAL first, then URGENT, then WARNING
    severity_order = {"CRITICAL": 0, "URGENT": 1, "WARNING": 2}
    alerts.sort(key=lambda a: (severity_order.get(a["severity"], 9), a["days_until_due"]))

    # Apply filters
    if severity:
        alerts = [a for a in alerts if a["severity"] == severity.upper()]
    if category:
        cat_upper = category.upper()
        if cat_upper in ("VEHICLE",):
            alerts = [a for a in alerts if a["entity_type"] == "VEHICLE"]
        elif cat_upper in ("DRIVER",):
            alerts = [a for a in alerts if a["entity_type"] == "DRIVER"]
        elif cat_upper in ("GST",):
            alerts = [a for a in alerts if a["entity_type"] == "GST"]
        else:
            alerts = [a for a in alerts if a["category"] == cat_upper]

    return APIResponse(success=True, data=alerts)


# ─── Finance Summary ──────────────────────────────────────────────────────────

@router.get("/finance/summary", response_model=APIResponse)
async def admin_finance_summary(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.REPORT_VIEW)),
):
    """Admin finance overview — read-only KPIs."""
    today = date.today()
    first_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Month revenue
    rev_r = await db.execute(
        select(func.coalesce(func.sum(Job.total_amount), 0)).where(
            Job.status.in_(["COMPLETED", "CLOSED", "DELIVERED", "CLOSURE_PENDING"]),
            Job.is_deleted.is_(False),
            Job.completed_at >= first_of_month,
        )
    )
    month_revenue = _to_float(rev_r.scalar())

    # Total receivables (unpaid invoices)
    recv_r = await db.execute(
        select(func.coalesce(func.sum(Invoice.amount_due), 0)).where(
            cast(Invoice.payment_status, String) != "PAID",
            Invoice.is_deleted.is_(False),
        )
    )
    total_receivables = _to_float(recv_r.scalar())

    # Overdue
    od_r = await db.execute(
        select(func.coalesce(func.sum(Invoice.amount_due), 0)).where(
            Invoice.due_date < today,
            cast(Invoice.payment_status, String) != "PAID",
            Invoice.is_deleted.is_(False),
        )
    )
    overdue_amount = _to_float(od_r.scalar())

    # Total payables (trip expenses not yet settled)
    pay_r = await db.execute(
        select(func.coalesce(func.sum(TripExpense.amount), 0)).select_from(TripExpense)
    )
    total_payables = _to_float(pay_r.scalar())

    # Receivables aging buckets
    def _aging_bucket(min_days: int, max_days: int):
        lo = today - timedelta(days=max_days)
        hi = today - timedelta(days=min_days)
        return select(func.coalesce(func.sum(Invoice.amount_due), 0)).where(
            cast(Invoice.payment_status, String) != "PAID",
            Invoice.is_deleted.is_(False),
            Invoice.due_date >= lo,
            Invoice.due_date < hi,
        )

    current_r = await db.execute(_aging_bucket(0, 30))
    d31_r = await db.execute(_aging_bucket(31, 60))
    d61_r = await db.execute(_aging_bucket(61, 90))
    d90_r = await db.execute(
        select(func.coalesce(func.sum(Invoice.amount_due), 0)).where(
            cast(Invoice.payment_status, String) != "PAID",
            Invoice.is_deleted.is_(False),
            Invoice.due_date < today - timedelta(days=90),
        )
    )

    return APIResponse(success=True, data={
        "month_revenue": month_revenue,
        "total_receivables": total_receivables,
        "total_payables": total_payables,
        "overdue_amount": overdue_amount,
        "receivables_aging": {
            "current": _to_float(current_r.scalar()),
            "days_31_60": _to_float(d31_r.scalar()),
            "days_61_90": _to_float(d61_r.scalar()),
            "days_90_plus": _to_float(d90_r.scalar()),
        },
    })


# ─── Payables Summary ────────────────────────────────────────────────────────

@router.get("/finance/payables-summary", response_model=APIResponse)
async def admin_payables_summary(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.REPORT_VIEW)),
):
    """Payables breakdown by category."""
    from app.models.postgres.trip import ExpenseCategory

    categories = {
        "FUEL": "Fuel vendor",
        "DRIVER_SALARY": "Driver settlements",
        "MAINTENANCE": "Maintenance",
    }
    breakdown = []
    total = 0.0

    for cat_key, label in categories.items():
        try:
            r = await db.execute(
                select(func.coalesce(func.sum(TripExpense.amount), 0))
                .where(TripExpense.category == cat_key)
            )
            amount = _to_float(r.scalar())
        except Exception:
            amount = 0.0
        breakdown.append({"category": label, "amount": amount})
        total += amount

    # "Other" = total expenses minus known categories
    total_r = await db.execute(
        select(func.coalesce(func.sum(TripExpense.amount), 0)).select_from(TripExpense)
    )
    all_expenses = _to_float(total_r.scalar())
    other_amount = max(0.0, all_expenses - total)
    breakdown.append({"category": "Other", "amount": other_amount})

    return APIResponse(success=True, data=breakdown)


# ─── Vehicle Compliance Update ────────────────────────────────────────────────

@router.patch("/vehicles/{vehicle_id}/compliance", response_model=APIResponse)
async def update_vehicle_compliance(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_UPDATE)),
    compliance_type: str = Query(...),
    renewed_date: Optional[str] = Query(None),
    expiry_date: Optional[str] = Query(None),
):
    """Mark a vehicle compliance item as renewed."""
    col_map = {
        "VEHICLE_INSURANCE": Vehicle.insurance_valid_until,
        "VEHICLE_FITNESS": Vehicle.fitness_valid_until,
        "VEHICLE_PUC": Vehicle.puc_valid_until,
    }
    col = col_map.get(compliance_type.upper())
    if not col:
        return APIResponse(success=False, message="Invalid compliance_type")

    new_expiry = None
    if expiry_date:
        try:
            new_expiry = date.fromisoformat(expiry_date)
        except ValueError:
            return APIResponse(success=False, message="Invalid expiry_date format")

    if new_expiry:
        await db.execute(
            update(Vehicle).where(Vehicle.id == vehicle_id).values({col.key: new_expiry})
        )
        await db.commit()

    return APIResponse(success=True, message="Compliance updated")
