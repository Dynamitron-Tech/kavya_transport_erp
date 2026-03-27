# Banking Reconciliation Service — bank statement import, auto-match, FASTag
# Transport ERP

import logging
import csv
import io
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_

from app.models.postgres.finance import Invoice, InvoiceStatus, Payment, PaymentStatus
from app.models.postgres.route import BankAccount, BankTransaction
from app.models.postgres.finance_automation import (
    BankStatement, BankStatementLine, BankStatementSource, ReconciliationStatus,
    FASTagTransaction, FASTagTxnType,
    FinanceAlert, FinanceAlertType, FinanceAlertSeverity,
)

logger = logging.getLogger(__name__)


# ====================== BANK STATEMENT IMPORT ======================

async def import_bank_statement_csv(
    db: AsyncSession, account_id: int, csv_content: str, user_id: int = None,
) -> BankStatement:
    """
    Group 3.1 — Import bank statement from CSV.
    Expected columns: Date, Description, Reference, Debit, Credit, Balance
    """
    reader = csv.DictReader(io.StringIO(csv_content))
    rows = []
    for row in reader:
        rows.append(row)

    if not rows:
        raise ValueError("Empty CSV file")

    # Parse dates and amounts
    lines = []
    total_credits = Decimal("0")
    total_debits = Decimal("0")
    min_date = None
    max_date = None

    for row in rows:
        # Flexible column matching
        txn_date_str = row.get("Date") or row.get("date") or row.get("Transaction Date") or ""
        description = row.get("Description") or row.get("description") or row.get("Narration") or ""
        reference = row.get("Reference") or row.get("reference") or row.get("Ref No") or ""
        cheque = row.get("Cheque") or row.get("cheque") or row.get("Chq No") or ""
        debit_str = row.get("Debit") or row.get("debit") or row.get("Withdrawal") or "0"
        credit_str = row.get("Credit") or row.get("credit") or row.get("Deposit") or "0"
        balance_str = row.get("Balance") or row.get("balance") or row.get("Closing Balance") or ""

        # Clean amounts
        debit = Decimal(debit_str.replace(",", "").strip() or "0")
        credit = Decimal(credit_str.replace(",", "").strip() or "0")
        balance = Decimal(balance_str.replace(",", "").strip() or "0") if balance_str.strip() else None

        # Parse date
        txn_date = None
        for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%m/%d/%Y"):
            try:
                txn_date = datetime.strptime(txn_date_str.strip(), fmt).date()
                break
            except (ValueError, AttributeError):
                continue

        if not txn_date:
            continue

        if min_date is None or txn_date < min_date:
            min_date = txn_date
        if max_date is None or txn_date > max_date:
            max_date = txn_date

        total_credits += credit
        total_debits += debit

        lines.append({
            "transaction_date": txn_date,
            "description": description.strip(),
            "reference_number": reference.strip() or None,
            "cheque_number": cheque.strip() or None,
            "debit": debit,
            "credit": credit,
            "balance": balance,
        })

    statement = BankStatement(
        account_id=account_id,
        source=BankStatementSource.MANUAL_UPLOAD,
        import_date=datetime.utcnow(),
        period_from=min_date or date.today(),
        period_to=max_date or date.today(),
        total_credits=total_credits,
        total_debits=total_debits,
        transaction_count=len(lines),
        created_by=user_id,
    )
    db.add(statement)
    await db.flush()

    for line_data in lines:
        line = BankStatementLine(
            statement_id=statement.id,
            account_id=account_id,
            **line_data,
        )
        db.add(line)

    await db.flush()
    logger.info(f"Imported bank statement: {len(lines)} lines for account {account_id}")
    return statement


# ====================== AUTO-RECONCILIATION ======================

async def auto_reconcile_statement(db: AsyncSession, statement_id: int) -> dict:
    """
    Group 3.2 — Auto-match bank statement lines with payments/invoices.
    Matching rules:
    1. Exact amount + reference number match → 95% confidence
    2. Exact amount + date match within 3 days → 80% confidence
    3. Exact amount + description keyword match → 70% confidence
    """
    statement = await db.get(BankStatement, statement_id)
    if not statement:
        return {"error": "Statement not found"}

    # Get unmatched lines
    lines_result = await db.execute(
        select(BankStatementLine).where(
            BankStatementLine.statement_id == statement_id,
            BankStatementLine.reconciliation_status == ReconciliationStatus.PENDING,
        )
    )
    lines = lines_result.scalars().all()

    matched = 0
    exceptions = 0

    for line in lines:
        match_found = False
        amount = line.credit if line.credit > 0 else line.debit

        if not amount or amount <= 0:
            continue

        # Strategy 1: Match by reference number against payment.transaction_ref
        if line.reference_number:
            payment_result = await db.execute(
                select(Payment).where(
                    Payment.transaction_ref == line.reference_number,
                    Payment.is_deleted == False,
                )
            )
            payment = payment_result.scalar_one_or_none()
            if payment and abs(Decimal(str(payment.amount)) - amount) < Decimal("1"):
                line.reconciliation_status = ReconciliationStatus.AUTO_MATCHED
                line.matched_payment_id = payment.id
                line.matched_invoice_id = payment.invoice_id
                line.match_confidence = Decimal("95")
                line.matched_at = datetime.utcnow()
                matched += 1
                match_found = True

        # Strategy 2: Amount + date match
        if not match_found:
            payment_result = await db.execute(
                select(Payment).where(
                    func.abs(Payment.amount - amount) < 1,
                    Payment.payment_date.between(
                        line.transaction_date - 3,  # within 3 days
                        line.transaction_date + 3,
                    ),
                    Payment.is_deleted == False,
                    Payment.status == PaymentStatus.COMPLETED,
                ).limit(1)
            )
            payment = payment_result.scalar_one_or_none()
            if payment:
                line.reconciliation_status = ReconciliationStatus.AUTO_MATCHED
                line.matched_payment_id = payment.id
                line.matched_invoice_id = payment.invoice_id
                line.match_confidence = Decimal("80")
                line.matched_at = datetime.utcnow()
                matched += 1
                match_found = True

        # Strategy 3: Match by invoice amount_due
        if not match_found and line.credit > 0:
            inv_result = await db.execute(
                select(Invoice).where(
                    func.abs(Invoice.amount_due - amount) < 1,
                    Invoice.status.in_([
                        InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE,
                    ]),
                    Invoice.is_deleted == False,
                ).limit(1)
            )
            invoice = inv_result.scalar_one_or_none()
            if invoice:
                line.reconciliation_status = ReconciliationStatus.AUTO_MATCHED
                line.matched_invoice_id = invoice.id
                line.match_confidence = Decimal("70")
                line.matched_at = datetime.utcnow()
                matched += 1
                match_found = True

        # No match → exception
        if not match_found:
            line.reconciliation_status = ReconciliationStatus.EXCEPTION
            line.exception_reason = "No matching payment or invoice found"
            exceptions += 1

    # Update statement counters
    statement.matched_count = matched
    statement.exception_count = exceptions

    if exceptions > 0:
        alert = FinanceAlert(
            alert_type=FinanceAlertType.RECONCILIATION_EXCEPTION,
            severity=FinanceAlertSeverity.WARNING,
            title=f"Bank reconciliation: {exceptions} exceptions",
            message=f"Statement #{statement_id}: {matched} matched, {exceptions} exceptions out of {len(lines)} lines.",
            tenant_id=statement.tenant_id,
        )
        db.add(alert)

    await db.flush()
    logger.info(f"Auto-reconciliation done: {matched} matched, {exceptions} exceptions")
    return {"matched": matched, "exceptions": exceptions, "total": len(lines)}


async def manual_match_line(
    db: AsyncSession, line_id: int, payment_id: int = None,
    invoice_id: int = None, user_id: int = None,
) -> BankStatementLine | None:
    """Group 3.4 — Manual match a bank statement line."""
    line = await db.get(BankStatementLine, line_id)
    if not line:
        return None

    line.reconciliation_status = ReconciliationStatus.MANUAL_MATCHED
    line.matched_payment_id = payment_id
    line.matched_invoice_id = invoice_id
    line.match_confidence = Decimal("100")
    line.matched_at = datetime.utcnow()
    line.matched_by = user_id
    line.exception_reason = None
    await db.flush()
    return line


async def ignore_statement_line(db: AsyncSession, line_id: int, user_id: int = None) -> BankStatementLine | None:
    """Mark a bank statement line as ignored."""
    line = await db.get(BankStatementLine, line_id)
    if not line:
        return None
    line.reconciliation_status = ReconciliationStatus.IGNORED
    line.matched_by = user_id
    await db.flush()
    return line


async def get_reconciliation_summary(db: AsyncSession, statement_id: int) -> dict:
    """Get reconciliation summary for a bank statement."""
    result = await db.execute(
        select(
            BankStatementLine.reconciliation_status,
            func.count(BankStatementLine.id),
            func.sum(BankStatementLine.credit),
            func.sum(BankStatementLine.debit),
        ).where(
            BankStatementLine.statement_id == statement_id,
        ).group_by(BankStatementLine.reconciliation_status)
    )
    rows = result.all()
    summary = {}
    for status, count, credits, debits in rows:
        key = status.value if hasattr(status, "value") else str(status)
        summary[key] = {
            "count": count,
            "credits": float(credits or 0),
            "debits": float(debits or 0),
        }
    return summary


async def list_statement_lines(
    db: AsyncSession, statement_id: int, status: str = None, page: int = 1, limit: int = 50,
) -> tuple:
    """List bank statement lines with optional status filter."""
    query = select(BankStatementLine).where(BankStatementLine.statement_id == statement_id)
    count_query = select(func.count(BankStatementLine.id)).where(BankStatementLine.statement_id == statement_id)

    if status:
        query = query.where(BankStatementLine.reconciliation_status == ReconciliationStatus[status.upper()])
        count_query = count_query.where(BankStatementLine.reconciliation_status == ReconciliationStatus[status.upper()])

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(BankStatementLine.transaction_date.desc()))
    return result.scalars().all(), total


# ====================== FASTAG ======================

async def import_fastag_transactions(db: AsyncSession, transactions: list[dict]) -> int:
    """
    Group 3.5 — Import FASTag toll transactions.
    Called by daily cron at 9 PM or via API.
    """
    imported = 0
    for txn_data in transactions:
        txn_id = txn_data.get("transaction_id")
        if not txn_id:
            continue

        # Check for duplicate
        existing = await db.execute(
            select(FASTagTransaction).where(FASTagTransaction.transaction_id == txn_id)
        )
        if existing.scalar_one_or_none():
            continue

        txn = FASTagTransaction(
            vehicle_id=txn_data["vehicle_id"],
            tag_id=txn_data.get("tag_id"),
            transaction_id=txn_id,
            transaction_date=txn_data.get("transaction_date", datetime.utcnow()),
            transaction_type=FASTagTxnType.TOLL,
            plaza_name=txn_data.get("plaza_name"),
            plaza_code=txn_data.get("plaza_code"),
            lane_number=txn_data.get("lane_number"),
            amount=Decimal(str(txn_data["amount"])),
            balance_after=Decimal(str(txn_data.get("balance_after", 0))) if txn_data.get("balance_after") else None,
            trip_id=txn_data.get("trip_id"),
            tenant_id=txn_data.get("tenant_id"),
        )
        db.add(txn)
        imported += 1

    await db.flush()
    logger.info(f"Imported {imported} FASTag transactions")
    return imported


async def list_fastag_transactions(
    db: AsyncSession, vehicle_id: int = None, trip_id: int = None,
    date_from: date = None, date_to: date = None,
    page: int = 1, limit: int = 50,
) -> tuple:
    """List FASTag transactions with filters."""
    query = select(FASTagTransaction)
    count_query = select(func.count(FASTagTransaction.id))

    if vehicle_id:
        query = query.where(FASTagTransaction.vehicle_id == vehicle_id)
        count_query = count_query.where(FASTagTransaction.vehicle_id == vehicle_id)
    if trip_id:
        query = query.where(FASTagTransaction.trip_id == trip_id)
        count_query = count_query.where(FASTagTransaction.trip_id == trip_id)
    if date_from:
        query = query.where(FASTagTransaction.transaction_date >= datetime.combine(date_from, datetime.min.time()))
        count_query = count_query.where(FASTagTransaction.transaction_date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.where(FASTagTransaction.transaction_date <= datetime.combine(date_to, datetime.max.time()))
        count_query = count_query.where(FASTagTransaction.transaction_date <= datetime.combine(date_to, datetime.max.time()))

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(FASTagTransaction.transaction_date.desc()))
    return result.scalars().all(), total
