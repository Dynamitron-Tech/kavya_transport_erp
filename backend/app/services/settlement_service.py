# Settlements Service — Driver settlements, supplier payables, receivable aging
# Transport ERP

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.postgres.finance import (
    Invoice, InvoiceStatus, Payment, PaymentMethod, PaymentStatus,
    Receivable, Payable, Vendor,
)
from app.models.postgres.finance_automation import (
    DriverSettlement, SupplierPayable, SettlementStatus,
    FinanceAlert, FinanceAlertType, FinanceAlertSeverity,
)
from app.models.postgres.driver import Driver
from app.models.postgres.trip import Trip, TripExpense
from app.utils.generators import generate_settlement_number, generate_payable_number, generate_payment_number
from app.services.finance_service import create_ledger_entry

logger = logging.getLogger(__name__)


# ====================== DRIVER SETTLEMENTS ======================

async def generate_driver_settlement(
    db: AsyncSession, driver_id: int, period_from: date, period_to: date,
    user_id: int = None,
) -> DriverSettlement:
    """
    Group 5.4 — Generate driver settlement for a period.
    Calculates earnings and deductions from trips in the period.
    """
    driver = await db.get(Driver, driver_id)
    if not driver:
        raise ValueError(f"Driver {driver_id} not found")

    # Get completed trips in period
    trip_result = await db.execute(
        select(Trip).where(
            Trip.driver_id == driver_id,
            Trip.end_date >= period_from,
            Trip.end_date <= period_to,
        )
    )
    trips = trip_result.scalars().all()

    trips_completed = len(trips)
    total_km = sum(float(getattr(t, "actual_distance", 0) or getattr(t, "distance_km", 0) or 0) for t in trips)

    # Calculate trip allowance (sum of driver_allowance from trip expenses)
    trip_ids = [t.id for t in trips]
    trip_allowance = Decimal("0")
    if trip_ids:
        exp_result = await db.execute(
            select(func.coalesce(func.sum(TripExpense.amount), 0)).where(
                TripExpense.trip_id.in_(trip_ids),
                TripExpense.category == "DRIVER_ALLOWANCE",
            )
        )
        trip_allowance = Decimal(str(exp_result.scalar() or 0))

    base_salary = Decimal(str(getattr(driver, "salary", 0) or 0))
    gross = base_salary + trip_allowance

    # Deductions: advances
    advance_deducted = Decimal("0")
    if trip_ids:
        adv_result = await db.execute(
            select(func.coalesce(func.sum(TripExpense.amount), 0)).where(
                TripExpense.trip_id.in_(trip_ids),
                TripExpense.category == "DRIVER_ADVANCE",
            )
        )
        advance_deducted = Decimal(str(adv_result.scalar() or 0))

    total_deductions = advance_deducted
    net_amount = gross - total_deductions

    settlement = DriverSettlement(
        settlement_number=generate_settlement_number(),
        settlement_date=date.today(),
        driver_id=driver_id,
        period_from=period_from,
        period_to=period_to,
        base_salary=base_salary,
        trip_allowance=trip_allowance,
        gross_amount=gross,
        advance_deducted=advance_deducted,
        total_deductions=total_deductions,
        net_amount=net_amount,
        trips_completed=trips_completed,
        total_km=Decimal(str(total_km)),
        status=SettlementStatus.PENDING,
        created_by=user_id,
    )
    db.add(settlement)
    await db.flush()
    logger.info(f"Generated settlement {settlement.settlement_number} for driver {driver_id}")
    return settlement


async def approve_settlement(db: AsyncSession, settlement_id: int, user_id: int) -> DriverSettlement | None:
    """Approve a driver settlement."""
    settlement = await db.get(DriverSettlement, settlement_id)
    if not settlement or settlement.status != SettlementStatus.PENDING:
        return None

    settlement.status = SettlementStatus.APPROVED
    settlement.approved_by = user_id
    settlement.approved_at = datetime.utcnow()
    await db.flush()
    return settlement


async def pay_settlement(db: AsyncSession, settlement_id: int, user_id: int) -> DriverSettlement | None:
    """Mark settlement as paid and create payment + ledger entries."""
    settlement = await db.get(DriverSettlement, settlement_id)
    if not settlement or settlement.status != SettlementStatus.APPROVED:
        return None

    # Create payment record
    payment = Payment(
        payment_number=generate_payment_number(),
        payment_date=date.today(),
        payment_type="paid",
        amount=settlement.net_amount,
        payment_method=PaymentMethod.BANK_TRANSFER,
        status=PaymentStatus.COMPLETED,
        net_amount=settlement.net_amount,
        remarks=f"Driver settlement {settlement.settlement_number}",
        tenant_id=settlement.tenant_id,
        branch_id=settlement.branch_id,
        created_by=user_id,
    )
    db.add(payment)
    await db.flush()

    settlement.status = SettlementStatus.PAID
    settlement.paid_at = datetime.utcnow()
    settlement.payment_id = payment.id

    # Ledger entry
    await create_ledger_entry(db, {
        "entry_date": date.today(),
        "ledger_type": "expense",
        "account_name": "Driver Salary & Settlements",
        "payment_id": payment.id,
        "debit": float(settlement.net_amount),
        "credit": 0,
        "narration": f"Driver settlement: {settlement.settlement_number}",
        "reference_type": "settlement",
        "reference_number": settlement.settlement_number,
        "tenant_id": settlement.tenant_id,
        "branch_id": settlement.branch_id,
    }, user_id)

    await db.flush()
    return settlement


async def list_settlements(
    db: AsyncSession, driver_id: int = None, status: str = None,
    page: int = 1, limit: int = 20,
) -> tuple:
    """List driver settlements with filters."""
    query = select(DriverSettlement).where(DriverSettlement.is_deleted == False)
    count_query = select(func.count(DriverSettlement.id)).where(DriverSettlement.is_deleted == False)

    if driver_id:
        query = query.where(DriverSettlement.driver_id == driver_id)
        count_query = count_query.where(DriverSettlement.driver_id == driver_id)
    if status:
        query = query.where(DriverSettlement.status == SettlementStatus[status.upper()])
        count_query = count_query.where(DriverSettlement.status == SettlementStatus[status.upper()])

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(DriverSettlement.id.desc()))
    return result.scalars().all(), total


# ====================== SUPPLIER PAYABLES ======================

async def create_supplier_payable(
    db: AsyncSession, vendor_id: int, amount: float, due_date: date,
    vendor_invoice_number: str = None, expense_category: str = None,
    trip_id: int = None, user_id: int = None,
) -> SupplierPayable:
    """Group 5.5 — Create supplier payable record."""
    payable = SupplierPayable(
        payable_number=generate_payable_number(),
        vendor_id=vendor_id,
        vendor_invoice_number=vendor_invoice_number,
        vendor_invoice_date=date.today(),
        amount=Decimal(str(amount)),
        net_payable=Decimal(str(amount)),
        due_date=due_date,
        expense_category=expense_category,
        trip_id=trip_id,
        status=SettlementStatus.PENDING,
        created_by=user_id,
    )
    db.add(payable)
    await db.flush()
    return payable


async def pay_supplier_payable(db: AsyncSession, payable_id: int, user_id: int) -> SupplierPayable | None:
    """Mark supplier payable as paid."""
    payable = await db.get(SupplierPayable, payable_id)
    if not payable or payable.status == SettlementStatus.PAID:
        return None

    payment = Payment(
        payment_number=generate_payment_number(),
        payment_date=date.today(),
        payment_type="paid",
        vendor_id=payable.vendor_id,
        amount=payable.net_payable,
        payment_method=PaymentMethod.BANK_TRANSFER,
        status=PaymentStatus.COMPLETED,
        net_amount=payable.net_payable,
        remarks=f"Supplier payable {payable.payable_number}",
        tenant_id=payable.tenant_id,
        branch_id=payable.branch_id,
        created_by=user_id,
    )
    db.add(payment)
    await db.flush()

    payable.status = SettlementStatus.PAID
    payable.paid_date = date.today()
    payable.payment_id = payment.id

    await create_ledger_entry(db, {
        "entry_date": date.today(),
        "ledger_type": "payable",
        "account_name": "Accounts Payable",
        "vendor_id": payable.vendor_id,
        "payment_id": payment.id,
        "debit": float(payable.net_payable),
        "credit": 0,
        "narration": f"Supplier payment: {payable.payable_number}",
        "reference_type": "supplier_payable",
        "reference_number": payable.payable_number,
        "tenant_id": payable.tenant_id,
        "branch_id": payable.branch_id,
    }, user_id)

    await db.flush()
    return payable


async def list_supplier_payables(
    db: AsyncSession, vendor_id: int = None, status: str = None,
    page: int = 1, limit: int = 20,
) -> tuple:
    """List supplier payables."""
    query = select(SupplierPayable).where(SupplierPayable.is_deleted == False)
    count_query = select(func.count(SupplierPayable.id)).where(SupplierPayable.is_deleted == False)

    if vendor_id:
        query = query.where(SupplierPayable.vendor_id == vendor_id)
        count_query = count_query.where(SupplierPayable.vendor_id == vendor_id)
    if status:
        query = query.where(SupplierPayable.status == SettlementStatus[status.upper()])
        count_query = count_query.where(SupplierPayable.status == SettlementStatus[status.upper()])

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(SupplierPayable.id.desc()))
    return result.scalars().all(), total


# ====================== RECEIVABLE AGING ======================

async def recalculate_receivable_aging(db: AsyncSession) -> int:
    """
    Group 5.1 — Recalculate receivable aging buckets for all clients.
    Called by daily cron.
    """
    today = date.today()
    # Get all clients with unpaid invoices
    result = await db.execute(
        select(Invoice.client_id).where(
            Invoice.status.in_([
                InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE,
            ]),
            Invoice.is_deleted == False,
            Invoice.amount_due > 0,
        ).distinct()
    )
    client_ids = [row[0] for row in result.all()]

    updated = 0
    for client_id in client_ids:
        inv_result = await db.execute(
            select(Invoice).where(
                Invoice.client_id == client_id,
                Invoice.status.in_([
                    InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE,
                ]),
                Invoice.is_deleted == False,
                Invoice.amount_due > 0,
            )
        )
        invoices = inv_result.scalars().all()

        current = Decimal("0")
        days_30_60 = Decimal("0")
        days_60_90 = Decimal("0")
        days_90_plus = Decimal("0")

        for inv in invoices:
            due = Decimal(str(inv.amount_due or 0))
            age = (today - (inv.due_date or today)).days
            if age <= 30:
                current += due
            elif age <= 60:
                days_30_60 += due
            elif age <= 90:
                days_60_90 += due
            else:
                days_90_plus += due

        total = current + days_30_60 + days_60_90 + days_90_plus

        # Upsert receivable
        recv_result = await db.execute(
            select(Receivable).where(
                Receivable.client_id == client_id,
                Receivable.as_on_date == today,
            )
        )
        receivable = recv_result.scalar_one_or_none()
        if not receivable:
            receivable = Receivable(
                client_id=client_id,
                as_on_date=today,
                tenant_id=invoices[0].tenant_id if invoices else None,
            )
            db.add(receivable)

        receivable.current = current
        receivable.days_30_60 = days_30_60
        receivable.days_60_90 = days_60_90
        receivable.days_90_plus = days_90_plus
        receivable.total_outstanding = total
        updated += 1

    await db.flush()
    logger.info(f"Recalculated aging for {updated} clients")
    return updated


# ====================== ALERTS ======================

async def check_payable_due_dates(db: AsyncSession) -> list[dict]:
    """
    Group 6 — Check for supplier payables approaching due date.
    Creates alerts for payables due in 3 or 7 days.
    """
    today = date.today()
    week_ahead = today + timedelta(days=7)

    result = await db.execute(
        select(SupplierPayable).where(
            SupplierPayable.status == SettlementStatus.PENDING,
            SupplierPayable.due_date <= week_ahead,
            SupplierPayable.is_deleted == False,
        )
    )
    payables = result.scalars().all()
    alerts = []

    for p in payables:
        days_until = (p.due_date - today).days
        if days_until < 0:
            severity = FinanceAlertSeverity.CRITICAL
            title = f"Supplier payable {p.payable_number} overdue by {abs(days_until)} days"
        elif days_until <= 3:
            severity = FinanceAlertSeverity.WARNING
            title = f"Supplier payable {p.payable_number} due in {days_until} days"
        else:
            severity = FinanceAlertSeverity.INFO
            title = f"Supplier payable {p.payable_number} due in {days_until} days"

        alert = FinanceAlert(
            alert_type=FinanceAlertType.SUPPLIER_PAYABLE_DUE,
            severity=severity,
            title=title,
            message=f"Amount: ₹{p.net_payable}. Vendor ID: {p.vendor_id}.",
            vendor_id=p.vendor_id,
            tenant_id=p.tenant_id,
            branch_id=p.branch_id,
        )
        db.add(alert)
        alerts.append({"payable_id": p.id, "days_until_due": days_until})

    await db.flush()
    return alerts


async def check_low_bank_balance(db: AsyncSession, threshold: float = 100000) -> list[dict]:
    """Group 6.3 — Alert if any bank account balance falls below threshold."""
    from app.models.postgres.route import BankAccount

    result = await db.execute(
        select(BankAccount).where(
            BankAccount.is_active == True,
            BankAccount.is_deleted == False,
            BankAccount.current_balance < threshold,
        )
    )
    accounts = result.scalars().all()
    alerts = []

    for acc in accounts:
        alert = FinanceAlert(
            alert_type=FinanceAlertType.LOW_BALANCE,
            severity=FinanceAlertSeverity.CRITICAL,
            title=f"Low balance: {acc.account_name}",
            message=f"Current balance: ₹{acc.current_balance}. Threshold: ₹{threshold}.",
            bank_account_id=acc.id,
            tenant_id=acc.tenant_id,
            branch_id=acc.branch_id,
        )
        db.add(alert)
        alerts.append({"account_id": acc.id, "balance": float(acc.current_balance or 0)})

    await db.flush()
    return alerts
