# Reports Endpoints
from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Optional, Tuple
import csv
import io

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.db.postgres.connection import get_db
from app.middleware.permissions import Permissions, require_permission
from app.models.postgres.client import Client
from app.models.postgres.driver import Driver, DriverAttendance
from app.models.postgres.finance import Invoice, Ledger, Payment, GSTEntry
from app.models.postgres.job import Job
from app.models.postgres.trip import Trip, TripExpense, TripFuelEntry
from app.models.postgres.vehicle import Vehicle
from app.schemas.base import APIResponse
from app.services import dashboard_service

router = APIRouter()


def _to_number(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    return 0.0


def _resolve_date_range(from_raw: Optional[str], to_raw: Optional[str]) -> Tuple[date, date]:
    today = date.today()
    month_start = today.replace(day=1)

    from_clean = (from_raw or "").strip()
    to_clean = (to_raw or "").strip()

    try:
        from_date = date.fromisoformat(from_clean) if from_clean else month_start
    except ValueError:
        from_date = month_start

    try:
        to_date = date.fromisoformat(to_clean) if to_clean else today
    except ValueError:
        to_date = today

    if from_date > to_date:
        from_date, to_date = to_date, from_date

    return from_date, to_date


@router.get("/dashboard", response_model=APIResponse)
async def reports_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Role-aware dashboard payload for reports consumers."""
    roles = {role.lower() for role in (current_user.roles or [])}
    pa_payload = await dashboard_service.get_project_associate_dashboard_stats(db)

    if "project_associate" in roles or "project_associates" in roles:
        return APIResponse(success=True, data={
            "jobs": pa_payload.get("jobs", {"today": 0, "total": 0, "pending": 0}),
            "lr": pa_payload.get("lr", {"today": 0, "total": 0, "pending": 0}),
            "trips": pa_payload.get("trips", {"today": 0, "total": 0, "active": 0}),
            "ewb": pa_payload.get("ewb", {"expiring": 0, "total": 0}),
            "documents": pa_payload.get("documents", {"pending": 0, "total": 0}),
        }, message="ok")

    return APIResponse(success=True, data={
        "jobs": pa_payload.get("jobs", {"today": 0, "total": 0, "pending": 0}),
        "lr": pa_payload.get("lr", {"today": 0, "total": 0, "pending": 0}),
        "trips": pa_payload.get("trips", {"today": 0, "total": 0, "active": 0}),
        "ewb": pa_payload.get("ewb", {"expiring": 0, "total": 0}),
        "documents": pa_payload.get("documents", {"pending": 0, "total": 0}),
    }, message="ok")


@router.get("/summary", response_model=APIResponse)
async def reports_summary(
    period: str = Query("month", pattern="^(week|month|quarter|year)$"),
    db: AsyncSession = Depends(get_db),
    _perm: TokenData = Depends(require_permission(Permissions.REPORT_VIEW)),
):
    """Aggregated financial summary for the manager reports screen."""
    today = date.today()
    if period == "week":
        from_date = today - timedelta(days=7)
    elif period == "month":
        from_date = today.replace(day=1)
    elif period == "quarter":
        from_date = today.replace(month=((today.month - 1) // 3) * 3 + 1, day=1)
    else:  # year
        from_date = today.replace(month=1, day=1)

    # Total revenue = sum of total_amount from completed jobs in period
    rev_res = await db.execute(
        select(func.coalesce(func.sum(Job.total_amount), 0)).where(
            Job.is_deleted.is_(False),
            Job.status.in_(["COMPLETED", "CLOSED", "DELIVERED"]),
            func.date(Job.completed_at) >= from_date,
            func.date(Job.completed_at) <= today,
        )
    )
    total_revenue = _to_number(rev_res.scalar())

    # Total expenses = sum of trip expenses in period
    exp_res = await db.execute(
        select(func.coalesce(func.sum(TripExpense.amount), 0)).where(
            func.date(TripExpense.expense_date) >= from_date,
            func.date(TripExpense.expense_date) <= today,
        )
    )
    total_expenses = _to_number(exp_res.scalar())

    # Jobs completed in period
    jobs_res = await db.execute(
        select(func.count(Job.id)).where(
            Job.is_deleted.is_(False),
            Job.status.in_(["COMPLETED", "CLOSED", "DELIVERED"]),
            func.date(Job.completed_at) >= from_date,
            func.date(Job.completed_at) <= today,
        )
    )
    jobs_completed = int(jobs_res.scalar() or 0)

    avg_revenue_per_trip = round(total_revenue / jobs_completed, 2) if jobs_completed > 0 else 0.0

    # Top routes = most frequent origin→destination from trips in period
    route_res = await db.execute(
        select(
            Trip.origin,
            Trip.destination,
            func.count(Trip.id).label("trip_count"),
            func.coalesce(func.sum(Trip.revenue), 0).label("revenue"),
        )
        .where(
            Trip.is_deleted.is_(False),
            func.date(Trip.trip_date) >= from_date,
            func.date(Trip.trip_date) <= today,
        )
        .group_by(Trip.origin, Trip.destination)
        .order_by(func.count(Trip.id).desc())
        .limit(5)
    )
    top_routes = [
        {
            "route": f"{origin or 'Unknown'} → {destination or 'Unknown'}",
            "trip_count": int(trip_count or 0),
            "revenue": _to_number(revenue),
        }
        for origin, destination, trip_count, revenue in route_res.fetchall()
    ]

    # Expense breakdown by category
    breakdown_res = await db.execute(
        select(
            TripExpense.category,
            func.coalesce(func.sum(TripExpense.amount), 0).label("total"),
        )
        .where(
            func.date(TripExpense.expense_date) >= from_date,
            func.date(TripExpense.expense_date) <= today,
        )
        .group_by(TripExpense.category)
        .order_by(func.sum(TripExpense.amount).desc())
    )
    expense_breakdown = [
        {
            "category": str(cat.value if hasattr(cat, "value") else cat) if cat else "Other",
            "amount": _to_number(total),
        }
        for cat, total in breakdown_res.fetchall()
    ]

    return APIResponse(success=True, data={
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "jobs_completed": jobs_completed,
        "avg_revenue_per_trip": avg_revenue_per_trip,
        "top_routes": top_routes,
        "expense_breakdown": expense_breakdown,
        "period": period,
        "from_date": from_date.isoformat(),
        "to_date": today.isoformat(),
    }, message="ok")


@router.get("/revenue-chart", response_model=APIResponse)
async def revenue_chart(
    days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
    _perm: TokenData = Depends(require_permission(Permissions.REPORT_VIEW)),
):
    data = await dashboard_service.get_revenue_chart(db, days)
    return APIResponse(success=True, data=data or [], message="ok")


@router.get("/trip-status", response_model=APIResponse)
async def trip_status_distribution(
    db: AsyncSession = Depends(get_db),
    _perm: TokenData = Depends(require_permission(Permissions.REPORT_VIEW)),
):
    data = await dashboard_service.get_trip_status_distribution(db)
    return APIResponse(success=True, data=data or [], message="ok")


@router.get("/top-clients", response_model=APIResponse)
async def top_clients(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _perm: TokenData = Depends(require_permission(Permissions.REPORT_VIEW)),
):
    data = await dashboard_service.get_top_clients(db, limit)
    return APIResponse(success=True, data=data or [], message="ok")


@router.get("/expense-breakdown", response_model=APIResponse)
async def expense_breakdown(
    days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
    _perm: TokenData = Depends(require_permission(Permissions.REPORT_VIEW)),
):
    data = await dashboard_service.get_expense_breakdown(db, days)
    return APIResponse(success=True, data=data or [], message="ok")


@router.get("/trip-summary", response_model=APIResponse)
async def trip_summary_report(
    from_date_raw: Optional[str] = Query(None, alias="from"),
    to_date_raw: Optional[str] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    _perm: TokenData = Depends(require_permission(Permissions.REPORT_VIEW)),
):
    from_date, to_date = _resolve_date_range(from_date_raw, to_date_raw)

    stmt = (
        select(
            Trip,
            Driver.first_name,
            Driver.last_name,
            Vehicle.registration_number,
            Job.total_amount,
        )
        .outerjoin(Driver, Trip.driver_id == Driver.id)
        .outerjoin(Vehicle, Trip.vehicle_id == Vehicle.id)
        .outerjoin(Job, Trip.job_id == Job.id)
        .where(and_(Trip.trip_date >= from_date, Trip.trip_date <= to_date))
        .order_by(Trip.trip_date.desc())
    )
    rows = (await db.execute(stmt)).all()

    data = []
    for trip, first_name, last_name, registration_number, job_total_amount in rows:
        driver_name = (trip.driver_name or f"{first_name or ''} {last_name or ''}".strip() or "Unknown")
        vehicle_number = trip.vehicle_registration or registration_number or "Unknown"
        distance_km = _to_number(trip.actual_distance_km or trip.planned_distance_km)
        freight_amount = _to_number(trip.revenue if trip.revenue is not None else job_total_amount)
        expense_total = _to_number(trip.total_expense)
        profit = _to_number(trip.profit_loss if trip.profit_loss is not None else (freight_amount - expense_total))

        data.append(
            {
                "trip_number": trip.trip_number,
                "driver_name": driver_name,
                "vehicle_number": vehicle_number,
                "origin": trip.origin,
                "destination": trip.destination,
                "status": trip.status.value if getattr(trip.status, "value", None) else str(trip.status or ""),
                "distance_km": distance_km,
                "freight_amount": freight_amount,
                "expense_total": expense_total,
                "profit": profit,
                "started_at": trip.actual_start.isoformat() if trip.actual_start else None,
                "completed_at": trip.actual_end.isoformat() if trip.actual_end else None,
            }
        )

    return APIResponse(success=True, data=data or [], message="ok")


@router.get("/vehicle-performance", response_model=APIResponse)
async def vehicle_performance_report(
    from_date_raw: Optional[str] = Query(None, alias="from"),
    to_date_raw: Optional[str] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    _perm: TokenData = Depends(require_permission(Permissions.REPORT_VIEW)),
):
    from_date, to_date = _resolve_date_range(from_date_raw, to_date_raw)
    days_span = max((to_date - from_date).days + 1, 1)

    stmt = (
        select(
            Vehicle.registration_number,
            Vehicle.vehicle_type,
            func.count(Trip.id),
            func.coalesce(func.sum(Trip.actual_distance_km), 0),
            func.coalesce(func.sum(Trip.actual_fuel_litres), 0),
            func.coalesce(func.sum(Trip.revenue), 0),
            func.coalesce(func.sum(Trip.total_expense), 0),
        )
        .outerjoin(
            Trip,
            and_(
                Trip.vehicle_id == Vehicle.id,
                Trip.trip_date >= from_date,
                Trip.trip_date <= to_date,
            ),
        )
        .group_by(Vehicle.id, Vehicle.registration_number, Vehicle.vehicle_type)
        .order_by(Vehicle.registration_number.asc())
    )
    rows = (await db.execute(stmt)).all()

    data = []
    for vehicle_number, vehicle_type, total_trips, total_distance_km, total_fuel_litres, total_revenue, total_expenses in rows:
        trips_count = int(total_trips or 0)
        distance = _to_number(total_distance_km)
        fuel = _to_number(total_fuel_litres)
        km_per_litre = round(distance / fuel, 2) if fuel > 0 else 0.0
        utilization = round(min((trips_count / days_span) * 100, 100), 2)

        data.append(
            {
                "vehicle_number": vehicle_number,
                "vehicle_type": vehicle_type.value if getattr(vehicle_type, "value", None) else str(vehicle_type or ""),
                "total_trips": trips_count,
                "total_distance_km": distance,
                "total_fuel_litres": fuel,
                "avg_km_per_litre": km_per_litre,
                "total_revenue": _to_number(total_revenue),
                "total_expenses": _to_number(total_expenses),
                "utilization_percent": utilization,
            }
        )

    return APIResponse(success=True, data=data or [], message="ok")


@router.get("/driver-performance", response_model=APIResponse)
async def driver_performance_report(
    from_date_raw: Optional[str] = Query(None, alias="from"),
    to_date_raw: Optional[str] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    _perm: TokenData = Depends(require_permission(Permissions.REPORT_VIEW)),
):
    from_date, to_date = _resolve_date_range(from_date_raw, to_date_raw)

    trips_stmt = (
        select(
            Driver.id,
            Driver.first_name,
            Driver.last_name,
            func.count(Trip.id),
            func.coalesce(func.sum(Trip.actual_distance_km), 0),
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(
                                Trip.actual_end.is_not(None),
                                Trip.planned_end.is_not(None),
                                Trip.actual_end <= Trip.planned_end,
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
        )
        .outerjoin(
            Trip,
            and_(
                Trip.driver_id == Driver.id,
                Trip.trip_date >= from_date,
                Trip.trip_date <= to_date,
            ),
        )
        .group_by(Driver.id, Driver.first_name, Driver.last_name)
        .order_by(Driver.first_name.asc())
    )
    trips_rows = (await db.execute(trips_stmt)).all()

    expense_stmt = (
        select(
            Trip.driver_id,
            func.coalesce(func.sum(TripExpense.amount), 0),
            func.coalesce(
                func.sum(case((TripExpense.is_verified.is_(True), TripExpense.amount), else_=0)),
                0,
            ),
        )
        .join(Trip, TripExpense.trip_id == Trip.id)
        .where(and_(func.date(TripExpense.expense_date) >= from_date, func.date(TripExpense.expense_date) <= to_date))
        .group_by(Trip.driver_id)
    )
    expense_rows = (await db.execute(expense_stmt)).all()
    expense_map = {driver_id: (_to_number(total), _to_number(approved)) for driver_id, total, approved in expense_rows}

    attendance_stmt = (
        select(DriverAttendance.driver_id, func.count(DriverAttendance.id))
        .where(and_(DriverAttendance.date >= from_date, DriverAttendance.date <= to_date))
        .group_by(DriverAttendance.driver_id)
    )
    attendance_rows = (await db.execute(attendance_stmt)).all()
    attendance_map = {driver_id: int(days or 0) for driver_id, days in attendance_rows}

    data = []
    for driver_id, first_name, last_name, total_trips, total_distance_km, on_time_deliveries in trips_rows:
        submitted, approved = expense_map.get(driver_id, (0.0, 0.0))
        data.append(
            {
                "driver_name": f"{first_name or ''} {last_name or ''}".strip() or "Unknown",
                "total_trips": int(total_trips or 0),
                "total_distance_km": _to_number(total_distance_km),
                "on_time_deliveries": int(on_time_deliveries or 0),
                "total_expenses_submitted": submitted,
                "expenses_approved": approved,
                "attendance_days": attendance_map.get(driver_id, 0),
            }
        )

    return APIResponse(success=True, data=data or [], message="ok")


@router.get("/fuel-analysis", response_model=APIResponse)
async def fuel_analysis_report(
    from_date_raw: Optional[str] = Query(None, alias="from"),
    to_date_raw: Optional[str] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    _perm: TokenData = Depends(require_permission(Permissions.REPORT_VIEW)),
):
    from_date, to_date = _resolve_date_range(from_date_raw, to_date_raw)

    stmt = (
        select(
            TripFuelEntry,
            Vehicle.registration_number,
            Trip.actual_distance_km,
            Trip.actual_fuel_litres,
        )
        .outerjoin(Vehicle, TripFuelEntry.vehicle_id == Vehicle.id)
        .outerjoin(Trip, TripFuelEntry.trip_id == Trip.id)
        .where(and_(func.date(TripFuelEntry.fuel_date) >= from_date, func.date(TripFuelEntry.fuel_date) <= to_date))
        .order_by(TripFuelEntry.fuel_date.desc())
    )
    rows = (await db.execute(stmt)).all()

    data = []
    for fuel_entry, vehicle_number, trip_distance, trip_fuel in rows:
        distance = _to_number(trip_distance)
        fuel = _to_number(trip_fuel)
        km_per_litre = round(distance / fuel, 2) if fuel > 0 else 0.0

        data.append(
            {
                "vehicle_number": vehicle_number or "Unknown",
                "fill_date": fuel_entry.fuel_date.isoformat() if fuel_entry.fuel_date else None,
                "fuel_station": fuel_entry.pump_name,
                "litres_filled": _to_number(fuel_entry.quantity_litres),
                "rate_per_litre": _to_number(fuel_entry.rate_per_litre),
                "total_amount": _to_number(fuel_entry.total_amount),
                "odometer_reading": _to_number(fuel_entry.odometer_reading),
                "km_per_litre": km_per_litre,
            }
        )

    return APIResponse(success=True, data=data or [], message="ok")


@router.get("/revenue-analysis", response_model=APIResponse)
async def revenue_analysis_report(
    from_date_raw: Optional[str] = Query(None, alias="from"),
    to_date_raw: Optional[str] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    _perm: TokenData = Depends(require_permission(Permissions.REPORT_VIEW)),
):
    from_date, to_date = _resolve_date_range(from_date_raw, to_date_raw)

    month_col = func.date_trunc("month", Invoice.invoice_date)
    stmt = (
        select(
            month_col,
            func.coalesce(func.sum(Invoice.total_amount), 0),
            func.coalesce(func.sum(Invoice.total_amount), 0),
            func.coalesce(func.sum(Invoice.amount_paid), 0),
            func.coalesce(func.sum(Invoice.amount_due), 0),
            func.count(Invoice.id),
        )
        .where(and_(Invoice.invoice_date >= from_date, Invoice.invoice_date <= to_date))
        .group_by(month_col)
        .order_by(month_col.asc())
    )
    rows = (await db.execute(stmt)).all()

    data = []
    for month_value, total_invoices, total_freight, total_paid, total_outstanding, invoice_count in rows:
        data.append(
            {
                "month": month_value.strftime("%Y-%m") if month_value else "",
                "total_invoices": _to_number(total_invoices),
                "total_freight": _to_number(total_freight),
                "total_paid": _to_number(total_paid),
                "total_outstanding": _to_number(total_outstanding),
                "invoice_count": int(invoice_count or 0),
            }
        )

    return APIResponse(success=True, data=data or [], message="ok")


@router.get("/expense-analysis", response_model=APIResponse)
async def expense_analysis_report(
    from_date_raw: Optional[str] = Query(None, alias="from"),
    to_date_raw: Optional[str] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    _perm: TokenData = Depends(require_permission(Permissions.REPORT_VIEW)),
):
    from_date, to_date = _resolve_date_range(from_date_raw, to_date_raw)

    stmt = (
        select(
            TripExpense.category,
            func.coalesce(func.sum(TripExpense.amount), 0),
            func.count(TripExpense.id),
            func.coalesce(func.avg(TripExpense.amount), 0),
            func.coalesce(func.sum(case((TripExpense.is_verified.is_(True), TripExpense.amount), else_=0)), 0),
            func.coalesce(func.sum(case((TripExpense.is_verified.is_(False), TripExpense.amount), else_=0)), 0),
        )
        .where(and_(func.date(TripExpense.expense_date) >= from_date, func.date(TripExpense.expense_date) <= to_date))
        .group_by(TripExpense.category)
        .order_by(func.coalesce(func.sum(TripExpense.amount), 0).desc())
    )
    rows = (await db.execute(stmt)).all()

    data = []
    for expense_type, total_amount, count_rows, avg_amount, approved_total, pending_total in rows:
        data.append(
            {
                "expense_type": expense_type.value if getattr(expense_type, "value", None) else str(expense_type or "other"),
                "total_amount": _to_number(total_amount),
                "count": int(count_rows or 0),
                "avg_amount": _to_number(avg_amount),
                "approved_total": _to_number(approved_total),
                "rejected_total": 0.0,
                "pending_total": _to_number(pending_total),
            }
        )

    return APIResponse(success=True, data=data or [], message="ok")


@router.get("/route-analysis", response_model=APIResponse)
async def route_analysis_report(
    from_date_raw: Optional[str] = Query(None, alias="from"),
    to_date_raw: Optional[str] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    _perm: TokenData = Depends(require_permission(Permissions.REPORT_VIEW)),
):
    from_date, to_date = _resolve_date_range(from_date_raw, to_date_raw)

    aggregate_stmt = (
        select(
            Trip.origin,
            Trip.destination,
            func.count(Trip.id),
            func.coalesce(func.avg(Trip.revenue), 0),
            func.coalesce(func.avg(func.coalesce(Trip.actual_distance_km, Trip.planned_distance_km)), 0),
            func.coalesce(func.sum(Trip.revenue), 0),
        )
        .where(and_(Trip.trip_date >= from_date, Trip.trip_date <= to_date))
        .group_by(Trip.origin, Trip.destination)
        .order_by(func.count(Trip.id).desc())
    )
    aggregate_rows = (await db.execute(aggregate_stmt)).all()

    vehicle_stmt = (
        select(Trip.origin, Trip.destination, func.coalesce(Trip.vehicle_registration, Vehicle.registration_number))
        .outerjoin(Vehicle, Trip.vehicle_id == Vehicle.id)
        .where(and_(Trip.trip_date >= from_date, Trip.trip_date <= to_date))
    )
    vehicle_rows = (await db.execute(vehicle_stmt)).all()

    route_vehicle_counts: dict[tuple[str, str], Counter] = defaultdict(Counter)
    for origin, destination, vehicle_number in vehicle_rows:
        route_vehicle_counts[(origin or "", destination or "")][vehicle_number or "Unknown"] += 1

    data = []
    for origin, destination, total_trips, avg_freight_amount, avg_distance_km, total_revenue in aggregate_rows:
        route_key = (origin or "", destination or "")
        most_used_vehicle = ""
        if route_vehicle_counts.get(route_key):
            most_used_vehicle = route_vehicle_counts[route_key].most_common(1)[0][0]

        data.append(
            {
                "origin": origin,
                "destination": destination,
                "total_trips": int(total_trips or 0),
                "avg_freight_amount": _to_number(avg_freight_amount),
                "avg_distance_km": _to_number(avg_distance_km),
                "total_revenue": _to_number(total_revenue),
                "most_used_vehicle": most_used_vehicle,
            }
        )

    return APIResponse(success=True, data=data or [], message="ok")


@router.get("/client-outstanding", response_model=APIResponse)
async def client_outstanding_report(
    from_date_raw: Optional[str] = Query(None, alias="from"),
    to_date_raw: Optional[str] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    _perm: TokenData = Depends(require_permission(Permissions.REPORT_VIEW)),
):
    from_date, to_date = _resolve_date_range(from_date_raw, to_date_raw)
    today = date.today()

    oldest_overdue_col = func.min(case((Invoice.amount_due > 0, Invoice.invoice_date), else_=None))
    overdue_amount_col = func.coalesce(
        func.sum(case((and_(Invoice.due_date < today, Invoice.amount_due > 0), Invoice.amount_due), else_=0)),
        0,
    )

    stmt = (
        select(
            Client.name,
            Client.gstin,
            func.coalesce(func.sum(Invoice.total_amount), 0),
            func.coalesce(func.sum(Invoice.amount_paid), 0),
            func.coalesce(func.sum(Invoice.amount_due), 0),
            overdue_amount_col,
            oldest_overdue_col,
            func.count(Invoice.id),
        )
        .join(Invoice, Invoice.client_id == Client.id)
        .where(and_(Invoice.invoice_date >= from_date, Invoice.invoice_date <= to_date))
        .group_by(Client.id, Client.name, Client.gstin)
        .order_by(func.coalesce(func.sum(Invoice.amount_due), 0).desc())
    )
    rows = (await db.execute(stmt)).all()

    data = []
    for client_name, gstin, total_invoiced, total_paid, outstanding_amount, overdue_amount, oldest_invoice_date, invoice_count in rows:
        data.append(
            {
                "client_name": client_name,
                "gstin": gstin,
                "total_invoiced": _to_number(total_invoiced),
                "total_paid": _to_number(total_paid),
                "outstanding_amount": _to_number(outstanding_amount),
                "overdue_amount": _to_number(overdue_amount),
                "oldest_invoice_date": oldest_invoice_date.isoformat() if oldest_invoice_date else None,
                "invoice_count": int(invoice_count or 0),
            }
        )

    return APIResponse(success=True, data=data or [], message="ok")


@router.get("/export/{report_type}")
async def export_report(
    report_type: str,
    format: str = Query("csv"),
    from_date_raw: Optional[str] = Query(None, alias="from"),
    to_date_raw: Optional[str] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Export report data as CSV."""
    from_date, to_date = _resolve_date_range(from_date_raw, to_date_raw)

    if report_type in ("trips", "trip-summary"):
        stmt = select(Trip).where(and_(Trip.trip_date >= from_date, Trip.trip_date <= to_date)).order_by(Trip.trip_date.desc())
        rows = (await db.execute(stmt)).scalars().all()
        headers = ["Trip Number", "Origin", "Destination", "Vehicle", "Driver", "Status", "Date"]
        data_rows = [[t.trip_number, t.origin, t.destination, t.vehicle_registration, t.driver_name,
                      t.status.value if hasattr(t.status, 'value') else str(t.status), str(t.trip_date)] for t in rows]
    elif report_type in ("invoices", "revenue"):
        stmt = select(Invoice).where(and_(Invoice.invoice_date >= from_date, Invoice.invoice_date <= to_date)).order_by(Invoice.invoice_date.desc())
        rows = (await db.execute(stmt)).scalars().all()
        headers = ["Invoice Number", "Date", "Total Amount", "Paid", "Due", "Status"]
        data_rows = [[i.invoice_number, str(i.invoice_date), str(i.total_amount), str(i.amount_paid),
                      str(i.amount_due), i.status.value if hasattr(i.status, 'value') else str(i.status)] for i in rows]
    elif report_type in ("vehicles", "vehicle-performance"):
        stmt = select(Vehicle).order_by(Vehicle.registration_number)
        rows = (await db.execute(stmt)).scalars().all()
        headers = ["Registration", "Type", "Status"]
        data_rows = [[v.registration_number, str(v.vehicle_type), str(v.status)] for v in rows]
    elif report_type in ("drivers", "driver-performance"):
        stmt = select(Driver).order_by(Driver.first_name)
        rows = (await db.execute(stmt)).scalars().all()
        headers = ["Name", "Employee Code", "Phone", "Status"]
        data_rows = [[f"{d.first_name} {d.last_name or ''}".strip(), d.employee_code, d.phone,
                      d.status.value if hasattr(d.status, 'value') else str(d.status)] for d in rows]
    else:
        headers = ["Info"]
        data_rows = [[f"No data for report type: {report_type}"]]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(data_rows)
    output.seek(0)

    from fastapi.responses import StreamingResponse as _SR
    return _SR(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={report_type}_report.csv"},
    )


@router.get("/branch/summary", response_model=APIResponse)
async def branch_summary_report(
    branch_id: Optional[int] = Query(None),
    from_date_raw: Optional[str] = Query(None, alias="from"),
    to_date_raw: Optional[str] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Branch-scoped summary report: trips, revenue, expenses."""
    from_date, to_date = _resolve_date_range(from_date_raw, to_date_raw)

    trip_q = select(func.count(Trip.id)).where(
        Trip.trip_date >= from_date, Trip.trip_date <= to_date, Trip.is_deleted == False
    )
    rev_q = select(func.coalesce(func.sum(Invoice.total_amount), 0)).where(
        Invoice.invoice_date >= from_date, Invoice.invoice_date <= to_date
    )

    if branch_id:
        trip_q = trip_q.where(Trip.branch_id == branch_id)
        rev_q = rev_q.where(Invoice.branch_id == branch_id)

    total_trips = (await db.execute(trip_q)).scalar() or 0
    total_revenue = float((await db.execute(rev_q)).scalar() or 0)

    return APIResponse(success=True, data={
        "branch_id": branch_id,
        "period": {"from": str(from_date), "to": str(to_date)},
        "total_trips": total_trips,
        "total_revenue": total_revenue,
    })


# ---------------------------------------------------------------------------
# AUDITOR REPORT
# ---------------------------------------------------------------------------

@router.get("/auditor", response_model=APIResponse)
async def auditor_report(
    from_date_raw: Optional[str] = Query(None, alias="from_date"),
    to_date_raw: Optional[str] = Query(None, alias="to_date"),
    ledger_page: int = Query(1, ge=1),
    ledger_per_page: int = Query(100, ge=10, le=500),
    db: AsyncSession = Depends(get_db),
    _perm: TokenData = Depends(require_permission(Permissions.REPORT_VIEW)),
):
    """Comprehensive auditor report: P&L, payments, GST, receivables, TDS, ledger."""
    from_date, to_date = _resolve_date_range(from_date_raw, to_date_raw)
    today = date.today()

    # ---- 1. P&L Summary ----
    inv_pl_stmt = select(
        func.coalesce(func.sum(Invoice.total_amount), 0).label("total_invoiced"),
        func.coalesce(func.sum(Invoice.amount_paid), 0).label("total_collected"),
        func.coalesce(func.sum(Invoice.amount_due), 0).label("total_outstanding"),
    ).where(
        Invoice.is_deleted.is_(False),
        Invoice.invoice_date >= from_date,
        Invoice.invoice_date <= to_date,
    )
    inv_pl = (await db.execute(inv_pl_stmt)).one()
    total_invoiced = _to_number(inv_pl.total_invoiced)
    total_collected = _to_number(inv_pl.total_collected)

    exp_stmt = select(
        func.coalesce(func.sum(TripExpense.amount), 0)
    ).where(
        func.date(TripExpense.expense_date) >= from_date,
        func.date(TripExpense.expense_date) <= to_date,
    )
    total_expenses = _to_number((await db.execute(exp_stmt)).scalar())
    net_profit = total_collected - total_expenses
    collection_efficiency = round((total_collected / total_invoiced * 100), 2) if total_invoiced > 0 else 0.0

    pl_summary = {
        "total_invoiced": total_invoiced,
        "total_collected": total_collected,
        "total_expenses": total_expenses,
        "net_profit": net_profit,
        "collection_efficiency_percent": collection_efficiency,
    }

    # ---- 2. Payment Method Breakdown ----
    pay_stmt = select(
        Payment.payment_method,
        func.coalesce(func.sum(Payment.amount), 0).label("total"),
        func.count(Payment.id).label("count"),
    ).where(
        Payment.is_deleted.is_(False),
        Payment.payment_type == "received",
        Payment.payment_date >= from_date,
        Payment.payment_date <= to_date,
    ).group_by(Payment.payment_method)
    pay_rows = (await db.execute(pay_stmt)).all()
    payment_breakdown = [
        {
            "method": row.payment_method.value if hasattr(row.payment_method, "value") else str(row.payment_method or ""),
            "amount": _to_number(row.total),
            "count": int(row.count or 0),
        }
        for row in pay_rows
    ]

    # ---- 3. GST Summary ----
    gst_stmt = select(
        func.coalesce(func.sum(Invoice.cgst_amount), 0).label("cgst"),
        func.coalesce(func.sum(Invoice.sgst_amount), 0).label("sgst"),
        func.coalesce(func.sum(Invoice.igst_amount), 0).label("igst"),
        func.coalesce(func.sum(Invoice.taxable_amount), 0).label("taxable"),
    ).where(
        Invoice.is_deleted.is_(False),
        Invoice.invoice_date >= from_date,
        Invoice.invoice_date <= to_date,
    )
    gst_row = (await db.execute(gst_stmt)).one()
    cgst = _to_number(gst_row.cgst)
    sgst = _to_number(gst_row.sgst)
    igst = _to_number(gst_row.igst)
    total_gst_collected = cgst + sgst + igst

    # GST paid to vendors (from payable payments)
    gst_paid_stmt = select(
        func.coalesce(func.sum(Payment.amount), 0)
    ).where(
        Payment.is_deleted.is_(False),
        Payment.payment_type == "paid",
        Payment.payment_date >= from_date,
        Payment.payment_date <= to_date,
    )
    gst_payable_total = _to_number((await db.execute(gst_paid_stmt)).scalar())
    gst_summary = {
        "taxable_value": _to_number(gst_row.taxable),
        "cgst_amount": cgst,
        "sgst_amount": sgst,
        "igst_amount": igst,
        "total_gst_collected": total_gst_collected,
        "total_vendor_payments": gst_payable_total,
        "net_gst_payable": round(total_gst_collected, 2),
    }

    # ---- 4. Outstanding Receivables ----
    overdue_amt = func.coalesce(
        func.sum(case((and_(Invoice.due_date < today, Invoice.amount_due > 0), Invoice.amount_due), else_=0)), 0
    )
    partial_amt = func.coalesce(
        func.sum(case((Invoice.status == "PARTIALLY_PAID", Invoice.amount_due), else_=0)), 0
    )
    disputed_amt = func.coalesce(
        func.sum(case((Invoice.status == "DISPUTED", Invoice.amount_due), else_=0)), 0
    )
    overdue_cnt = func.coalesce(
        func.sum(case((and_(Invoice.due_date < today, Invoice.amount_due > 0), 1), else_=0)), 0
    )
    partial_cnt = func.coalesce(
        func.sum(case((Invoice.status == "PARTIALLY_PAID", 1), else_=0)), 0
    )
    disputed_cnt = func.coalesce(
        func.sum(case((Invoice.status == "DISPUTED", 1), else_=0)), 0
    )
    outstanding_stmt = select(
        overdue_amt, partial_amt, disputed_amt,
        overdue_cnt, partial_cnt, disputed_cnt,
    ).where(
        Invoice.is_deleted.is_(False),
        Invoice.invoice_date >= from_date,
        Invoice.invoice_date <= to_date,
    )
    os_row = (await db.execute(outstanding_stmt)).one()
    outstanding_receivables = {
        "overdue_amount": _to_number(os_row[0]),
        "partially_paid_amount": _to_number(os_row[1]),
        "disputed_amount": _to_number(os_row[2]),
        "overdue_count": int(os_row[3] or 0),
        "partially_paid_count": int(os_row[4] or 0),
        "disputed_count": int(os_row[5] or 0),
        "total_outstanding": _to_number(inv_pl.total_outstanding),
    }

    # ---- 5. TDS Summary ----
    tds_stmt = select(
        func.coalesce(func.sum(Payment.tds_amount), 0).label("total_tds"),
        func.count(Payment.id).label("payment_count"),
    ).where(
        Payment.is_deleted.is_(False),
        Payment.tds_amount > 0,
        Payment.payment_date >= from_date,
        Payment.payment_date <= to_date,
    )
    tds_row = (await db.execute(tds_stmt)).one()
    tds_summary = {
        "total_tds_deducted": _to_number(tds_row.total_tds),
        "payment_count": int(tds_row.payment_count or 0),
    }

    # ---- 6. Ledger Entries (paginated) ----
    offset = (ledger_page - 1) * ledger_per_page
    ledger_count_stmt = select(func.count(Ledger.id)).where(
        Ledger.entry_date >= from_date,
        Ledger.entry_date <= to_date,
    )
    total_ledger_rows = int((await db.execute(ledger_count_stmt)).scalar() or 0)

    ledger_stmt = (
        select(Ledger)
        .where(Ledger.entry_date >= from_date, Ledger.entry_date <= to_date)
        .order_by(Ledger.entry_date.desc(), Ledger.id.desc())
        .offset(offset)
        .limit(ledger_per_page)
    )
    ledger_rows = (await db.execute(ledger_stmt)).scalars().all()
    ledger_entries = [
        {
            "id": row.id,
            "entry_number": row.entry_number,
            "entry_date": row.entry_date.isoformat() if row.entry_date else None,
            "ledger_type": row.ledger_type.value if hasattr(row.ledger_type, "value") else str(row.ledger_type or ""),
            "account_name": row.account_name,
            "account_code": row.account_code,
            "narration": row.narration,
            "reference_number": row.reference_number,
            "debit": _to_number(row.debit),
            "credit": _to_number(row.credit),
            "balance": _to_number(row.balance),
        }
        for row in ledger_rows
    ]

    return APIResponse(success=True, data={
        "period": {"from_date": from_date.isoformat(), "to_date": to_date.isoformat()},
        "pl_summary": pl_summary,
        "payment_breakdown": payment_breakdown,
        "gst_summary": gst_summary,
        "outstanding_receivables": outstanding_receivables,
        "tds_summary": tds_summary,
        "ledger": {
            "entries": ledger_entries,
            "total": total_ledger_rows,
            "page": ledger_page,
            "per_page": ledger_per_page,
            "total_pages": max(1, (total_ledger_rows + ledger_per_page - 1) // ledger_per_page),
        },
    }, message="ok")


@router.get("/auditor/export")
async def auditor_report_export(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    from_date_raw: Optional[str] = Query(None, alias="from_date"),
    to_date_raw: Optional[str] = Query(None, alias="to_date"),
    db: AsyncSession = Depends(get_db),
    _perm: TokenData = Depends(require_permission(Permissions.REPORT_VIEW)),
):
    """Export auditor report as CSV or PDF."""
    from_date, to_date = _resolve_date_range(from_date_raw, to_date_raw)
    today = date.today()

    # ---- gather all data (same queries as above) ----
    inv_pl_stmt = select(
        func.coalesce(func.sum(Invoice.total_amount), 0),
        func.coalesce(func.sum(Invoice.amount_paid), 0),
        func.coalesce(func.sum(Invoice.amount_due), 0),
    ).where(Invoice.is_deleted.is_(False), Invoice.invoice_date >= from_date, Invoice.invoice_date <= to_date)
    inv_pl = (await db.execute(inv_pl_stmt)).one()
    total_invoiced = _to_number(inv_pl[0])
    total_collected = _to_number(inv_pl[1])
    exp_stmt = select(func.coalesce(func.sum(TripExpense.amount), 0)).where(
        func.date(TripExpense.expense_date) >= from_date, func.date(TripExpense.expense_date) <= to_date)
    total_expenses = _to_number((await db.execute(exp_stmt)).scalar())
    net_profit = total_collected - total_expenses
    collection_eff = round((total_collected / total_invoiced * 100), 2) if total_invoiced > 0 else 0.0

    pay_stmt = select(Payment.payment_method, func.coalesce(func.sum(Payment.amount), 0), func.count(Payment.id)).where(
        Payment.is_deleted.is_(False), Payment.payment_type == "received",
        Payment.payment_date >= from_date, Payment.payment_date <= to_date).group_by(Payment.payment_method)
    pay_rows = (await db.execute(pay_stmt)).all()

    gst_stmt = select(
        func.coalesce(func.sum(Invoice.cgst_amount), 0), func.coalesce(func.sum(Invoice.sgst_amount), 0),
        func.coalesce(func.sum(Invoice.igst_amount), 0), func.coalesce(func.sum(Invoice.taxable_amount), 0),
    ).where(Invoice.is_deleted.is_(False), Invoice.invoice_date >= from_date, Invoice.invoice_date <= to_date)
    gst_row = (await db.execute(gst_stmt)).one()

    overdue_amt = func.coalesce(func.sum(case((and_(Invoice.due_date < today, Invoice.amount_due > 0), Invoice.amount_due), else_=0)), 0)
    partial_amt = func.coalesce(func.sum(case((Invoice.status == "PARTIALLY_PAID", Invoice.amount_due), else_=0)), 0)
    disputed_amt = func.coalesce(func.sum(case((Invoice.status == "DISPUTED", Invoice.amount_due), else_=0)), 0)
    os_stmt = select(overdue_amt, partial_amt, disputed_amt).where(
        Invoice.is_deleted.is_(False), Invoice.invoice_date >= from_date, Invoice.invoice_date <= to_date)
    os_row = (await db.execute(os_stmt)).one()

    tds_stmt = select(func.coalesce(func.sum(Payment.tds_amount), 0), func.count(Payment.id)).where(
        Payment.is_deleted.is_(False), Payment.tds_amount > 0, Payment.payment_date >= from_date, Payment.payment_date <= to_date)
    tds_row = (await db.execute(tds_stmt)).one()

    ledger_stmt = (select(Ledger).where(Ledger.entry_date >= from_date, Ledger.entry_date <= to_date)
                   .order_by(Ledger.entry_date.desc()).limit(1000))
    ledger_rows = (await db.execute(ledger_stmt)).scalars().all()

    filename_base = f"auditor_report_{from_date}_{to_date}"

    if format == "csv":
        output = io.StringIO()
        w = csv.writer(output)

        w.writerow(["AUDITOR REPORT", f"Period: {from_date} to {to_date}"])
        w.writerow([])

        w.writerow(["=== P&L SUMMARY ==="])
        w.writerow(["Metric", "Amount (INR)"])
        w.writerow(["Total Invoiced", f"{total_invoiced:.2f}"])
        w.writerow(["Total Collected", f"{total_collected:.2f}"])
        w.writerow(["Total Expenses", f"{total_expenses:.2f}"])
        w.writerow(["Net Profit", f"{net_profit:.2f}"])
        w.writerow(["Collection Efficiency (%)", f"{collection_eff:.2f}"])
        w.writerow([])

        w.writerow(["=== PAYMENT METHOD BREAKDOWN ==="])
        w.writerow(["Method", "Amount (INR)", "Count"])
        for row in pay_rows:
            method = row[0].value if hasattr(row[0], "value") else str(row[0] or "")
            w.writerow([method, f"{_to_number(row[1]):.2f}", int(row[2] or 0)])
        w.writerow([])

        w.writerow(["=== GST SUMMARY ==="])
        w.writerow(["Component", "Amount (INR)"])
        w.writerow(["Taxable Value", f"{_to_number(gst_row[3]):.2f}"])
        w.writerow(["CGST Collected", f"{_to_number(gst_row[0]):.2f}"])
        w.writerow(["SGST Collected", f"{_to_number(gst_row[1]):.2f}"])
        w.writerow(["IGST Collected", f"{_to_number(gst_row[2]):.2f}"])
        w.writerow(["Net GST Payable", f"{(_to_number(gst_row[0]) + _to_number(gst_row[1]) + _to_number(gst_row[2])):.2f}"])
        w.writerow([])

        w.writerow(["=== OUTSTANDING RECEIVABLES ==="])
        w.writerow(["Category", "Amount (INR)"])
        w.writerow(["Overdue", f"{_to_number(os_row[0]):.2f}"])
        w.writerow(["Partially Paid", f"{_to_number(os_row[1]):.2f}"])
        w.writerow(["Disputed", f"{_to_number(os_row[2]):.2f}"])
        w.writerow([])

        w.writerow(["=== TDS SUMMARY ==="])
        w.writerow(["Total TDS Deducted", f"{_to_number(tds_row[0]):.2f}"])
        w.writerow(["Number of Payments", int(tds_row[1] or 0)])
        w.writerow([])

        w.writerow(["=== LEDGER ENTRIES ==="])
        w.writerow(["Date", "Entry No.", "Type", "Account", "Narration", "Reference", "Debit (INR)", "Credit (INR)", "Balance (INR)"])
        for row in ledger_rows:
            w.writerow([
                row.entry_date.isoformat() if row.entry_date else "",
                row.entry_number,
                row.ledger_type.value if hasattr(row.ledger_type, "value") else str(row.ledger_type or ""),
                row.account_name,
                row.narration or "",
                row.reference_number or "",
                f"{_to_number(row.debit):.2f}",
                f"{_to_number(row.credit):.2f}",
                f"{_to_number(row.balance):.2f}",
            ])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename_base}.csv"},
        )

    else:  # PDF using reportlab
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
        )

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5 * cm, bottomMargin=2 * cm,
                                 leftMargin=2 * cm, rightMargin=2 * cm)
        styles = getSampleStyleSheet()
        elements = []

        NAVY = colors.HexColor("#0F172A")
        AMBER = colors.HexColor("#F59E0B")
        SUCCESS = colors.HexColor("#10B981")
        DANGER = colors.HexColor("#EF4444")
        LIGHT = colors.HexColor("#F8FAFC")
        HEADER_BG = colors.HexColor("#1B2A4A")

        title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=18,
                                      textColor=NAVY, spaceAfter=4)
        sub_style = ParagraphStyle("sub", parent=styles["Normal"], fontSize=10,
                                    textColor=colors.gray, spaceAfter=12)
        section_style = ParagraphStyle("section", parent=styles["Heading2"], fontSize=12,
                                        textColor=NAVY, spaceBefore=14, spaceAfter=6,
                                        borderPad=4)

        def section_table(data, col_widths, header_bg=HEADER_BG):
            t = Table(data, colWidths=col_widths)
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), header_bg),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 1), (-1, -1), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT, colors.white]),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            return t

        # Title
        elements.append(Paragraph("Kavya Transports — Auditor Report", title_style))
        elements.append(Paragraph(f"Period: {from_date.strftime('%d %b %Y')} to {to_date.strftime('%d %b %Y')}  |  Generated: {today.strftime('%d %b %Y')}", sub_style))

        # 1. P&L
        elements.append(Paragraph("1. Profit & Loss Summary", section_style))
        pl_data = [
            ["Metric", "Amount (₹)"],
            ["Total Invoiced", f"{total_invoiced:,.2f}"],
            ["Total Collected", f"{total_collected:,.2f}"],
            ["Total Expenses", f"{total_expenses:,.2f}"],
            ["Net Profit / (Loss)", f"{net_profit:,.2f}"],
            ["Collection Efficiency", f"{collection_eff:.1f}%"],
        ]
        elements.append(section_table(pl_data, [10 * cm, 6 * cm]))
        elements.append(Spacer(1, 0.3 * cm))

        # 2. Payment Breakdown
        elements.append(Paragraph("2. Payment Method Breakdown", section_style))
        pay_data = [["Method", "Amount (₹)", "Transactions"]]
        for row in pay_rows:
            method = row[0].value if hasattr(row[0], "value") else str(row[0] or "")
            pay_data.append([method, f"{_to_number(row[1]):,.2f}", str(int(row[2] or 0))])
        if len(pay_data) == 1:
            pay_data.append(["No payment records", "—", "—"])
        elements.append(section_table(pay_data, [7 * cm, 5.5 * cm, 3.5 * cm]))
        elements.append(Spacer(1, 0.3 * cm))

        # 3. GST
        elements.append(Paragraph("3. GST Summary", section_style))
        gst_data = [
            ["Component", "Amount (₹)"],
            ["Taxable Value", f"{_to_number(gst_row[3]):,.2f}"],
            ["CGST Collected", f"{_to_number(gst_row[0]):,.2f}"],
            ["SGST Collected", f"{_to_number(gst_row[1]):,.2f}"],
            ["IGST Collected", f"{_to_number(gst_row[2]):,.2f}"],
            ["Net GST Payable", f"{(_to_number(gst_row[0]) + _to_number(gst_row[1]) + _to_number(gst_row[2])):,.2f}"],
        ]
        gt = section_table(gst_data, [10 * cm, 6 * cm])
        gt.setStyle(TableStyle([
            ("BACKGROUND", (0, len(gst_data) - 1), (-1, len(gst_data) - 1), AMBER),
            ("TEXTCOLOR", (0, len(gst_data) - 1), (-1, len(gst_data) - 1), colors.white),
            ("FONTNAME", (0, len(gst_data) - 1), (-1, len(gst_data) - 1), "Helvetica-Bold"),
        ]))
        elements.append(gt)
        elements.append(Spacer(1, 0.3 * cm))

        # 4. Outstanding
        elements.append(Paragraph("4. Outstanding Receivables", section_style))
        os_data = [
            ["Category", "Amount (₹)"],
            ["Overdue", f"{_to_number(os_row[0]):,.2f}"],
            ["Partially Paid", f"{_to_number(os_row[1]):,.2f}"],
            ["Disputed", f"{_to_number(os_row[2]):,.2f}"],
            ["Total Outstanding", f"{_to_number(inv_pl[2]):,.2f}"],
        ]
        elements.append(section_table(os_data, [10 * cm, 6 * cm]))
        elements.append(Spacer(1, 0.3 * cm))

        # 5. TDS
        elements.append(Paragraph("5. TDS Summary", section_style))
        tds_data = [
            ["Description", "Value"],
            ["Total TDS Deducted", f"₹ {_to_number(tds_row[0]):,.2f}"],
            ["Number of Payments with TDS", str(int(tds_row[1] or 0))],
        ]
        elements.append(section_table(tds_data, [10 * cm, 6 * cm]))
        elements.append(Spacer(1, 0.3 * cm))

        # 6. Ledger
        elements.append(Paragraph("6. Ledger Entries", section_style))
        ledger_data = [["Date", "Entry No.", "Type", "Account", "Narration", "Debit (₹)", "Credit (₹)", "Balance (₹)"]]
        for row in ledger_rows[:200]:  # cap at 200 in PDF
            ledger_data.append([
                row.entry_date.strftime("%d/%m/%y") if row.entry_date else "",
                row.entry_number or "",
                (row.ledger_type.value if hasattr(row.ledger_type, "value") else str(row.ledger_type or ""))[:10],
                (row.account_name or "")[:20],
                (row.narration or "")[:25],
                f"{_to_number(row.debit):,.2f}",
                f"{_to_number(row.credit):,.2f}",
                f"{_to_number(row.balance):,.2f}",
            ])
        if len(ledger_data) == 1:
            ledger_data.append(["No ledger entries", "", "", "", "", "", "", ""])
        ledger_t = Table(ledger_data, colWidths=[1.6 * cm, 2.2 * cm, 1.8 * cm, 3.2 * cm, 3.6 * cm, 2.2 * cm, 2.2 * cm, 2.2 * cm])
        ledger_t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT, colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
            ("ALIGN", (5, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        elements.append(ledger_t)

        doc.build(elements)
        buf.seek(0)

        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename_base}.pdf"},
        )
