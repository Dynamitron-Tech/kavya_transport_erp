# Reconciliation Endpoints — bank statement upload, auto-match, review & confirm
# Routes: POST /reconciliation/upload, GET /reconciliation/sessions, etc.

from __future__ import annotations

import json
import logging
from dataclasses import asdict
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.db.postgres.connection import get_db
from app.middleware.permissions import Permissions, require_permission
from app.models.postgres.banking import BankingEntry, BankingEntryType
from app.models.postgres.expense import (
    ApprovalStatus,
    Expense,
    ExpenseCategory,
    PaymentMethod as ExpensePaymentMethod,
)
from app.models.postgres.finance import Invoice, InvoiceStatus
from app.models.postgres.reconciliation import ReconciliationLine, ReconciliationSession
from app.schemas.base import APIResponse, PaginationMeta
from app.services.bank_match_engine import BankMatchEngine, MatchResult
from app.services.bank_statement_parser import BankStatementParser
from app.services.banking_entry_service import create_banking_entry

logger = logging.getLogger(__name__)

router = APIRouter()

_parser = BankStatementParser()
_engine = BankMatchEngine()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _match_result_to_dict(mr: MatchResult) -> dict:
    return {
        "transaction": {
            "row_number": mr.transaction.row_number,
            "date": mr.transaction.date.isoformat(),
            "description": mr.transaction.description,
            "description_normalized": mr.transaction.description_normalized,
            "reference_number": mr.transaction.reference_number,
            "debit_paise": mr.transaction.debit_paise,
            "credit_paise": mr.transaction.credit_paise,
            "balance_paise": mr.transaction.balance_paise,
            "transaction_type": mr.transaction.transaction_type,
        },
        "matched_entity_type": mr.matched_entity_type,
        "matched_entity_id": mr.matched_entity_id,
        "matched_entity_ref": mr.matched_entity_ref,
        "matched_amount_paise": mr.matched_amount_paise,
        "confidence": mr.confidence,
        "match_reason": mr.match_reason,
        "suggested_category": mr.suggested_category,
        "alternative_matches": [
            {
                "entity_type": alt.entity_type,
                "entity_id": alt.entity_id,
                "entity_ref": alt.entity_ref,
                "amount_paise": alt.amount_paise,
                "confidence": alt.confidence,
                "reason": alt.reason,
            }
            for alt in mr.alternative_matches
        ],
    }


def _line_to_dict(line: ReconciliationLine) -> dict:
    alts = []
    try:
        if line.alternative_matches_json:
            alts = json.loads(line.alternative_matches_json)
    except Exception:
        pass
    return {
        "id": line.id,
        "row_number": line.row_number,
        "txn_date": line.txn_date.isoformat() if line.txn_date else None,
        "description": line.description,
        "reference_number": line.reference_number,
        "debit_paise": line.debit_paise or 0,
        "credit_paise": line.credit_paise or 0,
        "balance_paise": line.balance_paise,
        "transaction_type": line.transaction_type,
        "matched_entity_type": line.matched_entity_type,
        "matched_entity_id": line.matched_entity_id,
        "matched_entity_ref": line.matched_entity_ref,
        "matched_amount_paise": line.matched_amount_paise,
        "confidence": line.confidence,
        "match_reason": line.match_reason,
        "suggested_category": line.suggested_category,
        "alternative_matches": alts,
        "status": line.status,
        "action_taken": line.action_taken,
        "notes": line.notes,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /reconciliation/upload
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=APIResponse, status_code=201)
async def upload_bank_statement(
    file: UploadFile = File(...),
    bank_account_id: int = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_RECONCILE)),
):
    """Upload a bank statement CSV/XLSX and create a reconciliation session."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    content = await file.read()

    # Parse
    try:
        fname = file.filename.lower()
        if fname.endswith(".xlsx") or fname.endswith(".xls"):
            result = _parser.parse_excel(content)
        elif fname.endswith(".csv"):
            result = _parser.parse_csv(content.decode("utf-8", errors="replace"))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use .csv or .xlsx")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if not result.transactions:
        raise HTTPException(status_code=422, detail="No valid transactions found in file")

    # Create session record
    session = ReconciliationSession(
        bank_account_id=bank_account_id,
        statement_from=result.statement_from,
        statement_to=result.statement_to,
        source_file_name=file.filename,
        bank_name=result.bank_name,
        account_number_hint=result.account_number_hint,
        status="pending_review",
        total_transactions=len(result.transactions),
        total_credits_paise=result.total_credits_paise,
        total_debits_paise=result.total_debits_paise,
        opening_balance_paise=result.opening_balance_paise,
        closing_balance_paise=result.closing_balance_paise,
        created_by=current_user.user_id,
        parse_warnings_json=json.dumps(result.parse_warnings) if result.parse_warnings else None,
    )
    db.add(session)
    await db.flush()

    # Auto-match
    match_results: List[MatchResult] = await _engine.match_transactions(result.transactions, db)

    high_count = sum(1 for m in match_results if m.confidence == "HIGH")
    medium_count = sum(1 for m in match_results if m.confidence == "MEDIUM")
    unmatched_count = sum(1 for m in match_results if m.confidence == "NONE")

    session.high_confidence_count = high_count
    session.medium_confidence_count = medium_count
    session.unmatched_count = unmatched_count

    # Persist lines
    line_dicts = []
    for mr in match_results:
        line = ReconciliationLine(
            session_id=session.id,
            row_number=mr.transaction.row_number,
            txn_date=mr.transaction.date,
            description=mr.transaction.description,
            description_normalized=mr.transaction.description_normalized,
            reference_number=mr.transaction.reference_number,
            debit_paise=mr.transaction.debit_paise,
            credit_paise=mr.transaction.credit_paise,
            balance_paise=mr.transaction.balance_paise,
            transaction_type=mr.transaction.transaction_type,
            matched_entity_type=mr.matched_entity_type,
            matched_entity_id=mr.matched_entity_id,
            matched_entity_ref=mr.matched_entity_ref,
            matched_amount_paise=mr.matched_amount_paise,
            confidence=mr.confidence,
            match_reason=mr.match_reason,
            suggested_category=mr.suggested_category,
            alternative_matches_json=(
                json.dumps([
                    {
                        "entity_type": alt.entity_type,
                        "entity_id": alt.entity_id,
                        "entity_ref": alt.entity_ref,
                        "amount_paise": alt.amount_paise,
                        "confidence": alt.confidence,
                        "reason": alt.reason,
                    }
                    for alt in mr.alternative_matches
                ]) if mr.alternative_matches else None
            ),
            status="pending",
        )
        db.add(line)
        line_dicts.append(_match_result_to_dict(mr))

    await db.commit()

    return APIResponse(
        success=True,
        data={
            "session_id": session.id,
            "bank_name": result.bank_name,
            "total_transactions": len(result.transactions),
            "auto_matched_high": high_count,
            "auto_matched_medium": medium_count,
            "unmatched": unmatched_count,
            "statement_from": result.statement_from.isoformat() if result.statement_from else None,
            "statement_to": result.statement_to.isoformat() if result.statement_to else None,
            "parse_warnings": result.parse_warnings,
            "transactions": line_dicts,
        },
        message=f"Uploaded {len(result.transactions)} transactions — {high_count} high confidence matches",
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /reconciliation/sessions
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/sessions", response_model=APIResponse)
async def list_sessions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_READ)),
):
    """List all reconciliation sessions."""
    offset = (page - 1) * limit
    total_r = await db.execute(
        select(func.count(ReconciliationSession.id))
    )
    total = total_r.scalar() or 0

    result = await db.execute(
        select(ReconciliationSession)
        .order_by(ReconciliationSession.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    sessions = result.scalars().all()

    return APIResponse(
        success=True,
        data=[
            {
                "id": s.id,
                "bank_name": s.bank_name,
                "bank_account_id": s.bank_account_id,
                "source_file_name": s.source_file_name,
                "statement_from": s.statement_from.isoformat() if s.statement_from else None,
                "statement_to": s.statement_to.isoformat() if s.statement_to else None,
                "status": s.status,
                "total_transactions": s.total_transactions,
                "confirmed_count": s.confirmed_count,
                "skipped_count": s.skipped_count,
                "unmatched_count": s.unmatched_count,
                "high_confidence_count": s.high_confidence_count,
                "medium_confidence_count": s.medium_confidence_count,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in sessions
        ],
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=(total + limit - 1) // limit),
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /reconciliation/sessions/{session_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/sessions/{session_id}", response_model=APIResponse)
async def get_session(
    session_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    confidence: Optional[str] = Query(None),  # HIGH, MEDIUM, LOW, NONE
    status: Optional[str] = Query(None),       # pending, confirmed, skipped
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_READ)),
):
    """Get full session detail with paginated line items."""
    session = await db.get(ReconciliationSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Build line query with optional filters
    q = select(ReconciliationLine).where(ReconciliationLine.session_id == session_id)
    if confidence:
        q = q.where(ReconciliationLine.confidence == confidence.upper())
    if status:
        q = q.where(ReconciliationLine.status == status.lower())
    q = q.order_by(ReconciliationLine.row_number)

    total_r = await db.execute(
        select(func.count(ReconciliationLine.id)).where(ReconciliationLine.session_id == session_id)
    )
    total = total_r.scalar() or 0

    q = q.offset((page - 1) * limit).limit(limit)
    lines_r = await db.execute(q)
    lines = lines_r.scalars().all()

    return APIResponse(
        success=True,
        data={
            "session": {
                "id": session.id,
                "bank_name": session.bank_name,
                "bank_account_id": session.bank_account_id,
                "source_file_name": session.source_file_name,
                "statement_from": session.statement_from.isoformat() if session.statement_from else None,
                "statement_to": session.statement_to.isoformat() if session.statement_to else None,
                "status": session.status,
                "total_transactions": session.total_transactions,
                "confirmed_count": session.confirmed_count,
                "skipped_count": session.skipped_count,
                "unmatched_count": session.unmatched_count,
                "high_confidence_count": session.high_confidence_count,
                "medium_confidence_count": session.medium_confidence_count,
                "opening_balance_paise": session.opening_balance_paise,
                "closing_balance_paise": session.closing_balance_paise,
                "created_at": session.created_at.isoformat() if session.created_at else None,
            },
            "lines": [_line_to_dict(ln) for ln in lines],
        },
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=(total + limit - 1) // limit),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic bodies for confirm endpoints
# ─────────────────────────────────────────────────────────────────────────────

class ConfirmationItem(BaseModel):
    transaction_row: int
    action: str                            # confirm_match | create_expense | skip | manual_entry
    entity_id: Optional[int] = None        # invoice or expense id if confirm_match
    entity_type: Optional[str] = None      # "invoice" | "expense"
    expense_category: Optional[str] = None
    notes: Optional[str] = None


class ConfirmBulkBody(BaseModel):
    confirmations: List[ConfirmationItem]


# ─────────────────────────────────────────────────────────────────────────────
# POST /reconciliation/sessions/{session_id}/confirm
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/confirm", response_model=APIResponse)
async def confirm_lines(
    session_id: int,
    body: ConfirmBulkBody,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_RECONCILE)),
):
    """Confirm, skip, or create expense for a list of reconciliation lines."""
    session = await db.get(ReconciliationSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    confirmed_count = 0
    created_count = 0
    skipped_count = 0
    now = datetime.utcnow()

    for item in body.confirmations:
        line_r = await db.execute(
            select(ReconciliationLine).where(
                ReconciliationLine.session_id == session_id,
                ReconciliationLine.row_number == item.transaction_row,
            )
        )
        line = line_r.scalar_one_or_none()
        if not line:
            continue

        if item.action == "skip":
            line.status = "skipped"
            line.action_taken = "skip"
            line.confirmed_by = current_user.user_id
            line.confirmed_at = now
            skipped_count += 1

        elif item.action == "confirm_match":
            effective_entity_id = item.entity_id or line.matched_entity_id
            effective_entity_type = item.entity_type or line.matched_entity_type

            if effective_entity_type == "invoice" and effective_entity_id:
                # Mark invoice as paid
                inv = await db.get(Invoice, effective_entity_id)
                if inv:
                    inv.status = InvoiceStatus.PAID
                    inv.amount_paid = inv.total_amount
                    inv.amount_due = 0
                    inv.paid_at = now
                    # Create BankingEntry
                    entry_data = {
                        "account_id": session.bank_account_id,
                        "entry_date": line.txn_date,
                        "entry_type": BankingEntryType.PAYMENT_RECEIVED.value,
                        "amount_paise": line.credit_paise,
                        "reference_no": line.reference_number,
                        "invoice_id": effective_entity_id,
                        "client_id": inv.client_id,
                        "description": line.description,
                        "reconciled": True,
                    }
                    try:
                        entry = await create_banking_entry(db, entry_data, current_user.user_id)
                        line.created_banking_entry_id = entry.id
                    except Exception as exc:
                        logger.warning("Failed to create banking entry for line %s: %s", line.id, exc)

            elif effective_entity_type == "expense" and effective_entity_id:
                exp = await db.get(Expense, effective_entity_id)
                if exp:
                    exp.approval_status = ApprovalStatus.approved
                    exp.approved_by = current_user.user_id
                    exp.approved_at = now

            line.status = "confirmed"
            line.action_taken = "confirm_match"
            line.override_entity_id = item.entity_id  # track if overridden
            line.notes = item.notes
            line.confirmed_by = current_user.user_id
            line.confirmed_at = now
            confirmed_count += 1

        elif item.action == "create_expense":
            cat_str = item.expense_category or line.suggested_category or "misc_field"
            try:
                cat = ExpenseCategory(cat_str)
            except ValueError:
                cat = ExpenseCategory.MISC_FIELD

            expense = Expense(
                expense_category=cat,
                payment_method=ExpensePaymentMethod.NETBANKING,
                amount_paise=line.debit_paise,
                description=line.notes or line.description,
                expense_date=line.txn_date,
                netbanking_ref=line.reference_number,
                approval_status=ApprovalStatus.approved,
                approved_by=current_user.user_id,
                approved_at=now,
                created_by=current_user.user_id,
            )
            db.add(expense)
            await db.flush()
            line.created_expense_id = expense.id
            line.expense_category = cat_str
            line.status = "confirmed"
            line.action_taken = "create_expense"
            line.notes = item.notes
            line.confirmed_by = current_user.user_id
            line.confirmed_at = now
            created_count += 1

        elif item.action == "manual_entry":
            # Raw banking entry with no linked entity
            entry_type = (
                BankingEntryType.PAYMENT_RECEIVED.value
                if line.transaction_type == "credit"
                else BankingEntryType.PAYMENT_MADE.value
            )
            entry_data = {
                "account_id": session.bank_account_id,
                "entry_date": line.txn_date,
                "entry_type": entry_type,
                "amount_paise": line.credit_paise or line.debit_paise,
                "reference_no": line.reference_number,
                "description": line.description,
            }
            try:
                entry = await create_banking_entry(db, entry_data, current_user.user_id)
                line.created_banking_entry_id = entry.id
            except Exception as exc:
                logger.warning("manual_entry banking entry failed: %s", exc)
            line.status = "confirmed"
            line.action_taken = "manual_entry"
            line.notes = item.notes
            line.confirmed_by = current_user.user_id
            line.confirmed_at = now
            confirmed_count += 1

    # Refresh session counts
    confirmed_r = await db.execute(
        select(func.count(ReconciliationLine.id)).where(
            ReconciliationLine.session_id == session_id,
            ReconciliationLine.status == "confirmed",
        )
    )
    skipped_r = await db.execute(
        select(func.count(ReconciliationLine.id)).where(
            ReconciliationLine.session_id == session_id,
            ReconciliationLine.status == "skipped",
        )
    )
    session.confirmed_count = confirmed_r.scalar() or 0
    session.skipped_count = skipped_r.scalar() or 0

    pending_r = await db.execute(
        select(func.count(ReconciliationLine.id)).where(
            ReconciliationLine.session_id == session_id,
            ReconciliationLine.status == "pending",
        )
    )
    pending = pending_r.scalar() or 0
    if pending == 0:
        session.status = "completed"
        session.completed_at = now

    await db.commit()

    return APIResponse(
        success=True,
        data={"confirmed": confirmed_count, "created": created_count, "skipped": skipped_count},
        message=f"{confirmed_count} confirmed, {created_count} expenses created, {skipped_count} skipped",
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST /reconciliation/sessions/{session_id}/confirm-all-high
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/confirm-all-high", response_model=APIResponse)
async def confirm_all_high(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_RECONCILE)),
):
    """Bulk confirm all HIGH confidence matches in one click."""
    session = await db.get(ReconciliationSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    high_lines_r = await db.execute(
        select(ReconciliationLine).where(
            ReconciliationLine.session_id == session_id,
            ReconciliationLine.confidence == "HIGH",
            ReconciliationLine.status == "pending",
        )
    )
    high_lines = high_lines_r.scalars().all()

    confirmations = [
        ConfirmationItem(
            transaction_row=ln.row_number,
            action="confirm_match",
        )
        for ln in high_lines
    ]

    if not confirmations:
        return APIResponse(success=True, data={"confirmed": 0}, message="No HIGH confidence pending lines")

    # Re-use confirm logic
    return await confirm_lines(
        session_id=session_id,
        body=ConfirmBulkBody(confirmations=confirmations),
        db=db,
        current_user=current_user,
    )
