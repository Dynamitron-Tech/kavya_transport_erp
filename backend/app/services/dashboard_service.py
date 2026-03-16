# Dashboard & Reports Service - Aggregation queries
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_
from datetime import date, datetime, timedelta

from app.models.postgres.job import Job, JobStatusEnum
from app.models.postgres.lr import LR, LRStatus
from app.models.postgres.trip import Trip, TripStatusEnum, TripExpense
from app.models.postgres.finance import Invoice, InvoiceStatus, Payment
from app.models.postgres.vehicle import Vehicle, VehicleStatus
from app.models.postgres.driver import Driver, DriverStatus
from app.models.postgres.client import Client
from app.models.postgres.document import Document, DocumentApprovalStatus
from app.models.postgres.eway_bill import EwayBill, EwayBillStatus


async def get_dashboard_stats(db: AsyncSession) -> dict:
    """Get main dashboard KPI stats."""
    today = date.today()
    month_start = today.replace(day=1)

    # Active jobs
    active_jobs = (await db.execute(
        select(func.count(Job.id)).where(
            Job.is_deleted == False,
            Job.status.in_([JobStatusEnum.APPROVED, JobStatusEnum.IN_PROGRESS])
        )
    )).scalar() or 0

    # Active trips
    active_trips = (await db.execute(
        select(func.count(Trip.id)).where(
            Trip.is_deleted == False,
            Trip.status.in_([TripStatusEnum.STARTED, TripStatusEnum.IN_TRANSIT, TripStatusEnum.LOADING, TripStatusEnum.UNLOADING])
        )
    )).scalar() or 0

    # Pending LRs
    pending_lrs = (await db.execute(
        select(func.count(LR.id)).where(
            LR.is_deleted == False,
            LR.status.in_([LRStatus.GENERATED, LRStatus.IN_TRANSIT])
        )
    )).scalar() or 0

    # Monthly revenue
    monthly_revenue = (await db.execute(
        select(func.sum(Invoice.total_amount)).where(
            Invoice.is_deleted == False,
            Invoice.invoice_date >= month_start,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
    )).scalar() or 0

    # Monthly collections
    monthly_collections = (await db.execute(
        select(func.sum(Payment.amount)).where(
            Payment.is_deleted == False,
            Payment.payment_date >= month_start,
            Payment.payment_type == "received",
        )
    )).scalar() or 0

    # Pending receivables
    pending_receivables = (await db.execute(
        select(func.sum(Invoice.amount_due)).where(
            Invoice.is_deleted == False,
            Invoice.amount_due > 0,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
    )).scalar() or 0

    # Fleet available
    total_vehicles = (await db.execute(
        select(func.count(Vehicle.id)).where(Vehicle.is_deleted == False)
    )).scalar() or 0

    available_vehicles = (await db.execute(
        select(func.count(Vehicle.id)).where(Vehicle.is_deleted == False, Vehicle.status == VehicleStatus.AVAILABLE)
    )).scalar() or 0

    # Total drivers
    total_drivers = (await db.execute(
        select(func.count(Driver.id)).where(Driver.is_deleted == False)
    )).scalar() or 0

    available_drivers = (await db.execute(
        select(func.count(Driver.id)).where(Driver.is_deleted == False, Driver.status == DriverStatus.AVAILABLE)
    )).scalar() or 0

    # Total clients
    total_clients = (await db.execute(
        select(func.count(Client.id)).where(Client.is_deleted == False, Client.is_active == True)
    )).scalar() or 0

    # Monthly trips completed
    trips_completed = (await db.execute(
        select(func.count(Trip.id)).where(
            Trip.is_deleted == False,
            Trip.status == TripStatusEnum.COMPLETED,
            Trip.actual_end >= month_start,
        )
    )).scalar() or 0

    # Monthly expenses
    monthly_expenses = (await db.execute(
        select(func.sum(TripExpense.amount)).where(
            TripExpense.expense_date >= datetime.combine(month_start, datetime.min.time()),
        )
    )).scalar() or 0

    return {
        "active_jobs": active_jobs,
        "active_trips": active_trips,
        "pending_lrs": pending_lrs,
        "monthly_revenue": float(monthly_revenue),
        "monthly_collections": float(monthly_collections),
        "pending_receivables": float(pending_receivables),
        "monthly_expenses": float(monthly_expenses),
        "profit": float(monthly_revenue) - float(monthly_expenses),
        "total_vehicles": total_vehicles,
        "available_vehicles": available_vehicles,
        "total_drivers": total_drivers,
        "available_drivers": available_drivers,
        "total_clients": total_clients,
        "trips_completed_this_month": trips_completed,
    }


async def get_project_associate_dashboard_stats(db: AsyncSession) -> dict:
    """Get project associate dashboard stats with a stable nested KPI shape."""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    now = datetime.utcnow()
    expiring_until = now + timedelta(days=7)

    jobs_today = (await db.execute(
        select(func.count(Job.id)).where(
            Job.is_deleted == False,
            Job.job_date == today,
        )
    )).scalar() or 0

    jobs_week = (await db.execute(
        select(func.count(Job.id)).where(
            Job.is_deleted == False,
            Job.job_date >= week_start,
            Job.job_date <= week_end,
        )
    )).scalar() or 0

    jobs_total = (await db.execute(
        select(func.count(Job.id)).where(Job.is_deleted == False)
    )).scalar() or 0

    jobs_pending = (await db.execute(
        select(func.count(Job.id)).where(
            Job.is_deleted == False,
            Job.status.in_([JobStatusEnum.DRAFT, JobStatusEnum.PENDING_APPROVAL]),
        )
    )).scalar() or 0

    lr_today = (await db.execute(
        select(func.count(LR.id)).where(
            LR.is_deleted == False,
            LR.lr_date == today,
        )
    )).scalar() or 0

    lr_total = (await db.execute(
        select(func.count(LR.id)).where(LR.is_deleted == False)
    )).scalar() or 0

    lr_pending = (await db.execute(
        select(func.count(LR.id)).where(
            LR.is_deleted == False,
            LR.status.in_([LRStatus.DRAFT, LRStatus.GENERATED]),
        )
    )).scalar() or 0

    trips_today = (await db.execute(
        select(func.count(Trip.id)).where(
            Trip.is_deleted == False,
            Trip.trip_date == today,
        )
    )).scalar() or 0

    trips_total = (await db.execute(
        select(func.count(Trip.id)).where(Trip.is_deleted == False)
    )).scalar() or 0

    trips_active = (await db.execute(
        select(func.count(Trip.id)).where(
            Trip.is_deleted == False,
            Trip.status.in_([
                TripStatusEnum.STARTED,
                TripStatusEnum.LOADING,
                TripStatusEnum.IN_TRANSIT,
                TripStatusEnum.UNLOADING,
            ]),
        )
    )).scalar() or 0

    ewb_expiring = (await db.execute(
        select(func.count(EwayBill.id)).where(
            EwayBill.is_deleted == False,
            EwayBill.valid_until.is_not(None),
            EwayBill.valid_until >= now,
            EwayBill.valid_until <= expiring_until,
            EwayBill.status.in_([
                EwayBillStatus.ACTIVE,
                EwayBillStatus.IN_TRANSIT,
                EwayBillStatus.EXTENDED,
            ]),
        )
    )).scalar() or 0

    ewb_total = (await db.execute(
        select(func.count(EwayBill.id)).where(EwayBill.is_deleted == False)
    )).scalar() or 0

    documents_pending = (await db.execute(
        select(func.count(Document.id)).where(
            Document.is_deleted == False,
            Document.approval_status == DocumentApprovalStatus.PENDING,
        )
    )).scalar() or 0

    documents_total = (await db.execute(
        select(func.count(Document.id)).where(Document.is_deleted == False)
    )).scalar() or 0

    pa_shape = {
        "jobs": {"today": jobs_today, "total": jobs_total, "pending": jobs_pending},
        "lr": {"today": lr_today, "total": lr_total, "pending": lr_pending},
        "trips": {"today": trips_today, "total": trips_total, "active": trips_active},
        "ewb": {"expiring": ewb_expiring, "total": ewb_total},
        "documents": {"pending": documents_pending, "total": documents_total},
    }

    # Legacy aliases keep existing PA cards stable while frontend migrates fully to nested keys.
    return {
        **pa_shape,
        "total_jobs": {"today": jobs_today, "this_week": jobs_week},
        "jobs_pending_documentation": documents_pending,
        "lr_pending_creation": lr_pending,
        "eway_bills_pending": ewb_expiring,
        "trips_pending_creation": max(jobs_pending - trips_active, 0),
        "trips_pending_closure": 0,
        "documents_pending_upload": documents_pending,
        "jobs_awaiting_approval": jobs_pending,
    }


async def get_revenue_chart(db: AsyncSession, days: int = 30) -> list:
    """Daily revenue for chart."""
    start_date = date.today() - timedelta(days=days)
    result = await db.execute(
        select(
            Invoice.invoice_date,
            func.sum(Invoice.total_amount),
        ).where(
            Invoice.is_deleted == False,
            Invoice.invoice_date >= start_date,
            Invoice.status != InvoiceStatus.CANCELLED,
        ).group_by(Invoice.invoice_date).order_by(Invoice.invoice_date)
    )
    return [{"date": str(row[0]), "revenue": float(row[1])} for row in result.all()]


async def get_trip_status_distribution(db: AsyncSession) -> list:
    """Trip count by status."""
    result = await db.execute(
        select(Trip.status, func.count(Trip.id)).where(Trip.is_deleted == False).group_by(Trip.status)
    )
    return [{"status": row[0].value if hasattr(row[0], 'value') else str(row[0]), "count": row[1]} for row in result.all()]


async def get_top_clients(db: AsyncSession, limit: int = 10) -> list:
    """Top clients by revenue."""
    result = await db.execute(
        select(Client.name, func.sum(Invoice.total_amount).label("revenue"), func.count(Invoice.id).label("invoice_count"))
        .join(Invoice, Invoice.client_id == Client.id)
        .where(Invoice.is_deleted == False, Invoice.status != InvoiceStatus.CANCELLED)
        .group_by(Client.id, Client.name)
        .order_by(func.sum(Invoice.total_amount).desc())
        .limit(limit)
    )
    return [{"client_name": row[0], "revenue": float(row[1]), "invoice_count": row[2]} for row in result.all()]


async def get_expense_breakdown(db: AsyncSession, days: int = 30) -> list:
    """Expense breakdown by category."""
    start_date = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(TripExpense.category, func.sum(TripExpense.amount))
        .where(TripExpense.expense_date >= start_date)
        .group_by(TripExpense.category)
        .order_by(func.sum(TripExpense.amount).desc())
    )
    return [{"category": row[0].value if hasattr(row[0], 'value') else str(row[0]), "amount": float(row[1])} for row in result.all()]


async def get_fleet_manager_dashboard(db: AsyncSession) -> dict:
    """Fleet manager specific dashboard data."""
    from app.services.vehicle_service import get_fleet_summary, get_vehicles_expiring_soon

    fleet = await get_fleet_summary(db)
    expiring = await get_vehicles_expiring_soon(db, 30)

    # Active trips with details
    active_result = await db.execute(
        select(Trip).where(
            Trip.is_deleted == False,
            Trip.status.in_([TripStatusEnum.STARTED, TripStatusEnum.IN_TRANSIT, TripStatusEnum.LOADING, TripStatusEnum.UNLOADING])
        ).order_by(Trip.actual_start.desc()).limit(20)
    )
    active_trips = active_result.scalars().all()

    return {
        "fleet_summary": fleet,
        "expiring_documents": [
            {"vehicle_id": v.id, "registration": v.registration_number, "type": v.vehicle_type}
            for v in expiring[:10]
        ],
        "active_trips": [
            {
                "trip_number": t.trip_number, "vehicle": t.vehicle_registration,
                "driver": t.driver_name, "origin": t.origin, "destination": t.destination,
                "status": t.status.value if hasattr(t.status, 'value') else str(t.status),
            }
            for t in active_trips
        ],
    }


async def get_accountant_dashboard(db: AsyncSession) -> dict:
    """Accountant specific dashboard data."""
    today = date.today()
    month_start = today.replace(day=1)

    # Receivables summary
    total_receivable = (await db.execute(
        select(func.sum(Invoice.amount_due)).where(
            Invoice.is_deleted == False, Invoice.amount_due > 0, Invoice.status != InvoiceStatus.CANCELLED,
        )
    )).scalar() or 0

    # Overdue invoices
    overdue_count = (await db.execute(
        select(func.count(Invoice.id)).where(
            Invoice.is_deleted == False, Invoice.due_date < today, Invoice.amount_due > 0,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
    )).scalar() or 0

    overdue_amount = (await db.execute(
        select(func.sum(Invoice.amount_due)).where(
            Invoice.is_deleted == False, Invoice.due_date < today, Invoice.amount_due > 0,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
    )).scalar() or 0

    # Monthly invoiced
    monthly_invoiced = (await db.execute(
        select(func.sum(Invoice.total_amount)).where(
            Invoice.is_deleted == False, Invoice.invoice_date >= month_start,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
    )).scalar() or 0

    # Monthly collected
    monthly_collected = (await db.execute(
        select(func.sum(Payment.amount)).where(
            Payment.is_deleted == False, Payment.payment_date >= month_start,
            Payment.payment_type == "received",
        )
    )).scalar() or 0

    # Monthly expenses
    monthly_expenses = (await db.execute(
        select(func.sum(TripExpense.amount)).where(
            TripExpense.expense_date >= datetime.combine(month_start, datetime.min.time()),
        )
    )).scalar() or 0

    # Unverified expenses
    unverified_expenses = (await db.execute(
        select(func.count(TripExpense.id)).where(TripExpense.is_verified == False)
    )).scalar() or 0

    return {
        "total_receivable": float(total_receivable),
        "overdue_count": overdue_count,
        "overdue_amount": float(overdue_amount),
        "monthly_invoiced": float(monthly_invoiced),
        "monthly_collected": float(monthly_collected),
        "monthly_expenses": float(monthly_expenses),
        "unverified_expenses": unverified_expenses,
        "collection_rate": round(float(monthly_collected) / float(monthly_invoiced) * 100, 1) if monthly_invoiced else 0,
    }


async def get_notifications(db: AsyncSession, user_id: int) -> list:
    """Get user notifications/alerts."""
    from app.services.vehicle_service import get_vehicles_expiring_soon
    
    alerts = []
    
    # Check for expiring documents
    try:
        expiring = await get_vehicles_expiring_soon(db, 30)
        for v in expiring[:5]:
            alerts.append({
                "id": f"exp_{v.id}",
                "type": "warning",
                "title": "Document Expiring",
                "message": f"Vehicle {v.registration_number} has expiring documents",
                "timestamp": datetime.utcnow().isoformat(),
                "read": False,
            })
    except Exception:
        pass
    
    # Check for overdue invoices
    try:
        overdue = await db.execute(
            select(Invoice).where(
                Invoice.is_deleted == False,
                Invoice.due_date < date.today(),
                Invoice.amount_due > 0,
                Invoice.status != InvoiceStatus.CANCELLED,
            ).limit(5)
        )
        for inv in overdue.scalars().all():
            alerts.append({
                "id": f"inv_{inv.id}",
                "type": "warning", 
                "title": "Overdue Invoice",
                "message": f"Invoice {inv.invoice_number} is overdue",
                "timestamp": datetime.utcnow().isoformat(),
                "read": False,
            })
    except Exception:
        pass
    
    return alerts
