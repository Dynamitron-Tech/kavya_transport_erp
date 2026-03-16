# Reports Endpoints
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal
from typing import Any, Optional, Tuple
import csv
import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.db.postgres.connection import get_db
from app.middleware.permissions import Permissions, require_permission
from app.models.postgres.client import Client
from app.models.postgres.driver import Driver, DriverAttendance
from app.models.postgres.finance import Invoice
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
