# Bank Statement Parser — Multi-bank smart column detection
# Supports: HDFC, ICICI, SBI, Axis, Kotak, Generic CSV + Excel
# All amounts stored as integer paise (1 rupee = 100 paise)

from __future__ import annotations

import csv
import io
import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Column alias dictionary — maps canonical names to bank variant column headers
# ---------------------------------------------------------------------------

KNOWN_COLUMN_ALIASES: dict[str, list[str]] = {
    "date": [
        "date", "txn date", "transaction date", "value date",
        "posting date", "tran date",
    ],
    "description": [
        "description", "narration", "particulars", "details",
        "remarks", "transaction details",
    ],
    "debit": [
        "debit", "withdrawal", "dr", "debit amount", "amount(dr)",
        "withdrawal amt.", "withdrawal amt",
    ],
    "credit": [
        "credit", "deposit", "cr", "credit amount", "amount(cr)",
        "deposit amt.", "deposit amt",
    ],
    "amount": [
        "amount", "net amount", "transaction amount",
    ],
    "balance": [
        "balance", "closing balance", "running balance",
        "available balance", "avl bal",
    ],
    "reference": [
        "reference", "ref no", "cheque no", "utr", "transaction id",
        "chq/ref number", "chq./ref.no.", "cheque number", "ref",
        "instrument number",
    ],
}

DATE_FORMATS = [
    "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
    "%Y-%m-%d", "%Y/%m/%d",
    "%d %b %Y", "%d %B %Y", "%d-%b-%Y", "%d %b %y",
    "%m/%d/%Y",
]

# UPI transaction ID: 12 digits, or starts with T followed by digits
UPI_TXN_PATTERN = re.compile(r"\b([0-9]{12}|T[0-9]{10,14})\b")

# Indian number format: 1,23,456.78 or 1234.56
AMOUNT_CLEAN_RE = re.compile(r"[₹,\s\"']+")


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class BankTransaction:
    row_number: int
    date: date
    description: str
    description_normalized: str        # cleaned, lowercase
    reference_number: Optional[str]    # UPI ID, cheque no, NEFT ref
    debit_paise: int                   # 0 if credit transaction
    credit_paise: int                  # 0 if debit transaction
    balance_paise: Optional[int]
    transaction_type: str              # "debit" | "credit"


@dataclass
class BankStatementResult:
    bank_name: Optional[str]
    account_number_hint: Optional[str]  # last 4 digits if found in header area
    statement_from: Optional[date]
    statement_to: Optional[date]
    opening_balance_paise: Optional[int]
    closing_balance_paise: Optional[int]
    transactions: List[BankTransaction]
    total_debits_paise: int
    total_credits_paise: int
    parse_warnings: List[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_date(raw: str) -> Optional[date]:
    raw = (raw or "").strip()
    if not raw:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _parse_paise(raw: str) -> int:
    """Parse Indian number format string → integer paise.  Returns 0 on failure."""
    if not raw:
        return 0
    cleaned = AMOUNT_CLEAN_RE.sub("", raw.strip())
    if cleaned in ("", "-", "0.00", "0"):
        return 0
    try:
        return int(round(float(cleaned) * 100))
    except (ValueError, TypeError):
        return 0


def _normalize_description(desc: str) -> str:
    """Lowercase, collapse whitespace, strip punctuation noise."""
    d = (desc or "").lower()
    d = re.sub(r"\s+", " ", d).strip()
    return d


def _extract_upi_ref(text: str) -> Optional[str]:
    m = UPI_TXN_PATTERN.search(text or "")
    return m.group(0) if m else None


def _find_header_row(rows: list[list[str]]) -> Tuple[int, list[str]]:
    """Scan first 20 rows to find the one that best matches known column aliases.

    Returns (header_row_index, header_cells).
    """
    all_aliases: set[str] = set()
    for aliases in KNOWN_COLUMN_ALIASES.values():
        all_aliases.update(a.lower() for a in aliases)

    best_idx = 0
    best_score = -1
    best_headers: list[str] = []

    for i, row in enumerate(rows[:20]):
        if not row:
            continue
        cells_lower = [c.strip().lower() for c in row]
        score = sum(
            1 for cell in cells_lower
            if cell and any(alias in cell or cell in alias for alias in all_aliases)
        )
        if score > best_score:
            best_score = score
            best_idx = i
            best_headers = row

    return best_idx, best_headers


def _map_columns(headers: list[str]) -> dict[str, int]:
    """Map canonical column names → column index using KNOWN_COLUMN_ALIASES.

    Returns dict with keys from KNOWN_COLUMN_ALIASES that were found.
    """
    mapping: dict[str, int] = {}
    normalized = [h.strip().lower() for h in headers]

    for canonical, aliases in KNOWN_COLUMN_ALIASES.items():
        for alias in aliases:
            for idx, h in enumerate(normalized):
                if alias == h or alias in h:
                    if canonical not in mapping:  # first match wins
                        mapping[canonical] = idx
                    break
            if canonical in mapping:
                break

    return mapping


def _detect_bank(headers: list[str]) -> str:
    """Heuristic: detect which bank this statement is from."""
    text = " ".join(h.strip().lower() for h in headers)
    if "narration" in text and "closing balance" in text:
        return "HDFC"
    if "transaction date" in text and "value date" in text:
        return "ICICI"
    if "txn date" in text:
        return "SBI"
    if "tran date" in text and "particulars" in text:
        return "AXIS"
    return "GENERIC"


def _detect_account_number(pre_header_rows: list[list[str]]) -> Optional[str]:
    """Look for last-4-digit account number hint in metadata rows above the header."""
    pattern = re.compile(r"[Xx*]{6,}(\d{4})")
    for row in pre_header_rows:
        for cell in row:
            m = pattern.search(cell or "")
            if m:
                return m.group(1)
    return None


def _is_summary_row(row: list[str], col_count: int) -> bool:
    """Return True for rows that are clearly totals/summaries, not transactions."""
    non_empty = [c.strip() for c in row if c.strip()]
    if not non_empty:
        return True
    if len(non_empty) <= 1:
        return True
    joined = " ".join(non_empty).lower()
    if any(kw in joined for kw in ("total", "opening balance", "closing balance", "summary")):
        return True
    return False


# ---------------------------------------------------------------------------
# Main parser class
# ---------------------------------------------------------------------------

class BankStatementParser:
    """Parses CSV or Excel bank statements from Indian banks."""

    def parse_csv(self, content: str, bank_name: Optional[str] = None) -> BankStatementResult:
        """Parse CSV text content."""
        reader = csv.reader(io.StringIO(content))
        rows = [row for row in reader]
        return self._process_rows(rows, bank_name)

    def parse_excel(self, file_bytes: bytes, bank_name: Optional[str] = None) -> BankStatementResult:
        """Parse Excel (.xlsx/.xls) file bytes."""
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
            ws = wb.active
            rows: list[list[str]] = []
            for row in ws.iter_rows(values_only=True):
                rows.append([str(c) if c is not None else "" for c in row])
            return self._process_rows(rows, bank_name)
        except ImportError:
            raise ValueError("openpyxl not installed — cannot parse Excel files")

    def _process_rows(
        self,
        rows: list[list[str]],
        bank_name_hint: Optional[str],
    ) -> BankStatementResult:
        warnings: list[str] = []

        if len(rows) < 2:
            raise ValueError("File has no data rows")

        header_idx, raw_headers = _find_header_row(rows)
        if not raw_headers:
            raise ValueError("Could not detect a header row in the file")

        bank_name = bank_name_hint or _detect_bank(raw_headers)
        col_map = _map_columns(raw_headers)
        acct_hint = _detect_account_number(rows[:header_idx])

        missing = [c for c in ("date", "description") if c not in col_map]
        if missing:
            warnings.append(f"Could not detect columns: {', '.join(missing)}")

        # Determine how amounts are represented
        has_split_dr_cr = ("debit" in col_map or "credit" in col_map)
        has_net_amount = "amount" in col_map and not has_split_dr_cr

        data_rows = rows[header_idx + 1:]
        transactions: list[BankTransaction] = []
        total_debits_paise = 0
        total_credits_paise = 0
        opening_balance_paise: Optional[int] = None
        closing_balance_paise: Optional[int] = None

        for row_idx, row in enumerate(data_rows, start=header_idx + 2):
            if _is_summary_row(row, len(raw_headers)):
                continue

            def _cell(key: str) -> str:
                idx = col_map.get(key)
                if idx is None or idx >= len(row):
                    return ""
                return (row[idx] or "").strip()

            raw_date = _cell("date")
            txn_date = _parse_date(raw_date)
            if txn_date is None:
                if raw_date:
                    warnings.append(f"Row {row_idx}: could not parse date '{raw_date}'")
                continue

            description = _cell("description")
            reference = _cell("reference") or None

            # Extract UPI ref from reference or description
            upi_ref = _extract_upi_ref(reference or "") or _extract_upi_ref(description)
            final_ref = upi_ref or reference

            debit_paise = 0
            credit_paise = 0

            if has_split_dr_cr:
                debit_paise = _parse_paise(_cell("debit"))
                credit_paise = _parse_paise(_cell("credit"))
            elif has_net_amount:
                amt = _parse_paise(_cell("amount"))
                # Positive = credit, negative = debit (some banks)
                if amt < 0:
                    debit_paise = -amt
                else:
                    credit_paise = amt

            balance_raw = _cell("balance")
            balance_paise: Optional[int] = _parse_paise(balance_raw) if balance_raw else None

            if debit_paise == 0 and credit_paise == 0:
                warnings.append(f"Row {row_idx}: zero-amount transaction skipped")
                continue

            txn_type = "credit" if credit_paise > debit_paise else "debit"
            total_debits_paise += debit_paise
            total_credits_paise += credit_paise

            if balance_paise is not None:
                if opening_balance_paise is None:
                    opening_balance_paise = balance_paise
                closing_balance_paise = balance_paise

            transactions.append(BankTransaction(
                row_number=row_idx,
                date=txn_date,
                description=description,
                description_normalized=_normalize_description(description),
                reference_number=final_ref,
                debit_paise=debit_paise,
                credit_paise=credit_paise,
                balance_paise=balance_paise,
                transaction_type=txn_type,
            ))

        stmt_from = min((t.date for t in transactions), default=None)
        stmt_to = max((t.date for t in transactions), default=None)

        return BankStatementResult(
            bank_name=bank_name,
            account_number_hint=acct_hint,
            statement_from=stmt_from,
            statement_to=stmt_to,
            opening_balance_paise=opening_balance_paise,
            closing_balance_paise=closing_balance_paise,
            transactions=transactions,
            total_debits_paise=total_debits_paise,
            total_credits_paise=total_credits_paise,
            parse_warnings=warnings,
        )
