# Bank Match Engine — auto-match bank transactions to ERP records
# Credits → invoices; Debits → expenses
# All amounts in integer paise throughout.

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import List, Optional

from sqlalchemy import and_, or_, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.postgres.finance import Invoice, InvoiceStatus
from app.models.postgres.expense import Expense, ApprovalStatus
from app.models.postgres.client import Client
from app.services.bank_statement_parser import BankTransaction

import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Confidence thresholds
# ---------------------------------------------------------------------------
HIGH_THRESHOLD = 85
MEDIUM_THRESHOLD = 60


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class AlternativeMatch:
    entity_type: str          # "invoice" | "expense"
    entity_id: int
    entity_ref: str
    amount_paise: int
    confidence: str
    reason: str


@dataclass
class MatchResult:
    transaction: BankTransaction
    matched_entity_type: Optional[str]   # "invoice" | "expense" | None
    matched_entity_id: Optional[int]
    matched_entity_ref: Optional[str]    # Invoice no. or expense description
    matched_amount_paise: Optional[int]
    confidence: str                       # "HIGH" | "MEDIUM" | "LOW" | "NONE"
    match_reason: str
    suggested_category: Optional[str]    # For unmatched debits
    alternative_matches: List[AlternativeMatch] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Category keyword heuristics for unmatched debits
# ---------------------------------------------------------------------------

CATEGORY_KEYWORDS: list[tuple[list[str], str]] = [
    (["salary", "sal", "wages", "payroll"], "driver_salary"),
    (["driver", "drv", "allowance"], "driver_salary"),
    (["fuel", "petrol", "diesel", "iocl", "hpcl", "bpcl"], "fuel"),
    (["insurance", "insur", "lic", "bajaj", "reliance", "hdfc ergo", "oriental"], "insurance"),
    (["gst", "tds", "nsdl", "tax", "income tax", "it dept", "cbdt"], "tax"),
    (["permit", "rto", "road tax", "fasTag", "toll", "fastag"], "permit_compliance"),
    (["rent", "lease", "office", "warehouse"], "market_vehicle_rent"),
    (["tyre", "tire", "mrf", "apollo", "ceat", "bridgestone"], "vehicle_spare_part"),
    (["repair", "maintenance", "service", "workshop", "garage", "spare"], "vehicle_spare_part"),
    (["loading", "unloading", "labour", "loader", "hamali"], "loading_unloading"),
]


def _suggest_category(desc: str) -> Optional[str]:
    d = desc.lower()
    for keywords, category in CATEGORY_KEYWORDS:
        if any(kw in d for kw in keywords):
            return category
    return None


# ---------------------------------------------------------------------------
# Amount comparison helpers
# ---------------------------------------------------------------------------

def _invoice_total_paise(invoice: Invoice) -> int:
    """Convert invoice.total_amount (Numeric, rupees) → paise."""
    try:
        return int(round(float(invoice.total_amount or 0) * 100))
    except (TypeError, ValueError):
        return 0


def _invoice_due_paise(invoice: Invoice) -> int:
    try:
        return int(round(float(invoice.amount_due or 0) * 100))
    except (TypeError, ValueError):
        return 0


def _pct_diff(a: int, b: int) -> float:
    if b == 0:
        return 1.0
    return abs(a - b) / b


def _name_similarity(client_name: str, description: str) -> float:
    """Simple word-overlap similarity between client name and bank description."""
    if not client_name or not description:
        return 0.0
    words_a = set(re.findall(r"[a-z]+", client_name.lower()))
    words_b = set(re.findall(r"[a-z]+", description.lower()))
    words_a = {w for w in words_a if len(w) > 2}
    words_b = {w for w in words_b if len(w) > 2}
    if not words_a:
        return 0.0
    overlap = len(words_a & words_b)
    return overlap / len(words_a)


def _calculate_confidence(score: float) -> str:
    if score >= HIGH_THRESHOLD:
        return "HIGH"
    if score >= MEDIUM_THRESHOLD:
        return "MEDIUM"
    if score > 0:
        return "LOW"
    return "NONE"


# ---------------------------------------------------------------------------
# Core match engine
# ---------------------------------------------------------------------------

class BankMatchEngine:
    """Auto-match bank statement transactions to ERP invoices / expenses."""

    async def match_transactions(
        self,
        transactions: List[BankTransaction],
        db: AsyncSession,
    ) -> List[MatchResult]:
        results: List[MatchResult] = []
        for txn in transactions:
            try:
                if txn.transaction_type == "credit":
                    result = await self.match_credit(txn, db)
                else:
                    result = await self.match_debit(txn, db)
                results.append(result)
            except Exception as exc:
                logger.warning("match_transactions error on row %s: %s", txn.row_number, exc)
                results.append(MatchResult(
                    transaction=txn,
                    matched_entity_type=None,
                    matched_entity_id=None,
                    matched_entity_ref=None,
                    matched_amount_paise=None,
                    confidence="NONE",
                    match_reason="Error during matching",
                    suggested_category=_suggest_category(txn.description_normalized),
                ))
        return results

    # ------------------------------------------------------------------
    # Credit matching
    # ------------------------------------------------------------------

    async def match_credit(
        self,
        txn: BankTransaction,
        db: AsyncSession,
    ) -> MatchResult:
        """Credit = money in. Match against unpaid / sent invoices."""

        unpaid_statuses = [
            InvoiceStatus.SENT,
            InvoiceStatus.PENDING,
            InvoiceStatus.OVERDUE,
            InvoiceStatus.PARTIALLY_PAID,
        ]

        # Strategy 1: exact amount on unpaid invoices
        result = await db.execute(
            select(Invoice, Client)
            .join(Client, Client.id == Invoice.client_id, isouter=True)
            .where(
                Invoice.status.in_(unpaid_statuses),
                Invoice.is_deleted == False,
            )
        )
        rows = result.all()
        invoices_with_client: list[tuple[Invoice, Optional[Client]]] = rows

        # Build candidate list with scores
        candidates: list[tuple[float, str, Invoice, Optional[Client]]] = []

        for inv, client in invoices_with_client:
            inv_paise = _invoice_total_paise(inv)
            score = 0.0
            reasons: list[str] = []

            # Exact amount match → strongly prefer unique matches
            if inv_paise == txn.credit_paise and inv_paise > 0:
                score += 90
                reasons.append("exact amount")

            # Reference number match (razorpay_payment_id, etc.)
            if txn.reference_number:
                ref_lower = txn.reference_number.lower()
                inv_ref = (inv.reference_number or "").lower()
                if ref_lower and inv_ref and (ref_lower in inv_ref or inv_ref in ref_lower):
                    score += 95
                    reasons.append("reference number match")
                # Check if any payment linked to invoice has a matching razorpay id
                # (We'll do this inline for efficiency)
                inv_number_lower = (inv.invoice_number or "").lower()
                if inv_number_lower and inv_number_lower in txn.description_normalized:
                    score += 85
                    reasons.append(f"invoice number '{inv.invoice_number}' in narration")

            # Client name in narration
            if client:
                sim = _name_similarity(client.name, txn.description_normalized)
                if sim >= 0.6:
                    score += sim * 60
                    reasons.append(f"client name match ({sim:.0%})")

            # Amount within ±1% (partial payment / bank charges)
            if inv_paise > 0 and score < HIGH_THRESHOLD:
                diff_pct = _pct_diff(txn.credit_paise, inv_paise)
                if diff_pct <= 0.01:
                    score = max(score, 65)
                    reasons.append(f"amount within ±1% ({diff_pct:.2%} diff)")

            if score > 0:
                reason_str = "; ".join(reasons)
                candidates.append((score, reason_str, inv, client))

        # Sort by score descending
        candidates.sort(key=lambda x: x[0], reverse=True)

        if not candidates:
            return MatchResult(
                transaction=txn,
                matched_entity_type=None,
                matched_entity_id=None,
                matched_entity_ref=None,
                matched_amount_paise=None,
                confidence="NONE",
                match_reason="No matching invoice found",
                suggested_category=None,
            )

        best_score, best_reason, best_inv, best_client = candidates[0]

        # Penalise if multiple invoices have the same exact amount (ambiguous)
        exact_matches = sum(1 for s, _, i, _ in candidates if _invoice_total_paise(i) == txn.credit_paise)
        if exact_matches > 1 and best_score >= 90:
            best_score = 75
            best_reason += f" (ambiguous — {exact_matches} invoices with same amount)"

        conf = _calculate_confidence(best_score)

        alternatives: list[AlternativeMatch] = []
        for s, r, inv, _ in candidates[1:3]:
            alternatives.append(AlternativeMatch(
                entity_type="invoice",
                entity_id=inv.id,
                entity_ref=inv.invoice_number,
                amount_paise=_invoice_total_paise(inv),
                confidence=_calculate_confidence(s),
                reason=r,
            ))

        client_name = best_client.name if best_client else ""
        return MatchResult(
            transaction=txn,
            matched_entity_type="invoice",
            matched_entity_id=best_inv.id,
            matched_entity_ref=best_inv.invoice_number,
            matched_amount_paise=_invoice_total_paise(best_inv),
            confidence=conf,
            match_reason=f"{best_reason} — {client_name}".strip(" —"),
            suggested_category=None,
            alternative_matches=alternatives,
        )

    # ------------------------------------------------------------------
    # Debit matching
    # ------------------------------------------------------------------

    async def match_debit(
        self,
        txn: BankTransaction,
        db: AsyncSession,
    ) -> MatchResult:
        """Debit = money out. Match against pending expenses."""

        # Strategy 1: UPI/reference number match on expenses
        if txn.reference_number:
            ref = txn.reference_number
            result = await db.execute(
                select(Expense).where(
                    or_(
                        Expense.upi_ref_number == ref,
                        Expense.netbanking_ref == ref,
                    ),
                    Expense.is_deleted == False,
                )
            )
            exp = result.scalar_one_or_none()
            if exp:
                return MatchResult(
                    transaction=txn,
                    matched_entity_type="expense",
                    matched_entity_id=exp.id,
                    matched_entity_ref=f"{exp.expense_category} — {exp.description or ''}".strip(" —"),
                    matched_amount_paise=exp.amount_paise,
                    confidence="HIGH",
                    match_reason="UPI/reference number exact match",
                    suggested_category=None,
                )

        # Strategy 2: exact amount on expenses within ±7 days
        date_from = txn.date - timedelta(days=7)
        date_to = txn.date + timedelta(days=1)

        result = await db.execute(
            select(Expense).where(
                Expense.amount_paise == txn.debit_paise,
                Expense.expense_date.between(date_from, date_to),
                Expense.approval_status == ApprovalStatus.PENDING,
                Expense.is_deleted == False,
            )
        )
        expenses = result.scalars().all()

        if expenses:
            exp = expenses[0]
            # If multiple, still HIGH only if unique
            conf_score = 90 if len(expenses) == 1 else 70
            conf = _calculate_confidence(conf_score)
            reason = "exact amount match within 7 days"
            if len(expenses) > 1:
                reason += f" ({len(expenses)} candidates)"

            alternatives: list[AlternativeMatch] = []
            for e in expenses[1:3]:
                alternatives.append(AlternativeMatch(
                    entity_type="expense",
                    entity_id=e.id,
                    entity_ref=f"{e.expense_category} — {e.description or ''}".strip(" —"),
                    amount_paise=e.amount_paise,
                    confidence=_calculate_confidence(70),
                    reason="amount + date range match",
                ))

            return MatchResult(
                transaction=txn,
                matched_entity_type="expense",
                matched_entity_id=exp.id,
                matched_entity_ref=f"{exp.expense_category} — {exp.description or ''}".strip(" —"),
                matched_amount_paise=exp.amount_paise,
                confidence=conf,
                match_reason=reason,
                suggested_category=None,
                alternative_matches=alternatives,
            )

        # Strategy 3: payee name in narration
        result = await db.execute(
            select(Expense).where(
                Expense.expense_date.between(date_from, date_to),
                Expense.payee_name.isnot(None),
                Expense.is_deleted == False,
            )
        )
        named_expenses = result.scalars().all()
        for exp in named_expenses:
            sim = _name_similarity(exp.payee_name or "", txn.description_normalized)
            if sim >= 0.6:
                return MatchResult(
                    transaction=txn,
                    matched_entity_type="expense",
                    matched_entity_id=exp.id,
                    matched_entity_ref=f"{exp.expense_category} — {exp.payee_name}",
                    matched_amount_paise=exp.amount_paise,
                    confidence="MEDIUM",
                    match_reason=f"payee name match ({sim:.0%}) in narration",
                    suggested_category=None,
                )

        # Strategy 4: category from narration keywords — no entity match
        suggested = _suggest_category(txn.description_normalized)
        return MatchResult(
            transaction=txn,
            matched_entity_type=None,
            matched_entity_id=None,
            matched_entity_ref=None,
            matched_amount_paise=None,
            confidence="NONE",
            match_reason="No matching expense found",
            suggested_category=suggested,
        )
