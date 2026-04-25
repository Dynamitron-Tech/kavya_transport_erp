# Invoice Automation Service — auto-generate, dispatch, duplicate detection, freight leakage
# Transport ERP

import logging
from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.postgres.finance import (
    Invoice, InvoiceItem, InvoiceStatus, InvoiceType, Payment, PaymentStatus,
)
from app.models.postgres.client import Client
from app.models.postgres.job import Job
from app.models.postgres.trip import Trip
from app.models.postgres.lr import LR
from app.models.postgres.finance_automation import FinanceAlert, FinanceAlertType, FinanceAlertSeverity
from app.utils.generators import generate_invoice_number

logger = logging.getLogger(__name__)


async def auto_generate_invoice_on_delivery(db: AsyncSession, trip_id: int) -> Invoice | None:
    """
    Group 1.1 — Auto-create invoice when trip status → DELIVERED.
    Pre-fills from trip LRs, job rate, client info.
    """
    trip = await db.get(Trip, trip_id)
    if not trip or not trip.job_id:
        return None

    # Check for existing invoice for this trip
    existing = await db.execute(
        select(Invoice).where(Invoice.trip_id == trip_id, Invoice.is_deleted == False)
    )
    if existing.scalar_one_or_none():
        logger.info(f"Invoice already exists for trip {trip_id}")
        return None

    # Use the existing auto_generate_invoice_from_trip from finance_service
    from app.services.finance_service import auto_generate_invoice_from_trip
    invoice = await auto_generate_invoice_from_trip(db, trip)
    if invoice:
        logger.info(f"Auto-generated invoice {invoice.invoice_number} on delivery of trip {trip_id}")
    return invoice


async def detect_duplicate_billing(db: AsyncSession, client_id: int, trip_id: int) -> bool:
    """
    Group 1.3 — Check for double-billing: same client + same trip.
    Returns True if duplicate found.
    """
    result = await db.execute(
        select(func.count(Invoice.id)).where(
            Invoice.client_id == client_id,
            Invoice.trip_id == trip_id,
            Invoice.is_deleted == False,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
    )
    count = result.scalar() or 0
    if count > 1:
        logger.warning(f"Duplicate billing detected: client={client_id}, trip={trip_id}, count={count}")
        # Create alert
        alert = FinanceAlert(
            alert_type=FinanceAlertType.OVERDUE_INVOICE,
            severity=FinanceAlertSeverity.WARNING,
            title=f"Duplicate invoice detected for trip {trip_id}",
            message=f"Client {client_id} has {count} invoices for the same trip. Review and cancel duplicates.",
            client_id=client_id,
        )
        db.add(alert)
        return True
    return False


async def detect_freight_leakage(db: AsyncSession, invoice_id: int) -> dict | None:
    """
    Group 1.4 — Compare invoiced amount vs contracted/quoted rate.
    Flags leakage if invoice amount < agreed rate - 5% tolerance.
    """
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or not invoice.job_id:
        return None

    job = await db.get(Job, invoice.job_id)
    if not job:
        return None

    agreed_rate = Decimal(str(getattr(job, "agreed_rate", 0) or 0))
    if agreed_rate <= 0:
        return None

    invoiced = Decimal(str(invoice.subtotal or 0))
    tolerance = agreed_rate * Decimal("0.05")
    leakage = agreed_rate - invoiced

    if leakage > tolerance:
        logger.warning(
            f"Freight leakage: Invoice {invoice.invoice_number} subtotal={invoiced}, "
            f"agreed_rate={agreed_rate}, leakage={leakage}"
        )
        alert = FinanceAlert(
            alert_type=FinanceAlertType.OVERDUE_INVOICE,
            severity=FinanceAlertSeverity.WARNING,
            title=f"Freight leakage: Invoice {invoice.invoice_number}",
            message=(
                f"Invoiced ₹{invoiced} vs agreed rate ₹{agreed_rate}. "
                f"Potential leakage: ₹{leakage}."
            ),
            invoice_id=invoice_id,
            client_id=invoice.client_id,
        )
        db.add(alert)
        return {
            "invoice_id": invoice_id,
            "invoiced_amount": float(invoiced),
            "agreed_rate": float(agreed_rate),
            "leakage": float(leakage),
        }
    return None


async def detect_overdue_invoices(db: AsyncSession) -> list[dict]:
    """
    Group 1 / Group 5 — Detect overdue invoices and update their status.
    Called by daily cron at 7 AM.
    """
    today = date.today()
    result = await db.execute(
        select(Invoice).where(
            Invoice.due_date < today,
            Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID]),
            Invoice.is_deleted == False,
        )
    )
    overdue_invoices = result.scalars().all()
    alerts = []

    for inv in overdue_invoices:
        inv.status = InvoiceStatus.OVERDUE
        days_overdue = (today - inv.due_date).days

        # Create alert
        alert = FinanceAlert(
            alert_type=FinanceAlertType.OVERDUE_INVOICE,
            severity=(
                FinanceAlertSeverity.CRITICAL if days_overdue > 90
                else FinanceAlertSeverity.WARNING if days_overdue > 30
                else FinanceAlertSeverity.INFO
            ),
            title=f"Invoice {inv.invoice_number} overdue by {days_overdue} days",
            message=f"Amount due: ₹{inv.amount_due}. Client ID: {inv.client_id}.",
            invoice_id=inv.id,
            client_id=inv.client_id,
            tenant_id=inv.tenant_id,
            branch_id=inv.branch_id,
        )
        db.add(alert)
        alerts.append({
            "invoice_id": inv.id,
            "invoice_number": inv.invoice_number,
            "days_overdue": days_overdue,
            "amount_due": float(inv.amount_due or 0),
        })

    await db.flush()
    logger.info(f"Detected {len(alerts)} overdue invoices")
    return alerts


async def get_partial_payment_invoices(db: AsyncSession) -> list[dict]:
    """
    Group 1.5 — List invoices with partial payments for tracking.
    """
    result = await db.execute(
        select(Invoice).where(
            Invoice.status == InvoiceStatus.PARTIALLY_PAID,
            Invoice.is_deleted == False,
        ).order_by(Invoice.due_date.asc())
    )
    invoices = result.scalars().all()

    return [
        {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "client_id": inv.client_id,
            "total_amount": float(inv.total_amount or 0),
            "amount_paid": float(inv.amount_paid or 0),
            "amount_due": float(inv.amount_due or 0),
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
        }
        for inv in invoices
    ]
