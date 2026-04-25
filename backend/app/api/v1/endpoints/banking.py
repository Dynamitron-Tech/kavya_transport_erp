# Banking Entries & CSV Reconciliation API Endpoints
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import date

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.banking import BankingEntryCreate, BankingEntryUpdate, CSVMatchRequest
from app.services import banking_entry_service, csv_parser_service
from app.services.notification_service import notification_service
from app.models.postgres.route import BankAccount

logger = logging.getLogger(__name__)

router = APIRouter()


# ━━━ Bank Accounts ━━━

@router.get("/accounts", response_model=APIResponse)
async def list_bank_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_READ)),
):
    """List active bank accounts for use in entry forms."""
    result = await db.execute(
        select(BankAccount).where(BankAccount.is_active == True, BankAccount.is_deleted == False)
        .order_by(BankAccount.is_default.desc(), BankAccount.id)
    )
    accounts = result.scalars().all()
    data = [
        {
            "id": a.id,
            "account_name": a.account_name,
            "bank_name": a.bank_name,
            "account_number": a.account_number,
            "account_type": a.account_type,
            "current_balance": float(a.current_balance or 0),
            "is_default": a.is_default,
        }
        for a in accounts
    ]
    return APIResponse(success=True, data=data)


# ━━━ Banking Entries ━━━

@router.post("/entries", response_model=APIResponse, status_code=201)
async def create_banking_entry(
    data: BankingEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_RECONCILE)),
):
    """Create a new banking entry (all 6 types)."""
    try:
        entry = await banking_entry_service.create_banking_entry(db, data.model_dump(), current_user.user_id)
        amount_fmt = f"₹{float(entry.amount_paise or 0) / 100:,.0f}"
        # Notify accountant for approval
        await notification_service.send(
            db, event_type="BANKING_ENTRY_NEEDS_APPROVAL",
            title="Banking entry needs approval",
            body=f"Entry {amount_fmt} – {entry.entry_type or ''} by user {current_user.user_id}",
            target_roles=["ACCOUNTANT"],
            data={"entry_id": str(entry.id), "route": "/accountant/banking"},
            urgency="urgent", triggered_by=current_user.user_id,
        )
        return APIResponse(
            success=True,
            data={"id": entry.id, "entry_no": entry.entry_no},
            message="Banking entry created",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create banking entry: {str(e)}")


@router.get("/entries", response_model=APIResponse)
async def list_banking_entries(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    account_id: Optional[int] = None,
    entry_type: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    reconciled: Optional[bool] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_READ)),
):
    """List banking entries with filters."""
    entries, total = await banking_entry_service.list_banking_entries(
        db, page, limit, account_id, entry_type, date_from, date_to, reconciled, search
    )
    pages = (total + limit - 1) // limit
    items = []
    for entry in entries:
        items.append(await banking_entry_service.get_entry_with_details(db, entry))
    return APIResponse(
        success=True,
        data=items,
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


@router.get("/entries/{entry_id}", response_model=APIResponse)
async def get_banking_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_READ)),
):
    """Get a single banking entry by ID."""
    entry = await banking_entry_service.get_banking_entry(db, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Banking entry not found")
    data = await banking_entry_service.get_entry_with_details(db, entry)
    return APIResponse(success=True, data=data)


@router.put("/entries/{entry_id}", response_model=APIResponse)
async def update_banking_entry(
    entry_id: int,
    data: BankingEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_RECONCILE)),
):
    """Update a banking entry (only if not reconciled)."""
    try:
        entry = await banking_entry_service.update_banking_entry(db, entry_id, data.model_dump(exclude_unset=True))
        if not entry:
            raise HTTPException(status_code=404, detail="Banking entry not found")
        return APIResponse(success=True, message="Banking entry updated")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/entries/{entry_id}", response_model=APIResponse)
async def delete_banking_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_RECONCILE)),
):
    """Delete a banking entry (admin-only, only if not reconciled)."""
    try:
        success = await banking_entry_service.delete_banking_entry(db, entry_id)
        if not success:
            raise HTTPException(status_code=404, detail="Banking entry not found")
        return APIResponse(success=True, message="Banking entry deleted")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ━━━ Balance ━━━

@router.get("/balance", response_model=APIResponse)
async def get_balance(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_READ)),
):
    """Get current balance per account + total."""
    summary = await banking_entry_service.get_balance_summary(db)
    return APIResponse(success=True, data=summary)


@router.get("/balance/history", response_model=APIResponse)
async def get_balance_history(
    account_id: Optional[int] = None,
    days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_READ)),
):
    """Get daily balance history for charts."""
    history = await banking_entry_service.get_balance_history(db, account_id, days)
    return APIResponse(success=True, data=history)


# ━━━ CSV Reconciliation ━━━

@router.post("/reconciliation/import", response_model=APIResponse, status_code=201)
async def import_csv(
    account_id: int = Query(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_IMPORT)),
):
    """Upload a bank CSV file, parse and return preview."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    csv_text = content.decode("utf-8", errors="replace")

    try:
        csv_import, preview = await csv_parser_service.import_csv_and_parse(
            db, account_id, csv_text, file.filename, current_user.user_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Trigger auto-match in background
    from app.tasks.banking_tasks import auto_match_csv
    auto_match_csv.delay(csv_import.id)

    return APIResponse(
        success=True,
        data={
            "import_id": csv_import.id,
            "filename": csv_import.filename,
            "row_count": csv_import.row_count,
            "preview_rows": preview,
        },
        message=f"Imported {csv_import.row_count} transactions. Auto-matching in progress.",
    )


@router.get("/reconciliation", response_model=APIResponse)
async def list_csv_transactions(
    import_id: int = Query(...),
    match_status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_READ)),
):
    """List imported CSV transactions with match status."""
    txns, total = await csv_parser_service.list_csv_transactions(db, import_id, match_status, page, limit)
    pages = (total + limit - 1) // limit
    items = [{
        "id": t.id,
        "import_id": t.import_id,
        "txn_date": t.txn_date.isoformat(),
        "description": t.description,
        "reference_no": t.reference_no,
        "debit_paise": t.debit_paise,
        "credit_paise": t.credit_paise,
        "balance_paise": t.balance_paise,
        "match_status": t.match_status,
        "matched_entry_id": t.matched_entry_id,
        "matched_invoice_id": t.matched_invoice_id,
    } for t in txns]
    return APIResponse(
        success=True, data=items,
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


@router.post("/reconciliation/match", response_model=APIResponse)
async def manual_match(
    data: CSVMatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_RECONCILE)),
):
    """Manually match a CSV transaction to an invoice or entry."""
    try:
        await csv_parser_service.manual_match_csv_transaction(
            db, data.csv_transaction_id, data.invoice_id, data.entry_id
        )
        return APIResponse(success=True, message="Transaction matched")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reconciliation/exceptions", response_model=APIResponse)
async def get_exceptions(
    import_id: int = Query(...),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_READ)),
):
    """Get unmatched exception queue for a CSV import."""
    txns, total = await csv_parser_service.get_reconciliation_exceptions(db, import_id, page, limit)
    pages = (total + limit - 1) // limit
    items = [{
        "id": t.id,
        "txn_date": t.txn_date.isoformat(),
        "description": t.description,
        "reference_no": t.reference_no,
        "debit_paise": t.debit_paise,
        "credit_paise": t.credit_paise,
        "balance_paise": t.balance_paise,
    } for t in txns]
    return APIResponse(
        success=True, data=items,
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


@router.post("/reconciliation/ignore", response_model=APIResponse)
async def ignore_csv_txn(
    csv_transaction_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_RECONCILE)),
):
    """Mark a CSV row as ignored."""
    try:
        await csv_parser_service.ignore_csv_transaction(db, csv_transaction_id)
        return APIResponse(success=True, message="Transaction ignored")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
