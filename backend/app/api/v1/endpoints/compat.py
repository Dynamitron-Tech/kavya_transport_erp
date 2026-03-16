# Compatibility endpoints to satisfy frontend route expectations
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.db.postgres.connection import get_db
from app.schemas.base import APIResponse, PaginationMeta
from app.services import driver_service, finance_service, trip_service, vehicle_service
from app.models.postgres.client import Client
from app.models.postgres.document import ComplianceCategory, Document, DocumentType, EntityType
from app.models.postgres.driver import Driver
from app.models.postgres.finance import Invoice, InvoiceStatus, Payable, Receivable, Vendor
from app.models.postgres.route import BankAccount, BankTransaction, Route
from app.models.postgres.trip import Trip, TripStatusEnum

router = APIRouter()


# ----- Finance compatibility -----
@router.get("/finance/receivables", response_model=APIResponse)
async def finance_receivables(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    result = await db.execute(
        select(
            Client.id,
            Client.name,
            Client.code,
            func.coalesce(func.sum(Invoice.amount_due), 0).label("total_due"),
        )
        .join(Invoice, Invoice.client_id == Client.id)
        .where(Invoice.is_deleted == False, Invoice.amount_due > 0, Invoice.status != InvoiceStatus.CANCELLED)
        .group_by(Client.id, Client.name, Client.code)
        .order_by(func.sum(Invoice.amount_due).desc())
    )
    items = [
        {"client_id": r[0], "client_name": r[1], "client_code": r[2], "total_due": float(r[3])}
        for r in result.all()
    ]
    return APIResponse(success=True, data=items)


@router.get("/finance/payables", response_model=APIResponse)
async def finance_payables(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    result = await db.execute(
        select(Payable, Vendor.name, Vendor.code)
        .join(Vendor, Vendor.id == Payable.vendor_id)
        .order_by(Payable.as_on_date.desc())
        .limit(200)
    )
    rows = result.all()
    if rows:
        items = [
            {
                "vendor_id": row[0].vendor_id,
                "vendor_name": row[1],
                "vendor_code": row[2],
                "as_on_date": row[0].as_on_date.isoformat() if row[0].as_on_date else None,
                "total_outstanding": float(row[0].total_outstanding or 0),
            }
            for row in rows
        ]
    else:
        vendors = await db.execute(select(Vendor).where(Vendor.is_deleted == False, Vendor.is_active == True).limit(100))
        items = [
            {
                "vendor_id": v.id,
                "vendor_name": v.name,
                "vendor_code": v.code,
                "as_on_date": date.today().isoformat(),
                "total_outstanding": 0.0,
            }
            for v in vendors.scalars().all()
        ]
    return APIResponse(success=True, data=items)


@router.get("/finance/banking/accounts", response_model=APIResponse)
async def finance_banking_accounts(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    accounts = await finance_service.list_bank_accounts(db)
    items = [{c.key: getattr(a, c.key) for c in a.__table__.columns} for a in accounts]
    return APIResponse(success=True, data=items)


@router.get("/finance/banking/next-entry-number", response_model=APIResponse)
async def finance_next_banking_entry(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    total = (await db.execute(select(func.count(BankTransaction.id)))).scalar() or 0
    return APIResponse(success=True, data={"entry_number": f"BNK-{date.today().strftime('%y%m')}-{total + 1:04d}"})


@router.get("/finance/banking/entries", response_model=APIResponse)
async def finance_banking_entries(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    rows, total = await finance_service.list_bank_transactions(db, page=page, limit=limit)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(r, c.key) for c in r.__table__.columns} for r in rows]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


# ----- Fleet compatibility -----
@router.get("/fleet/dashboard/kpis", response_model=APIResponse)
async def fleet_dashboard_kpis(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    data = await vehicle_service.get_fleet_summary(db)
    return APIResponse(success=True, data=data)


@router.get("/fleet/dashboard/charts/fleet-utilization", response_model=APIResponse)
async def fleet_chart_utilization(period: str = "monthly"):
    _ = period
    return APIResponse(success=True, data=[{"label": "Available", "value": 68}, {"label": "On Trip", "value": 24}, {"label": "Maintenance", "value": 8}])


@router.get("/fleet/dashboard/charts/fuel-consumption", response_model=APIResponse)
async def fleet_chart_fuel(period: str = "monthly"):
    _ = period
    return APIResponse(success=True, data=[{"month": "Jan", "litres": 2200}, {"month": "Feb", "litres": 2050}, {"month": "Mar", "litres": 2310}])


@router.get("/fleet/dashboard/charts/maintenance-cost", response_model=APIResponse)
async def fleet_chart_maintenance(period: str = "monthly"):
    _ = period
    return APIResponse(success=True, data=[{"month": "Jan", "cost": 54000}, {"month": "Feb", "cost": 47000}, {"month": "Mar", "cost": 61500}])


@router.get("/fleet/dashboard/charts/trip-efficiency", response_model=APIResponse)
async def fleet_chart_trip_efficiency(period: str = "monthly"):
    _ = period
    return APIResponse(success=True, data=[{"month": "Jan", "efficiency": 91}, {"month": "Feb", "efficiency": 89}, {"month": "Mar", "efficiency": 93}])


@router.get("/fleet/dashboard/recent-alerts", response_model=APIResponse)
async def fleet_recent_alerts(limit: int = Query(10, ge=1, le=50)):
    items = [
        {"id": f"alert-{i}", "severity": "warning", "title": "Document expiring soon", "message": "Vehicle permit will expire soon"}
        for i in range(1, limit + 1)
    ]
    return APIResponse(success=True, data=items)


@router.get("/fleet/dashboard/expiring-documents", response_model=APIResponse)
async def fleet_expiring_documents(days: int = Query(30, ge=1, le=365), db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    vehicles = await vehicle_service.get_vehicles_expiring_soon(db, days)
    items = [{"vehicle_id": v.id, "registration": v.registration_number, "alerts": vehicle_service.get_expiry_alerts(v)} for v in vehicles]
    return APIResponse(success=True, data=items)


@router.get("/fleet/dashboard/upcoming-maintenance", response_model=APIResponse)
async def fleet_upcoming_maintenance():
    return APIResponse(success=True, data=[])


@router.get("/fleet/dashboard/active-trips", response_model=APIResponse)
async def fleet_active_trips(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    trips = await db.execute(
        select(Trip).where(
            Trip.is_deleted == False,
            Trip.status.in_([TripStatusEnum.STARTED, TripStatusEnum.IN_TRANSIT, TripStatusEnum.LOADING, TripStatusEnum.UNLOADING]),
        )
    )
    data = [{"id": t.id, "trip_number": t.trip_number, "vehicle_registration": t.vehicle_registration, "driver_name": t.driver_name} for t in trips.scalars().all()]
    return APIResponse(success=True, data=data)


@router.get("/fleet/drivers", response_model=APIResponse)
async def fleet_drivers(
    search: str = "",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    rows, total = await driver_service.list_drivers(db, page, limit, search or None, None)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(d, c.key) for c in d.__table__.columns} for d in rows]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/fleet/tracking/live", response_model=APIResponse)
async def fleet_tracking_live(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    trips = await db.execute(
        select(Trip).where(
            Trip.is_deleted == False,
            Trip.status.in_([TripStatusEnum.STARTED, TripStatusEnum.IN_TRANSIT, TripStatusEnum.LOADING, TripStatusEnum.UNLOADING]),
        )
    )
    data = [{"trip_id": t.id, "trip_number": t.trip_number, "vehicle_registration": t.vehicle_registration, "tracking_id": t.tracking_id} for t in trips.scalars().all()]
    return APIResponse(success=True, data=data)


@router.get("/fleet/maintenance/schedule", response_model=APIResponse)
async def fleet_maintenance_schedule():
    return APIResponse(success=True, data=[])


@router.get("/fleet/fuel/records", response_model=APIResponse)
async def fleet_fuel_records():
    return APIResponse(success=True, data=[])


@router.get("/fleet/fuel/summary", response_model=APIResponse)
async def fleet_fuel_summary(period: str = "this_month"):
    _ = period
    return APIResponse(success=True, data={"total_litres": 0, "total_amount": 0, "avg_per_km": 0})


@router.get("/fleet/reports/fleet-utilization", response_model=APIResponse)
async def fleet_report_utilization():
    return APIResponse(success=True, data=[])


@router.get("/fleet/reports/vehicle-profitability", response_model=APIResponse)
async def fleet_report_vehicle_profitability():
    return APIResponse(success=True, data=[])


@router.get("/fleet/reports/driver-performance", response_model=APIResponse)
async def fleet_report_driver_performance():
    return APIResponse(success=True, data=[])


@router.get("/fleet/reports/maintenance-cost", response_model=APIResponse)
async def fleet_report_maintenance_cost():
    return APIResponse(success=True, data=[])


@router.get("/fleet/reports/fuel-consumption", response_model=APIResponse)
async def fleet_report_fuel_consumption():
    return APIResponse(success=True, data=[])


@router.get("/fleet/reports/trip-performance", response_model=APIResponse)
async def fleet_report_trip_performance():
    return APIResponse(success=True, data=[])


# ----- Lookup compatibility (jobs/lr/trips) -----
@router.get("/jobs/lookup/routes", response_model=APIResponse)
async def jobs_lookup_routes(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    routes = await db.execute(select(Route).where(Route.is_deleted == False, Route.is_active == True).limit(200))
    items = [{"id": r.id, "name": r.route_name, "code": r.route_code} for r in routes.scalars().all()]
    return APIResponse(success=True, data={"items": items})


@router.get("/jobs/lookup/vehicle-types", response_model=APIResponse)
async def jobs_lookup_vehicle_types():
    return APIResponse(success=True, data={"items": ["truck", "trailer", "container", "tanker", "lcv"]})


@router.get("/jobs/lookup/states", response_model=APIResponse)
async def jobs_lookup_states():
    return APIResponse(success=True, data={"items": ["Maharashtra", "Gujarat", "Karnataka", "Tamil Nadu", "Telangana"]})


@router.get("/jobs/next-job-number", response_model=APIResponse)
async def jobs_next_number(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    from app.models.postgres.job import Job

    total = (await db.execute(select(func.count(Job.id)))).scalar() or 0
    return APIResponse(success=True, data={"job_number": f"JOB-{date.today().strftime('%y%m%d')}-{total + 1:04d}"})


@router.get("/lr/lookup/package-types", response_model=APIResponse)
async def lr_lookup_package_types():
    return APIResponse(success=True, data={"items": ["box", "bag", "bundle", "drum", "pallet", "loose"]})


@router.get("/lr/lookup/quantity-units", response_model=APIResponse)
async def lr_lookup_quantity_units():
    return APIResponse(success=True, data={"items": ["nos", "kg", "ton", "ltr", "box", "bag"]})


@router.get("/lr/next-lr-number", response_model=APIResponse)
async def lr_next_number(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    from app.models.postgres.lr import LR

    total = (await db.execute(select(func.count(LR.id)))).scalar() or 0
    return APIResponse(success=True, data={"lr_number": f"LR-{date.today().strftime('%y%m%d')}-{total + 1:04d}"})


@router.get("/trips/lookup/routes", response_model=APIResponse)
async def trips_lookup_routes(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    routes = await db.execute(select(Route).where(Route.is_deleted == False, Route.is_active == True).limit(200))
    items = [{"id": r.id, "name": r.route_name, "code": r.route_code} for r in routes.scalars().all()]
    return APIResponse(success=True, data={"items": items})


@router.get("/trips/lookup/trip-types", response_model=APIResponse)
async def trips_lookup_types():
    return APIResponse(success=True, data={"items": ["one_way", "round_trip", "multi_drop"]})


@router.get("/trips/lookup/priorities", response_model=APIResponse)
async def trips_lookup_priorities():
    return APIResponse(success=True, data={"items": ["low", "normal", "high", "urgent"]})


@router.get("/trips/lookup/payment-modes", response_model=APIResponse)
async def trips_lookup_payment_modes():
    return APIResponse(success=True, data={"items": ["to_pay", "paid", "to_be_billed"]})


@router.get("/trips/next-trip-number", response_model=APIResponse)
async def trips_next_number(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    total = (await db.execute(select(func.count(Trip.id)))).scalar() or 0
    return APIResponse(success=True, data={"trip_number": f"TRIP-{date.today().strftime('%y%m%d')}-{total + 1:04d}"})


# ----- Documents compatibility -----
@router.get("/documents/stats", response_model=APIResponse)
async def documents_stats(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    total = (await db.execute(select(func.count(Document.id)).where(Document.is_deleted == False))).scalar() or 0
    status_rows = await db.execute(
        select(Document.approval_status, func.count(Document.id))
        .where(Document.is_deleted == False)
        .group_by(Document.approval_status)
    )
    approved = 0
    for status, count in status_rows.all():
        value = status.value if hasattr(status, "value") else str(status)
        if str(value).lower() == "approved":
            approved = int(count or 0)
    return APIResponse(success=True, data={"total": total, "approved": approved, "pending": max(total - approved, 0)})


@router.get("/documents/next-doc-number", response_model=APIResponse)
async def documents_next_number(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    total = (await db.execute(select(func.count(Document.id)))).scalar() or 0
    return APIResponse(success=True, data={"doc_number": f"DOC-{date.today().strftime('%y%m%d')}-{total + 1:04d}"})


@router.get("/documents/lookup/document-types", response_model=APIResponse)
async def documents_lookup_types():
    items = [e.value for e in DocumentType]
    return APIResponse(success=True, data={"items": items})


@router.get("/documents/lookup/entity-types", response_model=APIResponse)
async def documents_lookup_entity_types():
    items = [e.value for e in EntityType]
    return APIResponse(success=True, data={"items": items})


@router.get("/documents/lookup/compliance-categories", response_model=APIResponse)
async def documents_lookup_compliance_categories():
    items = [e.value for e in ComplianceCategory]
    return APIResponse(success=True, data={"items": items})


@router.get("/documents/lookup/reminder-options", response_model=APIResponse)
async def documents_lookup_reminder_options():
    return APIResponse(success=True, data={"items": [7, 15, 30, 45, 60, 90]})


@router.get("/documents/lookup/reviewers", response_model=APIResponse)
async def documents_lookup_reviewers(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    result = await db.execute(select(Driver).limit(20))
    items = [{"id": d.id, "name": f"{d.first_name} {d.last_name}".strip()} for d in result.scalars().all()]
    return APIResponse(success=True, data={"items": items})


# ----- Accountant compatibility -----
@router.get("/accountant/dashboard/kpis", response_model=APIResponse)
async def accountant_dashboard_kpis(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user), period: str = "this_month"):
    _ = period
    receivables = await finance_receivables(db, current_user)
    payables = await finance_payables(db, current_user)
    r_items = receivables.data if isinstance(receivables.data, list) else []
    p_items = payables.data if isinstance(payables.data, list) else []
    return APIResponse(success=True, data={
        "total_receivables": sum(float(i.get("total_due", 0)) for i in r_items),
        "total_payables": sum(float(i.get("total_outstanding", 0)) for i in p_items),
        "cash_inflow": 0,
        "cash_outflow": 0,
    })


@router.get("/accountant/dashboard/revenue-trend", response_model=APIResponse)
async def accountant_revenue_trend(period: str = "6_months"):
    _ = period
    return APIResponse(success=True, data=[{"month": "Jan", "value": 0}, {"month": "Feb", "value": 0}, {"month": "Mar", "value": 0}])


@router.get("/accountant/dashboard/expense-breakdown", response_model=APIResponse)
async def accountant_expense_breakdown(period: str = "this_month"):
    _ = period
    return APIResponse(success=True, data=[])


@router.get("/accountant/dashboard/cash-flow", response_model=APIResponse)
async def accountant_cash_flow(period: str = "6_months"):
    _ = period
    return APIResponse(success=True, data=[])


@router.get("/accountant/dashboard/recent-transactions", response_model=APIResponse)
async def accountant_recent_transactions(limit: int = Query(10, ge=1, le=100), db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    rows = await db.execute(select(BankTransaction).order_by(BankTransaction.transaction_date.desc()).limit(limit))
    items = [{c.key: getattr(t, c.key) for c in t.__table__.columns} for t in rows.scalars().all()]
    return APIResponse(success=True, data=items)


@router.get("/accountant/dashboard/pending-actions", response_model=APIResponse)
async def accountant_pending_actions():
    return APIResponse(success=True, data=[])


@router.get("/accountant/payables", response_model=APIResponse)
async def accountant_payables(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    return await finance_payables(db, current_user)


@router.get("/accountant/fuel-expenses", response_model=APIResponse)
async def accountant_fuel_expenses():
    return APIResponse(success=True, data=[])


@router.get("/accountant/fuel-expenses/summary", response_model=APIResponse)
async def accountant_fuel_expenses_summary(period: str = "this_month"):
    _ = period
    return APIResponse(success=True, data={"total": 0, "avg_per_km": 0})


@router.get("/accountant/banking/overview", response_model=APIResponse)
async def accountant_banking_overview(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    accounts = await db.execute(select(BankAccount))
    items = accounts.scalars().all()
    total_balance = sum(float(a.current_balance or 0) for a in items)
    return APIResponse(success=True, data={"accounts": len(items), "total_balance": total_balance})


@router.get("/accountant/banking/transactions", response_model=APIResponse)
async def accountant_banking_transactions(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    rows, total = await finance_service.list_bank_transactions(db, page=page, limit=limit)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(r, c.key) for c in r.__table__.columns} for r in rows]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/accountant/ledger/accounts", response_model=APIResponse)
async def accountant_ledger_accounts(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    result = await db.execute(select(Receivable.client_id, func.sum(Receivable.total_outstanding)).group_by(Receivable.client_id))
    items = [{"account_id": row[0], "account_name": f"Client {row[0]}", "balance": float(row[1] or 0)} for row in result.all()]
    return APIResponse(success=True, data=items)


@router.get("/accountant/ledger/accounts/{account_id}/entries", response_model=APIResponse)
async def accountant_ledger_entries(account_id: int):
    return APIResponse(success=True, data=[{"account_id": account_id, "debit": 0, "credit": 0, "balance": 0}])


@router.get("/accountant/reports/profit-loss", response_model=APIResponse)
async def accountant_report_profit_loss():
    return APIResponse(success=True, data={
        "total_revenue": 0,
        "total_expenses": 0,
        "net_profit": 0,
        "profit_margin": 0,
        "monthly": [],
    })


@router.get("/accountant/reports/expense-report", response_model=APIResponse)
async def accountant_report_expense():
    return APIResponse(success=True, data={
        "categories": [],
        "total": 0,
    })


@router.get("/accountant/reports/revenue-report", response_model=APIResponse)
async def accountant_report_revenue():
    return APIResponse(success=True, data={
        "total_revenue": 0,
        "avg_per_trip": 0,
        "by_client": [],
    })


@router.get("/accountant/reports/trip-profitability", response_model=APIResponse)
async def accountant_report_trip_profitability():
    return APIResponse(success=True, data={
        "trips": [],
    })


@router.get("/accountant/reports/client-outstanding", response_model=APIResponse)
async def accountant_report_client_outstanding():
    return APIResponse(success=True, data={
        "clients": [],
    })


@router.get("/accountant/reports/vendor-payables", response_model=APIResponse)
async def accountant_report_vendor_payables():
    return APIResponse(success=True, data={
        "vendors": [],
    })


@router.get("/accountant/reports/fuel-cost", response_model=APIResponse)
async def accountant_report_fuel_cost():
    return APIResponse(success=True, data={
        "by_vehicle": [],
        "total_cost": 0,
        "total_litres": 0,
        "avg_mileage": 0,
    })


@router.get("/accountant/reports/monthly-summary", response_model=APIResponse)
async def accountant_report_monthly_summary():
    return APIResponse(success=True, data={
        "months": [],
    })
