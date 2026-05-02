# Ledger Automation Service — auto-posting, receivable close, sync, expense posting
# Transport ERP

import logging
from datetime import date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.postgres.finance import (
    Invoice, InvoiceStatus, Payment, PaymentStatus,
    Ledger, LedgerType, Receivable, Payable, Vendor,
)
from app.services.finance_service import create_ledger_entry

logger = logging.getLogger(__name__)


async def auto_post_payment_to_ledger(db: AsyncSession, payment_id: int) -> Ledger | None:
    """
    Group 4.1 — Auto-create ledger entry on payment completion.
    Handles both 'received' (from client) and 'paid' (to vendor) payments.
    """
    payment = await db.get(Payment, payment_id)
    if not payment:
        return None

    # Check if ledger entry already exists for this payment
    existing = await db.execute(
        select(Ledger).where(Ledger.payment_id == payment_id)
    )
    if existing.scalar_one_or_none():
        return None

    amount = Decimal(str(payment.amount or 0))

    if payment.payment_type == "received":
        entry = await create_ledger_entry(db, {
            "entry_date": payment.payment_date or date.today(),
            "ledger_type": "receivable",
            "account_name": "Cash / Bank",
            "client_id": payment.client_id,
            "invoice_id": payment.invoice_id,
            "payment_id": payment.id,
            "debit": float(amount),
            "credit": 0,
            "narration": f"Payment received: {payment.payment_number}",
            "reference_type": "payment",
            "reference_number": payment.payment_number,
            "tenant_id": payment.tenant_id,
            "branch_id": payment.branch_id,
        }, payment.created_by)
    else:
        entry = await create_ledger_entry(db, {
            "entry_date": payment.payment_date or date.today(),
            "ledger_type": "payable",
            "account_name": "Accounts Payable",
            "vendor_id": payment.vendor_id,
            "invoice_id": payment.invoice_id,
            "payment_id": payment.id,
            "debit": 0,
            "credit": float(amount),
            "narration": f"Payment made: {payment.payment_number}",
            "reference_type": "payment",
            "reference_number": payment.payment_number,
            "tenant_id": payment.tenant_id,
            "branch_id": payment.branch_id,
        }, payment.created_by)

    logger.info(f"Auto-posted ledger entry for payment {payment.payment_number}")
    return entry


async def auto_close_receivable(db: AsyncSession, invoice_id: int) -> bool:
    """
    Group 4.2 — Auto-close receivable when invoice is fully paid.
    Updates the receivable aging record for the client.
    """
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or invoice.status != InvoiceStatus.PAID:
        return False

    # Find the latest receivable for this client
    result = await db.execute(
        select(Receivable).where(
            Receivable.client_id == invoice.client_id,
        ).order_by(Receivable.as_on_date.desc()).limit(1)
    )
    receivable = result.scalar_one_or_none()

    if receivable:
        total = Decimal(str(invoice.total_amount or 0))
        receivable.total_outstanding = max(
            Decimal("0"),
            Decimal(str(receivable.total_outstanding or 0)) - total,
        )
        # Recalculate aging buckets
        receivable.current = max(
            Decimal("0"),
            Decimal(str(receivable.current or 0)) - total,
        )
        receivable.as_on_date = date.today()
        await db.flush()

    logger.info(f"Auto-closed receivable for invoice {invoice.invoice_number}")
    return True


async def sync_client_ledger(db: AsyncSession, client_id: int) -> dict:
    """
    Group 4.3 — Recalculate client ledger balance from all transactions.
    """
    # Sum all debits and credits for this client
    result = await db.execute(
        select(
            func.coalesce(func.sum(Ledger.debit), 0),
            func.coalesce(func.sum(Ledger.credit), 0),
        ).where(Ledger.client_id == client_id)
    )
    total_debit, total_credit = result.one()
    balance = Decimal(str(total_debit)) - Decimal(str(total_credit))

    # Update or create receivable snapshot
    today = date.today()
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
            total_outstanding=max(Decimal("0"), -balance),  # negative balance = outstanding
        )
        db.add(receivable)
    else:
        receivable.total_outstanding = max(Decimal("0"), -balance)

    await db.flush()
    return {
        "client_id": client_id,
        "total_debit": float(total_debit),
        "total_credit": float(total_credit),
        "balance": float(balance),
        "outstanding": float(max(Decimal("0"), -balance)),
    }


async def auto_post_expense_to_ledger(
    db: AsyncSession, expense_category: str, amount: float,
    vendor_id: int = None, trip_id: int = None,
    tenant_id: int = None, branch_id: int = None, user_id: int = None,
) -> Ledger:
    """
    Group 4.4 — Auto-post expense approval as payable ledger entry.
    """
    entry = await create_ledger_entry(db, {
        "entry_date": date.today(),
        "ledger_type": "expense",
        "account_name": f"Expense - {expense_category.replace('_', ' ').title()}",
        "vendor_id": vendor_id,
        "trip_id": trip_id,
        "debit": amount,
        "credit": 0,
        "narration": f"Approved expense: {expense_category}",
        "reference_type": "expense",
        "tenant_id": tenant_id,
        "branch_id": branch_id,
    }, user_id)
    return entry


async def create_contra_entry(
    db: AsyncSession, from_account: str, to_account: str,
    amount: float, narration: str = None, user_id: int = None,
    tenant_id: int = None, branch_id: int = None,
) -> tuple:
    """
    Group 4.5 — Contra entry (inter-account transfer).
    Creates paired debit and credit entries.
    """
    debit_entry = await create_ledger_entry(db, {
        "entry_date": date.today(),
        "ledger_type": "asset",
        "account_name": to_account,
        "debit": amount,
        "credit": 0,
        "narration": narration or f"Transfer from {from_account} to {to_account}",
        "reference_type": "contra",
        "tenant_id": tenant_id,
        "branch_id": branch_id,
    }, user_id)

    credit_entry = await create_ledger_entry(db, {
        "entry_date": date.today(),
        "ledger_type": "asset",
        "account_name": from_account,
        "debit": 0,
        "credit": amount,
        "narration": narration or f"Transfer from {from_account} to {to_account}",
        "reference_type": "contra",
        "reference_number": debit_entry.entry_number if debit_entry else None,
        "tenant_id": tenant_id,
        "branch_id": branch_id,
    }, user_id)

    return debit_entry, credit_entry
