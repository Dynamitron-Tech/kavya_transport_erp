# Receivable Payment Service
# Transport ERP — UPI / NEFT / RTGS / Cheque / Cash payment recording for client invoices.
#
# Uses the existing finance_service.create_ledger_entry for the double-entry ledger post.
# All DB operations run within the session provided by get_db (auto-commit / rollback).

from datetime import date as date_type, datetime
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.postgres.client import Client
from app.models.postgres.finance import (
    Invoice,
    InvoicePaymentStatus,
    InvoiceStatus,
    Payment,
    PaymentMethod,
    PaymentStatus,
)
from app.models.postgres.user import User
from app.schemas.payment_schemas import RecordPaymentRequest
from app.services import finance_service
from app.utils.generators import generate_payment_number


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINT 1 — Client UPI info
# ─────────────────────────────────────────────────────────────────────────────

async def get_client_payment_info(db: AsyncSession, client_id: int) -> dict:
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.is_deleted == False)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    upi_id: Optional[str] = getattr(client, "upi_id", None)
    phone: Optional[str] = client.phone

    if not upi_id and not phone:
        return {"upi_available": False, "name": client.name}

    return {
        "upi_available": True,
        "upi_id": upi_id,
        "phone": phone,
        "name": client.name,
    }


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINT 2 — Record receivable payment  (all steps in one session = one txn)
# ─────────────────────────────────────────────────────────────────────────────

async def record_receivable_payment(
    db: AsyncSession,
    data: RecordPaymentRequest,
    user_id: int,
) -> dict:
    # ── Step 0: Load and validate invoice ───────────────────────────────────
    inv_result = await db.execute(
        select(Invoice).where(Invoice.id == data.invoice_id, Invoice.is_deleted == False)
    )
    invoice = inv_result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invoice {data.invoice_id} not found",
        )

    # Confirm client is active
    cl_result = await db.execute(
        select(Client).where(Client.id == invoice.client_id, Client.is_deleted == False)
    )
    if not cl_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invoice's client is not active",
        )

    # ── Step 1: Business-rule validations ───────────────────────────────────
    pay_status = getattr(invoice, "payment_status", None)
    already_paid = (
        pay_status == InvoicePaymentStatus.PAID
        or invoice.status == InvoiceStatus.PAID
    )
    if already_paid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This invoice is already fully paid",
        )

    total = Decimal(str(invoice.total_amount or 0))
    paid_so_far = Decimal(str(invoice.amount_paid or 0))
    outstanding = total - paid_so_far
    amount = Decimal(str(data.amount_paid))

    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="amount_paid must be greater than 0",
        )

    if amount > outstanding:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"amount_paid ₹{amount} exceeds outstanding balance ₹{outstanding} "
                f"for invoice {invoice.invoice_number}"
            ),
        )

    if data.payment_mode == "UPI" and not data.reference_number and not data.upi_txn_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="UPI payments require either a reference number or a UPI transaction ID",
        )

    if data.payment_mode in ("NEFT", "RTGS") and not data.reference_number:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{data.payment_mode} payments require a UTR reference number",
        )

    # ── Step 2: Duplicate reference check ───────────────────────────────────
    if data.reference_number:
        dup = await db.execute(
            select(Payment).where(
                Payment.invoice_id == data.invoice_id,
                Payment.transaction_ref == data.reference_number,
                Payment.is_deleted == False,
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Reference number '{data.reference_number}' is already recorded "
                    f"for invoice {invoice.invoice_number}"
                ),
            )

    # ── Step 3: Create payment record ────────────────────────────────────────
    payment = Payment(
        payment_number=generate_payment_number(),
        payment_date=data.payment_date,
        payment_type="received",
        invoice_id=data.invoice_id,
        client_id=invoice.client_id,
        amount=amount,
        currency="INR",
        payment_method=PaymentMethod(data.payment_mode),
        transaction_ref=data.reference_number,
        upi_txn_id=data.upi_txn_id,
        remarks=data.notes,
        status=PaymentStatus.COMPLETED,
        net_amount=amount,
        created_by=user_id,
    )
    db.add(payment)
    await db.flush()  # get payment.id, still within session txn

    # ── Step 4: Update invoice amounts and statuses ──────────────────────────
    new_amount_paid = paid_so_far + amount
    new_amount_due = max(Decimal("0"), total - new_amount_paid)

    if new_amount_paid >= total:
        new_pay_status = "PAID"
        new_inv_status = "PAID"
        new_status = "PAID"
        paid_at_val = datetime.utcnow()
    elif new_amount_paid > 0:
        new_pay_status = "PARTIAL"
        new_inv_status = "PARTIALLY_PAID"
        new_status = "PARTIAL"
        paid_at_val = None
    else:
        new_pay_status = "UNPAID"
        new_inv_status = "PENDING"   # fall back to pending
        new_status = "UNPAID"
        paid_at_val = None

    # Use raw SQL with CAST() to sidestep asyncpg enum type-mismatch.
    # asyncpg binary protocol rejects plain string params for native PG enum
    # columns. Using CAST(:val AS enum_type) instructs PG to cast at DB level.
    # Actual PG type names (confirmed from pg_type): invoice_payment_status, invoicestatus
    from sqlalchemy import text as sa_text
    if paid_at_val:
        sql = sa_text("""
            UPDATE invoices
            SET amount_paid    = :ap,
                amount_due     = :ad,
                payment_status = CAST(:ps AS invoice_payment_status),
                status         = CAST(:st AS invoicestatus),
                paid_at        = :pa,
                last_payment_at = :lpa,
                updated_at     = :lpa
            WHERE id = :inv_id
        """)
        params: dict = {
            "ap": float(new_amount_paid), "ad": float(new_amount_due),
            "ps": new_pay_status, "st": new_inv_status,
            "pa": paid_at_val, "lpa": datetime.utcnow(),
            "inv_id": data.invoice_id,
        }
    else:
        sql = sa_text("""
            UPDATE invoices
            SET amount_paid    = :ap,
                amount_due     = :ad,
                payment_status = CAST(:ps AS invoice_payment_status),
                status         = CAST(:st AS invoicestatus),
                last_payment_at = :lpa,
                updated_at      = :lpa
            WHERE id = :inv_id
        """)
        params = {
            "ap": float(new_amount_paid), "ad": float(new_amount_due),
            "ps": new_pay_status, "st": new_inv_status,
            "lpa": datetime.utcnow(),
            "inv_id": data.invoice_id,
        }
    await db.execute(sql, params)
    await db.flush()

    # ── Step 5: Double-entry ledger post (via existing finance_service) ──────
    entry_date = (
        data.payment_date
        if isinstance(data.payment_date, date_type)
        else date_type.today()
    )
    narration_base = (
        f"Payment received via {data.payment_mode} for {invoice.invoice_number}"
        + (f" — Ref: {data.reference_number}" if data.reference_number else "")
    )

    # Debit: Bank Account (ASSET — increases on receipt)
    await finance_service.create_ledger_entry(
        db,
        {
            "entry_date": entry_date,
            "ledger_type": "asset",
            "account_name": "Bank Account",
            "account_code": "1001",
            "invoice_id": data.invoice_id,
            "payment_id": payment.id,
            "client_id": invoice.client_id,
            "debit": float(amount),
            "credit": 0.0,
            "narration": narration_base,
            "reference_type": "payment",
            "reference_number": payment.payment_number,
        },
        user_id,
    )

    # Credit: Accounts Receivable (ASSET reducing — decreases when payment received)
    await finance_service.create_ledger_entry(
        db,
        {
            "entry_date": entry_date,
            "ledger_type": "receivable",
            "account_name": "Accounts Receivable",
            "account_code": "1200",
            "invoice_id": data.invoice_id,
            "payment_id": payment.id,
            "client_id": invoice.client_id,
            "debit": 0.0,
            "credit": float(amount),
            "narration": narration_base,
            "reference_type": "payment",
            "reference_number": payment.payment_number,
        },
        user_id,
    )

    return {
        "success": True,
        "payment_id": payment.id,
        "invoice_id": data.invoice_id,
        "new_status": new_status,
        "outstanding_balance": float(new_amount_due),
    }


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINT 3 — Payment history for an invoice
# ─────────────────────────────────────────────────────────────────────────────

async def get_invoice_payments(db: AsyncSession, invoice_id: int) -> list:
    result = await db.execute(
        select(Payment).where(
            Payment.invoice_id == invoice_id,
            Payment.is_deleted == False,
            Payment.payment_type == "received",
        ).order_by(Payment.id.desc())
    )
    payments = result.scalars().all()

    rows = []
    for p in payments:
        # Fetch creator name lazily
        creator_name = None
        if p.created_by:
            u = await db.execute(
                select(User.first_name, User.last_name).where(User.id == p.created_by)
            )
            row = u.one_or_none()
            if row:
                creator_name = f"{row[0] or ''} {row[1] or ''}".strip() or None

        method_val = (
            p.payment_method.value
            if hasattr(p.payment_method, "value")
            else str(p.payment_method)
        )
        rows.append(
            {
                "payment_id": p.id,
                "amount_paid": float(p.amount or 0),
                "payment_mode": method_val,
                "reference_number": p.transaction_ref,
                "payment_date": p.payment_date.isoformat() if p.payment_date else None,
                "recorded_by_name": creator_name,
            }
        )

    return rows
