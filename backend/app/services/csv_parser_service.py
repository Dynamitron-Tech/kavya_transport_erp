# CSV Parser Service — Multi-bank format detection & parsing
# Supports: HDFC, ICICI, SBI, Axis, Kotak, Generic
import csv
import io
import logging
import re
from datetime import datetime, date
from typing import List, Optional, Tuple

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.postgres.banking import BankCSVImport, BankCSVTransaction
from app.models.postgres.finance import Invoice, InvoiceStatus

logger = logging.getLogger(__name__)

# Bank format signatures (header column patterns)
BANK_SIGNATURES = {
    "HDFC": {"date", "narration", "withdrawal", "deposit", "closing balance"},
    "ICICI": {"transaction date", "value date", "description", "debit", "credit", "balance"},
    "SBI": {"txn date", "description", "ref no", "debit", "credit", "balance"},
    "AXIS": {"tran date", "particulars", "debit", "credit", "balance"},
    "KOTAK": {"date", "description", "ref", "debit", "credit", "balance"},
}

# Column mappings per bank
COLUMN_MAP = {
    "HDFC": {"date": "date", "description": "narration", "reference": "chq./ref.no.", "debit": "withdrawal amt.", "credit": "deposit amt.", "balance": "closing balance"},
    "ICICI": {"date": "transaction date", "description": "description", "reference": "cheque number", "debit": "debit", "credit": "credit", "balance": "balance"},
    "SBI": {"date": "txn date", "description": "description", "reference": "ref no", "debit": "debit", "credit": "credit", "balance": "balance"},
    "AXIS": {"date": "tran date", "description": "particulars", "reference": "chq no", "debit": "debit", "credit": "credit", "balance": "balance"},
    "KOTAK": {"date": "date", "description": "description", "reference": "ref", "debit": "debit", "credit": "credit", "balance": "balance"},
}

DATE_FORMATS = [
    "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
    "%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y",
    "%d %b %Y", "%d %B %Y", "%d-%b-%Y",
]


def _detect_bank(headers: List[str]) -> str:
    """Detect bank format from header columns."""
    normalized = {h.strip().lower() for h in headers if h.strip()}
    best_match = "GENERIC"
    best_score = 0
    for bank, sig in BANK_SIGNATURES.items():
        score = len(sig & normalized)
        if score > best_score:
            best_score = score
            best_match = bank
    return best_match if best_score >= 2 else "GENERIC"


def _parse_amount(val: str) -> int:
    """Parse amount string to paise (integer). Returns 0 for empty/invalid."""
    if not val or not val.strip():
        return 0
    cleaned = re.sub(r"[₹,\s\"']", "", val.strip())
    if cleaned in ("-", "", "0.00", "0"):
        return 0
    try:
        return int(round(float(cleaned) * 100))
    except (ValueError, TypeError):
        return 0


def _parse_date(val: str) -> Optional[date]:
    """Try multiple date formats."""
    if not val or not val.strip():
        return None
    val = val.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    return None


def _find_column(headers: List[str], candidates: List[str]) -> Optional[int]:
    """Find column index by matching against candidate names."""
    normalized = [h.strip().lower() for h in headers]
    for candidate in candidates:
        for idx, h in enumerate(normalized):
            if candidate in h:
                return idx
    return None


def parse_csv_content(csv_text: str, bank_hint: Optional[str] = None) -> Tuple[str, List[dict]]:
    """Parse CSV text into standardized transaction rows.

    Returns: (detected_bank, list_of_row_dicts)
    Each row: {txn_date, description, reference_no, debit_paise, credit_paise, balance_paise, raw_row}
    """
    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)

    if len(rows) < 2:
        raise ValueError("CSV file has no data rows")

    # Find the header row (skip blank rows or bank metadata rows)
    header_idx = 0
    headers = []
    for i, row in enumerate(rows[:10]):
        if len([c for c in row if c.strip()]) >= 3:
            headers = row
            header_idx = i
            break

    if not headers:
        raise ValueError("Could not detect CSV header row")

    bank = bank_hint or _detect_bank(headers)
    col_map = COLUMN_MAP.get(bank)

    # For known banks, use column mapping
    if col_map:
        date_idx = _find_column(headers, [col_map["date"]])
        desc_idx = _find_column(headers, [col_map["description"]])
        ref_idx = _find_column(headers, [col_map.get("reference", "")])
        debit_idx = _find_column(headers, [col_map["debit"]])
        credit_idx = _find_column(headers, [col_map["credit"]])
        bal_idx = _find_column(headers, [col_map["balance"]])
    else:
        # Generic detection
        date_idx = _find_column(headers, ["date", "txn date", "transaction date", "tran date", "value date"])
        desc_idx = _find_column(headers, ["narration", "description", "particulars", "remarks", "details"])
        ref_idx = _find_column(headers, ["ref", "reference", "chq", "cheque", "utr"])
        debit_idx = _find_column(headers, ["debit", "withdrawal", "dr"])
        credit_idx = _find_column(headers, ["credit", "deposit", "cr"])
        bal_idx = _find_column(headers, ["balance", "closing balance", "running balance"])

    if date_idx is None:
        raise ValueError("Cannot detect date column in CSV")

    parsed_rows = []
    for row in rows[header_idx + 1:]:
        if len(row) <= date_idx or not row[date_idx].strip():
            continue  # Skip empty rows

        txn_date = _parse_date(row[date_idx])
        if not txn_date:
            continue

        description = row[desc_idx].strip() if desc_idx is not None and desc_idx < len(row) else ""
        reference = row[ref_idx].strip() if ref_idx is not None and ref_idx < len(row) else ""
        debit_paise = _parse_amount(row[debit_idx]) if debit_idx is not None and debit_idx < len(row) else 0
        credit_paise = _parse_amount(row[credit_idx]) if credit_idx is not None and credit_idx < len(row) else 0
        balance_paise = _parse_amount(row[bal_idx]) if bal_idx is not None and bal_idx < len(row) else 0

        # Some banks put both in one "amount" column with +/-
        if debit_paise == 0 and credit_paise == 0:
            amt_idx = _find_column(headers, ["amount", "value"])
            if amt_idx is not None and amt_idx < len(row):
                raw_amt = row[amt_idx].strip()
                amt = _parse_amount(raw_amt)
                if raw_amt.startswith("-") or raw_amt.startswith("("):
                    debit_paise = abs(amt)
                else:
                    credit_paise = abs(amt)

        if debit_paise == 0 and credit_paise == 0:
            continue  # Skip zero-amount rows

        parsed_rows.append({
            "txn_date": txn_date,
            "description": description,
            "reference_no": reference,
            "debit_paise": debit_paise,
            "credit_paise": credit_paise,
            "balance_paise": balance_paise,
            "raw_row": dict(zip(headers, row)),
        })

    return bank, parsed_rows


async def import_csv_and_parse(
    db: AsyncSession, account_id: int, csv_text: str, filename: str, user_id: int
) -> Tuple[BankCSVImport, List[dict]]:
    """Import CSV file, parse it, save to database, return preview."""
    bank, parsed_rows = parse_csv_content(csv_text)

    csv_import = BankCSVImport(
        account_id=account_id,
        filename=filename,
        row_count=len(parsed_rows),
        status="parsed",
        imported_by=user_id,
    )
    db.add(csv_import)
    await db.flush()

    for row in parsed_rows:
        txn = BankCSVTransaction(
            import_id=csv_import.id,
            txn_date=row["txn_date"],
            description=row["description"],
            reference_no=row["reference_no"],
            debit_paise=row["debit_paise"],
            credit_paise=row["credit_paise"],
            balance_paise=row["balance_paise"],
            raw_row=row["raw_row"],
        )
        db.add(txn)

    await db.flush()

    preview = parsed_rows[:5]
    for p in preview:
        p["txn_date"] = p["txn_date"].isoformat()

    return csv_import, preview


async def auto_match_csv_transactions(db: AsyncSession, import_id: int) -> dict:
    """Auto-match imported CSV credit transactions to invoices.

    Matching strategy:
    - Amount_paise matches exactly
    - Invoice status in (PENDING, SENT, PARTIALLY_PAID, OVERDUE)
    - date within 7 days of txn_date
    - 1 match = matched, 0 or 2+ = exception
    """
    result = await db.execute(
        select(BankCSVTransaction).where(
            BankCSVTransaction.import_id == import_id,
            BankCSVTransaction.match_status == "unmatched",
            BankCSVTransaction.credit_paise > 0,
        )
    )
    unmatched = result.scalars().all()

    matched_count = 0
    exception_count = 0

    for txn in unmatched:
        # Find invoices matching amount within 7 days
        candidates = await db.execute(
            select(Invoice).where(
                and_(
                    Invoice.status.in_([
                        InvoiceStatus.PENDING, InvoiceStatus.SENT,
                        InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE,
                    ]),
                    func.abs(
                        func.cast(Invoice.total_amount * 100, sa.BigInteger) - txn.credit_paise
                    ) <= 100,  # within 1 rupee tolerance
                    Invoice.due_date >= txn.txn_date - timedelta(days=7),
                    Invoice.due_date <= txn.txn_date + timedelta(days=7),
                )
            )
        )

        import sqlalchemy as sa
        matches = candidates.scalars().all()

        if len(matches) == 1:
            txn.match_status = "matched"
            txn.matched_invoice_id = matches[0].id
            matched_count += 1
        elif len(matches) == 0:
            # Try reference number matching
            if txn.reference_no:
                ref_result = await db.execute(
                    select(Invoice).where(
                        Invoice.reference_number == txn.reference_no,
                        Invoice.status.in_([
                            InvoiceStatus.PENDING, InvoiceStatus.SENT,
                            InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE,
                        ]),
                    )
                )
                ref_matches = ref_result.scalars().all()
                if len(ref_matches) == 1:
                    txn.match_status = "matched"
                    txn.matched_invoice_id = ref_matches[0].id
                    matched_count += 1
                    continue
            txn.match_status = "exception"
            exception_count += 1
        else:
            txn.match_status = "exception"
            exception_count += 1

    # Update import counts
    csv_import = await db.get(BankCSVImport, import_id)
    if csv_import:
        csv_import.matched_count = matched_count
        csv_import.unmatched_count = exception_count
        csv_import.status = "completed"

    await db.flush()

    return {
        "matched": matched_count,
        "exceptions": exception_count,
        "total_processed": len(unmatched),
    }


async def list_csv_transactions(
    db: AsyncSession,
    import_id: int,
    match_status: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
) -> Tuple[List[BankCSVTransaction], int]:
    query = select(BankCSVTransaction).where(BankCSVTransaction.import_id == import_id)
    if match_status:
        query = query.where(BankCSVTransaction.match_status == match_status)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(BankCSVTransaction.txn_date.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    return result.scalars().all(), total


async def manual_match_csv_transaction(
    db: AsyncSession, txn_id: int, invoice_id: Optional[int] = None, entry_id: Optional[int] = None
) -> BankCSVTransaction:
    txn = await db.get(BankCSVTransaction, txn_id)
    if not txn:
        raise ValueError("CSV transaction not found")
    txn.match_status = "matched"
    txn.matched_invoice_id = invoice_id
    txn.matched_entry_id = entry_id
    await db.flush()
    return txn


async def ignore_csv_transaction(db: AsyncSession, txn_id: int) -> BankCSVTransaction:
    txn = await db.get(BankCSVTransaction, txn_id)
    if not txn:
        raise ValueError("CSV transaction not found")
    txn.match_status = "ignored"
    await db.flush()
    return txn


async def get_reconciliation_exceptions(
    db: AsyncSession, import_id: int, page: int = 1, limit: int = 50
) -> Tuple[List[BankCSVTransaction], int]:
    return await list_csv_transactions(db, import_id, match_status="exception", page=page, limit=limit)
