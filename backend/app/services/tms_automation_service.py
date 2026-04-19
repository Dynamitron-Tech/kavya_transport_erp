"""
TMS Automation Service
======================
Central service for all 18 TMS zero-cost automations.

EVT-01  Auto-draft EWB on LR generation                → evt_01_draft_ewb()
EVT-02  Auto-create invoice on POD verification        → evt_02_invoice_on_pod()
EVT-03  Auto-notify driver on trip dispatch            → evt_03_notify_driver_dispatch()
EVT-04  Auto-update vehicle status on trip lifecycle   → evt_04_sync_vehicle_status()
EVT-05  Compliance alerts on document upload           → evt_05_compliance_alerts()
EVT-06  Auto-close trip when all LRs have POD          → evt_06_trip_closure_on_pod()

SCH-01  Daily document expiry digest                   → sch_01_expiry_digest()
SCH-02  Weekly payment reminders                       → sch_02_payment_reminders()
SCH-03  Predictive maintenance by odometer             → sch_03_predictive_maintenance()
SCH-04  Monthly P&L summary                            → sch_04_monthly_pnl()
SCH-05  Fuel efficiency anomaly detection              → sch_05_fuel_efficiency()
SCH-06  Stale trip detection                           → sch_06_stale_trips()
SCH-07  Daily tank low-level alert to fleet_manager    → sch_07_tank_low_level_alert()

EVT-07  Mark overdue invoices (daily cron)             → evt_07_mark_overdue_invoices()

RUL-01  Credit limit enforcement on job creation       → rul_01_check_credit_limit()
RUL-02  Duplicate LR number guard                      → rul_02_check_duplicate_lr()
RUL-03  Expense anomaly flag                           → rul_03_flag_expense_anomaly()
RUL-04  Auto-suggest vehicle type from cargo weight    → rul_04_suggest_vehicle_type()
RUL-05  Driver attendance streak badge                 → rul_05_attendance_streak()
"""

import logging
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text

from app.models.postgres.trip import Trip, TripExpense, TripStatusEnum, ExpenseCategory
from app.models.postgres.lr import LR, LRStatus
from app.models.postgres.vehicle import Vehicle, VehicleStatus
from app.models.postgres.client import Client
from app.models.postgres.job import Job
from app.models.postgres.driver import Driver, DriverAttendance
from app.models.postgres.route import Route
from app.models.postgres.finance import Invoice, InvoiceStatus
from app.models.postgres.compliance_alert import ComplianceAlert, AlertType, AlertSeverity
from app.models.postgres.finance_automation import FinanceAlert, FinanceAlertType, FinanceAlertSeverity

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# EVT-01  Auto-draft EWB on LR generation
# ---------------------------------------------------------------------------

async def evt_01_draft_ewb(db: AsyncSession, lr_id: int) -> None:
    """
    Fire-and-forget: draft an e-way bill for a freshly generated LR.
    Called as a BackgroundTask from the generate_lr endpoint.
    Stores the draft id in lr.ewb_draft_id (nullable).
    """
    try:
        lr = await db.get(LR, lr_id)
        if not lr:
            return
        if lr.ewb_draft_id:
            return  # idempotency guard

        # Build draft payload from LR fields
        draft_payload = {
            "lr_number": lr.lr_number,
            "consignor_gstin": lr.consignor_gstin,
            "consignee_gstin": lr.consignee_gstin,
            "eway_bill_number": lr.eway_bill_number,
            "declared_value": float(lr.declared_value) if lr.declared_value else 0,
            "origin": lr.origin,
            "destination": lr.destination,
        }

        from app.services.eway_service import create_eway_bill
        ewb = await create_eway_bill(db, draft_payload)
        if ewb and ewb.id:
            lr.ewb_draft_id = str(ewb.id)
            await db.commit()
            logger.info(f"EVT-01: EWB draft {ewb.id} linked to LR {lr_id}")
    except Exception as exc:
        logger.error(f"EVT-01: Failed to draft EWB for LR {lr_id}: {exc}", exc_info=True)


# ---------------------------------------------------------------------------
# EVT-02  Auto-create invoice on POD verification
# ---------------------------------------------------------------------------

async def evt_02_invoice_on_pod(db: AsyncSession, trip_id: int, user_id: int) -> None:
    """
    Called after any LR POD verification. If *all* LRs for the trip now have
    POD status, auto-generate an invoice (if one doesn't already exist).
    """
    try:
        from app.services.invoice_automation_service import auto_generate_invoice_on_delivery
        from app.services.notification_service import notification_service
        from app.websocket.manager import websocket_manager

        # Count LRs that are NOT yet pod-verified
        pending_q = await db.execute(
            select(func.count(LR.id)).where(
                LR.trip_id == trip_id,
                LR.pod_verified.is_(False),
                LR.is_deleted.is_(False),
            )
        )
        pending = pending_q.scalar() or 0
        if pending > 0:
            return  # More LRs still waiting for POD

        invoice = await auto_generate_invoice_on_delivery(db, trip_id)
        if invoice:
            logger.info(f"EVT-02: Invoice {invoice.id} auto-generated for trip {trip_id}")
            await db.commit()
            await notification_service.send(
                db,
                event_type="INVOICE_AUTO_GENERATED",
                title="Invoice ready",
                body=f"Invoice auto-generated for trip #{trip_id}. Ready for dispatch.",
                target_roles=["accountant", "manager"],
                data={"trip_id": trip_id, "invoice_id": invoice.id},
                urgency="normal",
                triggered_by=user_id,
            )
            await websocket_manager.broadcast(
                {"type": "invoice_queue", "trip_id": trip_id, "invoice_id": invoice.id},
                channel="invoice_queue",
            )
    except Exception as exc:
        logger.error(f"EVT-02: Failed invoice auto-gen for trip {trip_id}: {exc}", exc_info=True)


# ---------------------------------------------------------------------------
# EVT-03  Auto-notify driver on trip dispatch / start
# ---------------------------------------------------------------------------

async def evt_03_notify_driver_dispatch(db: AsyncSession, trip_id: int, user_id: int) -> None:
    """
    Send WhatsApp / push notification to the assigned driver when the trip is started.
    """
    try:
        from app.services.notification_service import notification_service

        trip = await db.get(Trip, trip_id)
        if not trip or not trip.driver_id:
            return

        driver = await db.get(Driver, trip.driver_id)
        phone = driver.phone if driver else trip.driver_phone
        dispatch_ts = trip.actual_start or datetime.utcnow()

        title = "Trip dispatched"
        body = (
            f"Trip {trip.trip_number}: {trip.origin} → {trip.destination}. "
            f"Vehicle: {trip.vehicle_registration or 'TBD'}. "
            f"Dispatch: {dispatch_ts.strftime('%d-%b %H:%M')}."
        )

        await notification_service.send(
            db,
            event_type="DRIVER_DISPATCH",
            title=title,
            body=body,
            target_user_ids=[trip.driver_id] if trip.driver_id else [],
            data={"trip_id": trip_id, "vehicle": trip.vehicle_registration},
            urgency="high",
            triggered_by=user_id,
        )
        logger.info(f"EVT-03: Driver {trip.driver_id} notified for trip {trip_id}")
    except Exception as exc:
        logger.error(f"EVT-03: Driver dispatch notify failed for trip {trip_id}: {exc}", exc_info=True)


# ---------------------------------------------------------------------------
# EVT-04  Auto-update vehicle status on trip lifecycle
# ---------------------------------------------------------------------------

async def evt_04_sync_vehicle_status(
    db: AsyncSession,
    vehicle_id: int,
    trip_event: str,  # "started" | "completed" | "closed" | "cancelled"
    user_id: int,
) -> None:
    """
    Trip started → vehicle.status = ON_TRIP
    Trip completed / closed / cancelled → vehicle.status = AVAILABLE

    Raises nothing — errors are logged and swallowed so the main trip endpoint
    always succeeds.
    """
    try:
        vehicle = await db.get(Vehicle, vehicle_id)
        if not vehicle:
            return

        if trip_event == "started":
            vehicle.status = VehicleStatus.ON_TRIP
        elif trip_event in ("completed", "closed", "cancelled"):
            vehicle.status = VehicleStatus.AVAILABLE

        await db.commit()

        from app.websocket.manager import websocket_manager
        await websocket_manager.broadcast(
            {
                "type": "dashboard_update",
                "vehicle_id": vehicle_id,
                "status": vehicle.status.value,
            },
            channel="dashboard_updates",
        )
        logger.info(f"EVT-04: Vehicle {vehicle_id} status → {vehicle.status.value} (event={trip_event})")
    except Exception as exc:
        logger.error(f"EVT-04: Vehicle status sync failed for vehicle {vehicle_id}: {exc}", exc_info=True)


async def evt_04_check_vehicle_available(db: AsyncSession, vehicle_id: int) -> None:
    """
    Raises HTTP 422 if vehicle is in MAINTENANCE.
    Call this BEFORE committing the trip start.
    """
    from fastapi import HTTPException
    vehicle = await db.get(Vehicle, vehicle_id)
    if vehicle and vehicle.status == VehicleStatus.MAINTENANCE:
        raise HTTPException(
            status_code=422,
            detail=f"Vehicle {vehicle.registration_number} is under maintenance and cannot be dispatched.",
        )


# ---------------------------------------------------------------------------
# EVT-05  Compliance alerts on document upload / approval
# ---------------------------------------------------------------------------

async def evt_05_compliance_alerts(
    db: AsyncSession,
    entity_type: str,
    entity_id: int,
    doc_type: str,
    expiry_date: date,
    vehicle_id: Optional[int] = None,
    driver_id: Optional[int] = None,
) -> None:
    """
    Create 30-day and 7-day compliance alerts for documents with an expiry date.
    Idempotent: skips if a pending alert already exists for (entity_id, doc_type).
    """
    try:
        # Idempotency check
        existing_q = await db.execute(
            select(ComplianceAlert).where(
                ComplianceAlert.entity_type == entity_type,
                ComplianceAlert.entity_id == entity_id,
                ComplianceAlert.message.contains(doc_type),
                ComplianceAlert.resolved.is_(False),
            )
        )
        if existing_q.scalars().first():
            logger.debug(f"EVT-05: Alert already exists for {entity_type}/{entity_id}/{doc_type}")
            return

        expiry_dt = datetime.combine(expiry_date, datetime.min.time())
        alerts_data = [
            (expiry_dt - timedelta(days=30), AlertSeverity.MEDIUM, f"{doc_type} expiring in 30 days"),
            (expiry_dt - timedelta(days=7),  AlertSeverity.HIGH,   f"{doc_type} expiring in 7 days (CRITICAL)"),
        ]

        for scheduled_at, severity, msg in alerts_data:
            alert = ComplianceAlert(
                entity_type=entity_type,
                entity_id=entity_id,
                vehicle_id=vehicle_id,
                driver_id=driver_id,
                alert_type=AlertType.WARNING,
                severity=severity,
                title=f"Document expiry: {doc_type}",
                message=msg,
                due_date=scheduled_at,
                resolved=False,
            )
            db.add(alert)

        await db.commit()
        logger.info(f"EVT-05: 2 compliance alerts created for {entity_type}/{entity_id}/{doc_type}")
    except Exception as exc:
        logger.error(f"EVT-05: Compliance alert creation failed: {exc}", exc_info=True)


# ---------------------------------------------------------------------------
# EVT-06  Auto-close trip when all LRs have POD
# ---------------------------------------------------------------------------

async def evt_06_trip_closure_on_pod(db: AsyncSession, trip_id: int, user_id: int) -> None:
    """
    When all LRs in a trip are pod_verified, move trip → CLOSURE_PENDING
    and record pod_completed_at.
    """
    try:
        pending_q = await db.execute(
            select(func.count(LR.id)).where(
                LR.trip_id == trip_id,
                LR.pod_verified.is_(False),
                LR.is_deleted.is_(False),
            )
        )
        pending = pending_q.scalar() or 0
        if pending > 0:
            return

        trip = await db.get(Trip, trip_id)
        if not trip or trip.status not in (TripStatusEnum.IN_TRANSIT, TripStatusEnum.UNLOADING, TripStatusEnum.COMPLETED):
            return

        trip.status = TripStatusEnum.COMPLETED  # Use COMPLETED as closure-pending equivalent
        trip.pod_completed_at = datetime.utcnow()
        await db.commit()

        from app.services.notification_service import notification_service
        from app.websocket.manager import websocket_manager

        await notification_service.send(
            db,
            event_type="TRIP_POD_COMPLETE",
            title="All PODs received — trip ready for closure",
            body=f"Trip {trip.trip_number}: all LRs verified. Please close and generate invoice.",
            target_roles=["accountant", "manager"],
            data={"trip_id": trip_id},
            urgency="normal",
            triggered_by=user_id,
        )
        await websocket_manager.broadcast(
            {"type": "trip_updates", "trip_id": trip_id, "status": "pod_complete"},
            channel="trip_updates",
        )
        logger.info(f"EVT-06: Trip {trip_id} moved to CLOSURE_PENDING (pod_completed_at set)")
    except Exception as exc:
        logger.error(f"EVT-06: Trip closure on POD failed for trip {trip_id}: {exc}", exc_info=True)


# ---------------------------------------------------------------------------
# EVT-07  Mark overdue invoices (daily cron — 00:01)
# ---------------------------------------------------------------------------

async def evt_07_mark_overdue_invoices() -> None:
    """Bulk-update invoices past due_date to OVERDUE, insert FinanceAlerts."""
    from app.db.postgres.connection import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            today = date.today()
            overdue_q = await db.execute(
                select(Invoice).where(
                    Invoice.due_date < today,
                    Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.PARTIAL]),
                    Invoice.is_deleted.is_(False),
                )
            )
            overdue_invoices = overdue_q.scalars().all()

            if not overdue_invoices:
                logger.info("EVT-07: No invoices to mark overdue")
                return

            ids = []
            for inv in overdue_invoices:
                inv.status = InvoiceStatus.OVERDUE
                ids.append(inv.id)
                alert = FinanceAlert(
                    alert_type=FinanceAlertType.OVERDUE_INVOICE,
                    severity=FinanceAlertSeverity.HIGH,
                    title="Invoice overdue",
                    message=f"Invoice #{inv.invoice_number} is overdue (due {inv.due_date})",
                    invoice_id=inv.id,
                    client_id=inv.client_id,
                )
                db.add(alert)

            await db.commit()

            from app.websocket.manager import websocket_manager
            await websocket_manager.broadcast(
                {"type": "finance_alerts", "overdue_invoice_ids": ids},
                channel="finance_alerts",
            )
            logger.info(f"EVT-07: {len(ids)} invoices marked overdue")
        except Exception as exc:
            logger.error(f"EVT-07: Mark-overdue failed: {exc}", exc_info=True)
            await db.rollback()


# ---------------------------------------------------------------------------
# SCH-01  Daily document expiry digest (8:00 AM)
# ---------------------------------------------------------------------------

async def sch_01_expiry_digest() -> None:
    """
    Group compliance alerts into 0-7, 8-14, 15-30 day buckets and
    send a WhatsApp digest to all fleet_manager users.
    """
    from app.db.postgres.connection import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            today = date.today()
            upcoming = today + timedelta(days=30)
            q = await db.execute(
                select(ComplianceAlert).where(
                    ComplianceAlert.resolved.is_(False),
                    ComplianceAlert.due_date >= datetime.combine(today, datetime.min.time()),
                    ComplianceAlert.due_date <= datetime.combine(upcoming, datetime.min.time()),
                )
            )
            alerts = q.scalars().all()

            buckets = {"critical_7": [], "week_2": [], "month": []}
            for a in alerts:
                days_left = (a.due_date.date() - today).days if a.due_date else 999
                if days_left <= 7:
                    buckets["critical_7"].append(a)
                elif days_left <= 14:
                    buckets["week_2"].append(a)
                else:
                    buckets["month"].append(a)

            body_lines = [
                f"Document Expiry Digest — {today.strftime('%d %b %Y')}",
                f"CRITICAL (0-7 days): {len(buckets['critical_7'])} items",
                f"Soon (8-14 days): {len(buckets['week_2'])} items",
                f"Upcoming (15-30 days): {len(buckets['month'])} items",
            ]
            for a in buckets["critical_7"][:5]:
                body_lines.append(f"  ⚠ {a.title}: {a.message}")

            body = "\n".join(body_lines)
            from app.services.notification_service import notification_service
            await notification_service.send(
                db,
                event_type="DOCUMENT_EXPIRY_DIGEST",
                title="Document Expiry Digest",
                body=body,
                target_roles=["fleet_manager"],
                urgency="normal",
            )
            logger.info(f"SCH-01: Expiry digest sent ({len(alerts)} alerts)")
        except Exception as exc:
            logger.error(f"SCH-01: Expiry digest failed: {exc}", exc_info=True)


# ---------------------------------------------------------------------------
# SCH-02  Weekly payment reminders (Monday 9:00 AM)
# ---------------------------------------------------------------------------

async def sch_02_payment_reminders() -> None:
    """Send per-client overdue invoice reminders. Skip do_not_remind clients."""
    from app.db.postgres.connection import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            cutoff = date.today() - timedelta(days=15)
            overdue_q = await db.execute(
                select(Invoice).where(
                    Invoice.due_date < cutoff,
                    Invoice.status == InvoiceStatus.OVERDUE,
                    Invoice.is_deleted.is_(False),
                )
            )
            overdue_invoices = overdue_q.scalars().all()

            # Group by client
            by_client: dict[int, list] = {}
            for inv in overdue_invoices:
                by_client.setdefault(inv.client_id, []).append(inv)

            from app.services.notification_service import notification_service
            for client_id, invs in by_client.items():
                client = await db.get(Client, client_id)
                if not client or client.do_not_remind:
                    continue

                lines = [f"Payment reminder — {client.name}"]
                total_due = Decimal(0)
                for inv in invs:
                    lines.append(
                        f"  Invoice #{inv.invoice_number}: ₹{inv.total_amount} (due {inv.due_date})"
                    )
                    total_due += inv.total_amount or Decimal(0)
                lines.append(f"Total outstanding: ₹{total_due}")

                await notification_service.send(
                    db,
                    event_type="PAYMENT_REMINDER",
                    title=f"Payment reminder: {client.name}",
                    body="\n".join(lines),
                    target_roles=["accountant", "manager"],
                    data={"client_id": client_id, "invoice_count": len(invs)},
                    urgency="normal",
                )

            logger.info(f"SCH-02: Payment reminders sent for {len(by_client)} clients")
        except Exception as exc:
            logger.error(f"SCH-02: Payment reminders failed: {exc}", exc_info=True)


# ---------------------------------------------------------------------------
# SCH-03  Predictive maintenance by odometer (7:00 AM daily)
# ---------------------------------------------------------------------------

async def sch_03_predictive_maintenance() -> None:
    """
    Flag vehicles where (current_odometer - odometer_at_last_service) >= 10,000 km.
    Insert ComplianceAlert if one doesn't already exist.
    """
    from app.db.postgres.connection import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            vehicles_q = await db.execute(
                select(Vehicle).where(
                    Vehicle.odometer_at_last_service.isnot(None),
                    Vehicle.is_deleted.is_(False),
                )
            )
            vehicles = vehicles_q.scalars().all()

            count = 0
            for vehicle in vehicles:
                delta = (vehicle.odometer_reading or 0) - (vehicle.odometer_at_last_service or 0)
                if delta < 10000:
                    continue

                # Idempotency: skip if pending maintenance alert exists
                existing_q = await db.execute(
                    select(ComplianceAlert).where(
                        ComplianceAlert.vehicle_id == vehicle.id,
                        ComplianceAlert.entity_type == "vehicle",
                        ComplianceAlert.message.contains("maintenance"),
                        ComplianceAlert.resolved.is_(False),
                    )
                )
                if existing_q.scalars().first():
                    continue

                alert = ComplianceAlert(
                    entity_type="vehicle",
                    entity_id=vehicle.id,
                    vehicle_id=vehicle.id,
                    alert_type=AlertType.WARNING,
                    severity=AlertSeverity.HIGH,
                    title=f"Maintenance due: {vehicle.registration_number}",
                    message=(
                        f"Vehicle has travelled {int(delta):,} km since last service "
                        f"(threshold: 10,000 km). Schedule maintenance."
                    ),
                    due_date=datetime.utcnow(),
                    resolved=False,
                )
                db.add(alert)
                count += 1

            await db.commit()

            if count:
                from app.services.notification_service import notification_service
                await notification_service.send(
                    db,
                    event_type="MAINTENANCE_DUE",
                    title=f"{count} vehicle(s) due for maintenance",
                    body=f"{count} vehicles have exceeded 10,000 km since last service.",
                    target_roles=["fleet_manager"],
                    urgency="normal",
                )

            logger.info(f"SCH-03: {count} predictive maintenance alerts created")
        except Exception as exc:
            logger.error(f"SCH-03: Predictive maintenance check failed: {exc}", exc_info=True)


# ---------------------------------------------------------------------------
# SCH-04  Monthly P&L summary (1st of month, 8:00 AM)
# ---------------------------------------------------------------------------

async def sch_04_monthly_pnl() -> None:
    """
    Pull last-month's revenue, expenses, profit from finance_reports_service
    and WhatsApp/push to admin + manager role users.
    """
    from app.db.postgres.connection import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            today = date.today()
            first_of_last_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)

            from app.services.finance_reports_service import generate_monthly_close
            summary = await generate_monthly_close(
                db,
                year=first_of_last_month.year,
                month=first_of_last_month.month,
            )

            month_label = first_of_last_month.strftime("%B %Y")
            revenue = summary.get("total_revenue", 0)
            expenses = summary.get("total_expenses", 0)
            profit = summary.get("net_profit", revenue - expenses)

            body = (
                f"Monthly P&L — {month_label}\n"
                f"Revenue: ₹{revenue:,.0f}\n"
                f"Expenses: ₹{expenses:,.0f}\n"
                f"Net Profit: ₹{profit:,.0f}\n"
            )
            top_clients = summary.get("top_clients", [])
            if top_clients:
                body += "Top clients: " + ", ".join(
                    f"{c.get('name', c.get('client_id'))} (₹{c.get('revenue', 0):,.0f})"
                    for c in top_clients[:3]
                )

            from app.services.notification_service import notification_service
            await notification_service.send(
                db,
                event_type="MONTHLY_PNL",
                title=f"P&L Summary — {month_label}",
                body=body,
                target_roles=["admin", "manager"],
                urgency="normal",
            )
            logger.info(f"SCH-04: Monthly P&L sent for {month_label}")
        except Exception as exc:
            logger.error(f"SCH-04: Monthly P&L failed: {exc}", exc_info=True)


# ---------------------------------------------------------------------------
# SCH-05  Fuel efficiency anomaly detection (Sunday 6:00 AM)
# ---------------------------------------------------------------------------

async def sch_05_fuel_efficiency() -> None:
    """
    4-week rolling km/litre per vehicle. Flag if latest week drops > 15%.
    Insert ComplianceAlert + notify fleet_manager for critical (> 25%) drops.
    """
    from app.db.postgres.connection import AsyncSessionLocal
    from app.models.postgres.trip import TripFuelEntry

    async with AsyncSessionLocal() as db:
        try:
            today = date.today()
            week_start = today - timedelta(days=7)
            month_start = today - timedelta(days=28)

            vehicles_q = await db.execute(
                select(Vehicle).where(Vehicle.is_deleted.is_(False))
            )
            vehicles = vehicles_q.scalars().all()

            flagged = 0
            for vehicle in vehicles:
                # Current week fuel total
                cw_q = await db.execute(
                    select(
                        func.sum(TripFuelEntry.quantity_litres).label("litres"),
                    ).where(
                        TripFuelEntry.vehicle_id == vehicle.id,
                        TripFuelEntry.fuel_date >= week_start,
                    )
                )
                cw_litres = cw_q.scalar() or Decimal(0)

                # Same-period trip distance
                cw_km_q = await db.execute(
                    select(func.sum(Trip.actual_distance_km)).where(
                        Trip.vehicle_id == vehicle.id,
                        Trip.actual_end >= datetime.combine(week_start, datetime.min.time()),
                        Trip.actual_end.isnot(None),
                    )
                )
                cw_km = cw_km_q.scalar() or Decimal(0)

                if cw_litres < 1 or cw_km < 50:
                    continue

                current_efficiency = float(cw_km) / float(cw_litres)

                # 4-week baseline
                bw_q = await db.execute(
                    select(func.sum(TripFuelEntry.quantity_litres)).where(
                        TripFuelEntry.vehicle_id == vehicle.id,
                        TripFuelEntry.fuel_date >= month_start,
                        TripFuelEntry.fuel_date < week_start,
                    )
                )
                bw_litres = bw_q.scalar() or Decimal(0)
                bw_km_q = await db.execute(
                    select(func.sum(Trip.actual_distance_km)).where(
                        Trip.vehicle_id == vehicle.id,
                        Trip.actual_end >= datetime.combine(month_start, datetime.min.time()),
                        Trip.actual_end < datetime.combine(week_start, datetime.min.time()),
                        Trip.actual_end.isnot(None),
                    )
                )
                bw_km = bw_km_q.scalar() or Decimal(0)

                if bw_litres < 1 or bw_km < 50:
                    continue

                baseline_efficiency = float(bw_km) / float(bw_litres)
                drop_pct = (baseline_efficiency - current_efficiency) / baseline_efficiency * 100

                if drop_pct < 15:
                    continue

                severity = AlertSeverity.HIGH if drop_pct >= 25 else AlertSeverity.MEDIUM
                urgency = "high" if drop_pct >= 25 else "normal"

                alert = ComplianceAlert(
                    entity_type="vehicle",
                    entity_id=vehicle.id,
                    vehicle_id=vehicle.id,
                    alert_type=AlertType.WARNING,
                    severity=severity,
                    title=f"Fuel efficiency drop: {vehicle.registration_number}",
                    message=(
                        f"Fuel efficiency dropped {drop_pct:.1f}% this week "
                        f"({current_efficiency:.1f} vs {baseline_efficiency:.1f} km/L baseline)."
                    ),
                    due_date=datetime.utcnow(),
                    resolved=False,
                )
                db.add(alert)
                flagged += 1

                if drop_pct >= 25:
                    from app.services.notification_service import notification_service
                    await notification_service.send(
                        db,
                        event_type="FUEL_EFFICIENCY_CRITICAL",
                        title=f"Critical fuel drop: {vehicle.registration_number}",
                        body=f"Fuel efficiency dropped {drop_pct:.1f}% — investigate immediately.",
                        target_roles=["fleet_manager"],
                        urgency=urgency,
                        data={"vehicle_id": vehicle.id},
                    )

            await db.commit()
            logger.info(f"SCH-05: {flagged} vehicles flagged for fuel efficiency")
        except Exception as exc:
            logger.error(f"SCH-05: Fuel efficiency check failed: {exc}", exc_info=True)


# ---------------------------------------------------------------------------
# SCH-06  Stale trip detection (9:00 AM daily)
# ---------------------------------------------------------------------------

async def sch_06_stale_trips() -> None:
    """
    Flag trips IN_TRANSIT longer than 2× estimated route transit time.
    Insert ComplianceAlert and notify fleet_manager + assigned PA.
    """
    from app.db.postgres.connection import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            now = datetime.utcnow()
            in_transit_q = await db.execute(
                select(Trip).where(
                    Trip.status == TripStatusEnum.IN_TRANSIT,
                    Trip.actual_start.isnot(None),
                    Trip.is_deleted.is_(False),
                )
            )
            trips = in_transit_q.scalars().all()

            flagged = 0
            from app.services.notification_service import notification_service

            for trip in trips:
                elapsed_hours = (now - trip.actual_start).total_seconds() / 3600

                # Get estimated transit hours from route
                estimated_hours = 48.0  # Default if no route
                if trip.route_id:
                    route = await db.get(Route, trip.route_id)
                    if route and route.estimated_hours:
                        estimated_hours = float(route.estimated_hours)

                if elapsed_hours <= estimated_hours * 2:
                    continue

                # Idempotency: skip if alert exists
                existing_q = await db.execute(
                    select(ComplianceAlert).where(
                        ComplianceAlert.entity_type == "trip",
                        ComplianceAlert.entity_id == trip.id,
                        ComplianceAlert.resolved.is_(False),
                        ComplianceAlert.message.contains("stale"),
                    )
                )
                if existing_q.scalars().first():
                    continue

                alert = ComplianceAlert(
                    entity_type="trip",
                    entity_id=trip.id,
                    alert_type=AlertType.WARNING,
                    severity=AlertSeverity.HIGH,
                    title=f"Stale trip: {trip.trip_number}",
                    message=(
                        f"Trip has been in-transit {elapsed_hours:.1f}h "
                        f"(estimated {estimated_hours:.0f}h). Check driver status. [stale]"
                    ),
                    due_date=datetime.utcnow(),
                    resolved=False,
                )
                db.add(alert)
                flagged += 1

                await notification_service.send(
                    db,
                    event_type="STALE_TRIP",
                    title=f"Stale trip: {trip.trip_number}",
                    body=f"Trip {trip.trip_number} ({trip.origin} → {trip.destination}) overdue by {elapsed_hours - estimated_hours:.1f}h.",
                    target_roles=["fleet_manager"],
                    data={"trip_id": trip.id},
                    urgency="high",
                )

            await db.commit()
            logger.info(f"SCH-06: {flagged} stale trips detected")
        except Exception as exc:
            logger.error(f"SCH-06: Stale trip detection failed: {exc}", exc_info=True)


# ---------------------------------------------------------------------------
# SCH-07  Daily tank low-level alert (08:00 AM IST every day)
# ---------------------------------------------------------------------------

TANK_LOW_LEVEL_THRESHOLD_LITRES = 800


async def sch_07_tank_low_level_alert() -> None:
    """
    Daily check: for every DepotFuelTank with current_stock_litres < 800,
    send a notification to all fleet_manager users until the tank is refilled.
    Includes the branch name in the notification.
    """
    from app.db.postgres.connection import AsyncSessionLocal
    from app.models.postgres.fuel_pump import DepotFuelTank
    from app.models.postgres.user import Branch
    from app.services.notification_service import notification_service

    async with AsyncSessionLocal() as db:
        try:
            q = await db.execute(
                select(DepotFuelTank).where(
                    DepotFuelTank.is_deleted.is_(False),
                    DepotFuelTank.current_stock_litres < TANK_LOW_LEVEL_THRESHOLD_LITRES,
                )
            )
            low_tanks = q.scalars().all()

            for tank in low_tanks:
                # Resolve branch name
                branch_name = "Unknown Branch"
                if tank.branch_id:
                    branch = await db.get(Branch, tank.branch_id)
                    if branch:
                        branch_name = branch.name

                body = (
                    f"{tank.name} of the Branch: {branch_name} "
                    f"is low. Please Initiate Refill!"
                )
                await notification_service.send(
                    db,
                    event_type="TANK_LOW_LEVEL",
                    title=f"{tank.name} is Low",
                    body=body,
                    target_roles=["fleet_manager"],
                    data={
                        "tank_id": tank.id,
                        "tank_name": tank.name,
                        "branch_name": branch_name,
                        "current_stock_litres": float(tank.current_stock_litres),
                        "capacity_litres": float(tank.capacity_litres),
                    },
                    urgency="high",
                )
                logger.info(
                    f"SCH-07: Low-level alert sent for tank '{tank.name}' "
                    f"at branch '{branch_name}' ({tank.current_stock_litres}L remaining)"
                )

            await db.commit()
            logger.info(f"SCH-07: Tank low-level check complete — {len(low_tanks)} tank(s) low")
        except Exception as exc:
            logger.error(f"SCH-07: Tank low-level alert failed: {exc}", exc_info=True)


# ---------------------------------------------------------------------------
# RUL-01  Credit limit enforcement on job creation
# ---------------------------------------------------------------------------

async def rul_01_check_credit_limit(
    db: AsyncSession, client_id: int, new_freight: Decimal, strict: bool = False
) -> dict:
    """
    Check if adding new_freight to the client's outstanding would breach their
    credit_limit.

    Returns {"blocked": bool, "soft_flag": bool, "message": str}
    Raises HTTP 422 in strict mode if limit would be breached.
    """
    result = {"blocked": False, "soft_flag": False, "message": "OK"}
    try:
        client = await db.get(Client, client_id)
        if not client or not client.credit_limit or client.credit_limit <= 0:
            return result  # No credit limit configured

        outstanding = client.outstanding_amount or Decimal(0)
        projected = outstanding + (new_freight or Decimal(0))

        if projected > client.credit_limit:
            overrun = projected - client.credit_limit
            message = (
                f"Credit limit exceeded: client {client.name} has ₹{outstanding:,.0f} outstanding, "
                f"adding ₹{new_freight:,.0f} would exceed limit ₹{client.credit_limit:,.0f} by ₹{overrun:,.0f}."
            )
            if strict:
                from fastapi import HTTPException
                raise HTTPException(status_code=422, detail=message)
            else:
                result["soft_flag"] = True
                result["message"] = message
                logger.warning(f"RUL-01: {message}")
    except Exception as exc:
        # Never block the main operation if rule engine fails
        if "422" in str(exc) or hasattr(exc, "status_code"):
            raise
        logger.error(f"RUL-01: Credit check failed: {exc}", exc_info=True)

    return result


# ---------------------------------------------------------------------------
# RUL-02  Duplicate LR number guard
# ---------------------------------------------------------------------------

async def rul_02_check_duplicate_lr(db: AsyncSession, lr_number: str) -> None:
    """
    Raise HTTP 409 if lr_number already exists.
    Call BEFORE inserting the new LR.
    """
    from fastapi import HTTPException

    existing_q = await db.execute(
        select(LR.id).where(LR.lr_number == lr_number, LR.is_deleted.is_(False))
    )
    if existing_q.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"LR number '{lr_number}' already exists. Provide a unique LR number.",
        )


# ---------------------------------------------------------------------------
# RUL-03  Expense anomaly flag
# ---------------------------------------------------------------------------

async def rul_03_flag_expense_anomaly(
    db: AsyncSession, expense_id: int, category: str, amount: Decimal, route_id: Optional[int] = None
) -> None:
    """
    Compare expense amount to 90-day average for same category (+route if available).
    Sets anomaly_flag=True on the expense if > 2× average (minimum 5 samples).
    """
    try:
        ninety_days_ago = datetime.utcnow() - timedelta(days=90)

        filters = [
            TripExpense.category == category,
            TripExpense.expense_date >= ninety_days_ago,
            TripExpense.anomaly_flag.is_(False),  # exclude already-flagged ones from baseline
        ]

        # Narrow by route if available
        if route_id:
            route_trip_q = await db.execute(
                select(Trip.id).where(Trip.route_id == route_id)
            )
            route_trip_ids = [r for (r,) in route_trip_q.all()]
            if route_trip_ids:
                filters.append(TripExpense.trip_id.in_(route_trip_ids))

        stats_q = await db.execute(
            select(
                func.count(TripExpense.id).label("sample_count"),
                func.avg(TripExpense.amount).label("avg_amount"),
            ).where(*filters)
        )
        row = stats_q.one()
        sample_count = row.sample_count or 0
        avg_amount = Decimal(str(row.avg_amount)) if row.avg_amount else None

        if sample_count < 5 or avg_amount is None:
            return  # Not enough data

        if amount > avg_amount * Decimal("2.0"):
            expense = await db.get(TripExpense, expense_id)
            if expense:
                expense.anomaly_flag = True
                expense.anomaly_reason = (
                    f"Amount ₹{amount:,.0f} is {float(amount/avg_amount):.1f}× "
                    f"the 90-day avg ₹{avg_amount:,.0f} for {category}."
                )
                await db.commit()
                logger.warning(
                    f"RUL-03: Expense {expense_id} flagged — ₹{amount} vs avg ₹{avg_amount} ({category})"
                )
    except Exception as exc:
        logger.error(f"RUL-03: Expense anomaly check failed: {exc}", exc_info=True)


# ---------------------------------------------------------------------------
# RUL-04  Auto-suggest vehicle type from cargo weight
# ---------------------------------------------------------------------------

WEIGHT_RULES = [
    (1_000,  "mini_truck"),
    (5_000,  "truck"),
    (15_000, "trailer"),
    (float("inf"), "container"),
]


def rul_04_suggest_vehicle_type(weight_kg: float) -> str:
    """
    Returns the suggested vehicle_type string based on cargo weight in kg.
    Pure function — no DB access needed.
    """
    for threshold, vehicle_type in WEIGHT_RULES:
        if weight_kg < threshold:
            return vehicle_type
    return "container"


# ---------------------------------------------------------------------------
# RUL-05  Driver attendance streak badge
# ---------------------------------------------------------------------------

BADGE_THRESHOLDS = [
    (90, "gold"),
    (30, "silver"),
    (7,  "bronze"),
]


async def rul_05_attendance_streak(db: AsyncSession, driver_id: int) -> dict:
    """
    Calculate the driver's current consecutive non-absent attendance streak.
    Returns {"streak_days": int, "badge_type": str | None}
    """
    try:
        today = date.today()
        records_q = await db.execute(
            select(DriverAttendance)
            .where(
                DriverAttendance.driver_id == driver_id,
                DriverAttendance.date <= today,
            )
            .order_by(DriverAttendance.date.desc())
            .limit(120)  # enough for gold badge + buffer
        )
        records = records_q.scalars().all()

        streak = 0
        expected_date = today
        for record in records:
            if record.date < expected_date:
                break  # Gap in records — streak ends
            if record.date == expected_date and record.status != "absent":
                streak += 1
                expected_date -= timedelta(days=1)
            elif record.date == expected_date and record.status == "absent":
                break

        badge = None
        for threshold, badge_name in BADGE_THRESHOLDS:
            if streak >= threshold:
                badge = badge_name
                break

        return {"streak_days": streak, "badge_type": badge}
    except Exception as exc:
        logger.error(f"RUL-05: Streak calculation failed for driver {driver_id}: {exc}", exc_info=True)
        return {"streak_days": 0, "badge_type": None}
