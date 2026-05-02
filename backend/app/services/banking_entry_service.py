# Banking Entry Service — full business logic for banking module
import logging
from datetime import date, datetime, timedelta
from typing import Optional, Tuple, List

from sqlalchemy import select, func, and_, case, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.postgres.banking import BankingEntry, BankingEntryType
from app.models.postgres.route import BankAccount
from app.models.postgres.finance import Invoice, InvoiceStatus, Ledger, LedgerType
from app.models.postgres.client import Client

logger = logging.getLogger(__name__)

CREDIT_TYPES = {BankingEntryType.PAYMENT_RECEIVED, BankingEntryType.CASH_DEPOSIT}
DEBIT_TYPES = {BankingEntryType.PAYMENT_MADE, BankingEntryType.CASH_WITHDRAWAL}


async def _generate_entry_no(db: AsyncSession, entry_date: date) -> str:
    """Generate entry number: BNK-YYYY-MM-NNNN"""
    prefix = f"BNK-{entry_date.year}-{entry_date.month:02d}"
    result = await db.execute(
        select(func.count(BankingEntry.id)).where(
            BankingEntry.entry_no.like(f"{prefix}-%"),
            BankingEntry.is_deleted == False,
        )
    )
    count = result.scalar() or 0
    return f"{prefix}-{count + 1:04d}"


async def create_banking_entry(
    db: AsyncSession, data: dict, user_id: int
) -> BankingEntry:
    """Create a banking entry with full business logic."""
    entry_type = BankingEntryType(data["entry_type"])
    account_id = data["account_id"]
    amount_paise = data["amount_paise"]
    invoice_id = data.get("invoice_id")
    transfer_to_account_id = data.get("transfer_to_account_id")
    entry_date = data["entry_date"]

    # Validate account exists and is active
    account = await db.get(BankAccount, account_id)
    if not account or not account.is_active:
        raise ValueError("Bank account not found or inactive")

    # Validate transfer target for bank_transfer
    if entry_type == BankingEntryType.BANK_TRANSFER:
        if not transfer_to_account_id:
            raise ValueError("transfer_to_account_id required for bank transfers")
        target_account = await db.get(BankAccount, transfer_to_account_id)
        if not target_account or not target_account.is_active:
            raise ValueError("Target bank account not found or inactive")
        if transfer_to_account_id == account_id:
            raise ValueError("Cannot transfer to the same account")

    # Generate entry number
    entry_no = await _generate_entry_no(db, entry_date)

    entry = BankingEntry(
        entry_no=entry_no,
        account_id=account_id,
        entry_date=entry_date,
        entry_type=entry_type,
        amount_paise=amount_paise,
        payment_method=data.get("payment_method"),
        reference_no=data.get("reference_no"),
        client_id=data.get("client_id"),
        job_id=data.get("job_id"),
        invoice_id=invoice_id,
        transfer_to_account_id=transfer_to_account_id,
        description=data.get("description"),
        created_by=user_id,
    )
    db.add(entry)
    await db.flush()

    # Update account balance
    from decimal import Decimal
    amt = Decimal(amount_paise)
    if entry_type in CREDIT_TYPES:
        account.current_balance = Decimal(str(account.current_balance or 0)) + amt / 100
    elif entry_type in DEBIT_TYPES:
        account.current_balance = Decimal(str(account.current_balance or 0)) - amt / 100
    elif entry_type == BankingEntryType.BANK_TRANSFER:
        account.current_balance = Decimal(str(account.current_balance or 0)) - amt / 100
        target_account.current_balance = Decimal(str(target_account.current_balance or 0)) + amt / 100
    # JOURNAL_ENTRY: no auto balance change

    # Handle invoice linking
    if invoice_id and entry_type == BankingEntryType.PAYMENT_RECEIVED:
        invoice = await db.get(Invoice, invoice_id)
        if invoice and invoice.status in (InvoiceStatus.PENDING, InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE):
            paid_rupees = Decimal(amount_paise) / 100
            invoice.amount_paid = Decimal(str(invoice.amount_paid or 0)) + paid_rupees
            invoice.amount_due = Decimal(str(invoice.total_amount or 0)) - Decimal(str(invoice.amount_paid))
            if invoice.amount_due <= 0:
                invoice.status = InvoiceStatus.PAID
                invoice.amount_due = Decimal("0")
                invoice.paid_at = datetime.utcnow()
            else:
                invoice.status = InvoiceStatus.PARTIALLY_PAID

    # Post ledger entries
    await _post_ledger_entry(db, entry, user_id)

    await db.flush()

    # Check low balance alert
    threshold = getattr(account, "alert_threshold_paise", 500000) or 500000
    current_paise = int(Decimal(str(account.current_balance or 0)) * 100)
    if current_paise < threshold:
        try:
            from app.tasks.banking_tasks import low_balance_alert
            low_balance_alert.delay(account_id)
        except Exception:
            logger.warning("Could not dispatch low_balance_alert task (broker unavailable?)")

    return entry


async def _post_ledger_entry(db: AsyncSession, entry: BankingEntry, user_id: int):
    """Create corresponding ledger entries for a banking entry."""
    amt_rupees = float(entry.amount_paise) / 100
    entry_date = entry.entry_date

    # Generate ledger entry number
    result = await db.execute(select(func.count(Ledger.id)))
    count = result.scalar() or 0
    entry_num = f"LED-{entry_date.year}-{count + 1:06d}"

    type_map = {
        BankingEntryType.PAYMENT_RECEIVED: (LedgerType.RECEIVABLE, amt_rupees, 0),
        BankingEntryType.PAYMENT_MADE: (LedgerType.PAYABLE, 0, amt_rupees),
        BankingEntryType.CASH_DEPOSIT: (LedgerType.ASSET, amt_rupees, 0),
        BankingEntryType.CASH_WITHDRAWAL: (LedgerType.ASSET, 0, amt_rupees),
        BankingEntryType.BANK_TRANSFER: (LedgerType.ASSET, amt_rupees, amt_rupees),
    }

    if entry.entry_type in type_map:
        ledger_type, debit, credit = type_map[entry.entry_type]
        ledger = Ledger(
            entry_number=entry_num,
            entry_date=entry_date,
            ledger_type=ledger_type,
            account_name=f"Bank-{entry.account_id}",
            debit=debit,
            credit=credit,
            narration=entry.description or f"Banking entry {entry.entry_no}",
            reference_type="banking_entry",
            reference_number=entry.entry_no,
            invoice_id=entry.invoice_id,
            client_id=entry.client_id,
            created_by=user_id,
        )
        db.add(ledger)


async def list_banking_entries(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    account_id: Optional[int] = None,
    entry_type: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    reconciled: Optional[bool] = None,
    search: Optional[str] = None,
) -> Tuple[List[BankingEntry], int]:
    """List banking entries with filters."""
    query = select(BankingEntry).where(BankingEntry.is_deleted == False)

    if account_id:
        query = query.where(BankingEntry.account_id == account_id)
    if entry_type:
        query = query.where(BankingEntry.entry_type == BankingEntryType(entry_type))
    if date_from:
        query = query.where(BankingEntry.entry_date >= date_from)
    if date_to:
        query = query.where(BankingEntry.entry_date <= date_to)
    if reconciled is not None:
        query = query.where(BankingEntry.reconciled == reconciled)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            BankingEntry.entry_no.ilike(pattern)
            | BankingEntry.reference_no.ilike(pattern)
            | BankingEntry.description.ilike(pattern)
        )

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch
    query = query.order_by(desc(BankingEntry.entry_date), desc(BankingEntry.id))
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    return result.scalars().all(), total


async def get_banking_entry(db: AsyncSession, entry_id: int) -> Optional[BankingEntry]:
    result = await db.execute(
        select(BankingEntry).where(BankingEntry.id == entry_id, BankingEntry.is_deleted == False)
    )
    return result.scalar_one_or_none()


async def get_entry_with_details(db: AsyncSession, entry: BankingEntry) -> dict:
    """Return entry as dict with resolved names."""
    data = {c.key: getattr(entry, c.key) for c in entry.__table__.columns}
    data["amount_rupees"] = float(entry.amount_paise) / 100
    data["entry_type"] = entry.entry_type.value if hasattr(entry.entry_type, "value") else entry.entry_type

    # Resolve account name
    account = await db.get(BankAccount, entry.account_id)
    data["account_name"] = account.account_name if account else None

    # Resolve client name
    if entry.client_id:
        client = await db.get(Client, entry.client_id)
        data["client_name"] = client.name if client else None
    else:
        data["client_name"] = None

    return data


async def update_banking_entry(
    db: AsyncSession, entry_id: int, data: dict
) -> Optional[BankingEntry]:
    entry = await get_banking_entry(db, entry_id)
    if not entry:
        return None
    if entry.reconciled:
        raise ValueError("Cannot edit a reconciled entry")
    for key, val in data.items():
        if hasattr(entry, key) and val is not None:
            setattr(entry, key, val)
    await db.flush()
    return entry


async def delete_banking_entry(db: AsyncSession, entry_id: int) -> bool:
    entry = await get_banking_entry(db, entry_id)
    if not entry:
        return False
    if entry.reconciled:
        raise ValueError("Cannot delete a reconciled entry")
    entry.is_deleted = True
    await db.flush()
    return True


async def get_balance_summary(db: AsyncSession) -> dict:
    """Get current balance per account + total."""
    result = await db.execute(
        select(BankAccount).where(BankAccount.is_active == True)
    )
    accounts = result.scalars().all()
    items = []
    total_paise = 0
    for acc in accounts:
        bal_paise = int(float(acc.current_balance or 0) * 100)
        total_paise += bal_paise
        items.append({
            "account_id": acc.id,
            "account_name": acc.account_name,
            "bank_name": acc.bank_name,
            "account_number": acc.account_number,
            "account_type": acc.account_type,
            "current_balance_paise": bal_paise,
            "current_balance_rupees": float(acc.current_balance or 0),
        })
    return {
        "total_balance_paise": total_paise,
        "total_balance_rupees": total_paise / 100,
        "accounts": items,
    }


async def get_balance_history(
    db: AsyncSession, account_id: Optional[int] = None, days: int = 30
) -> List[dict]:
    """Get daily balance history from banking entries."""
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    query = select(
        BankingEntry.entry_date,
        func.sum(
            case(
                (BankingEntry.entry_type.in_([BankingEntryType.PAYMENT_RECEIVED, BankingEntryType.CASH_DEPOSIT]),
                 BankingEntry.amount_paise),
                else_=-BankingEntry.amount_paise,
            )
        ).label("net_paise"),
    ).where(
        BankingEntry.is_deleted == False,
        BankingEntry.entry_date >= start_date,
        BankingEntry.entry_date <= end_date,
    )

    if account_id:
        query = query.where(BankingEntry.account_id == account_id)

    query = query.group_by(BankingEntry.entry_date).order_by(BankingEntry.entry_date)
    result = await db.execute(query)
    rows = result.all()

    history = []
    running = 0
    for row in rows:
        running += int(row.net_paise or 0)
        history.append({"date": row.entry_date.isoformat(), "balance_paise": running})
    return history
