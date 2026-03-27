# Accountant Module Endpoints
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Any
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select, func

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.services import dashboard_service, finance_service
from app.models.postgres.trip import TripExpense, ExpenseCategory
from app.models.postgres.finance import (
    Invoice, InvoiceStatus, Payment, Ledger, LedgerType, GSTEntry, Payable,
)

router = APIRouter()


def _role_set(user: TokenData) -> set[str]:
    return {str(r).lower() for r in (user.roles or [])}


def _is_admin_or_accountant(user: TokenData) -> bool:
    roles = _role_set(user)
    return "admin" in roles or "accountant" in roles


def _expense_category_value(expense: TripExpense) -> str:
    raw = getattr(expense, "category", None)
    return str(getattr(raw, "value", raw) or "").lower()


@router.get("/dashboard", response_model=APIResponse)
async def accountant_dashboard(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    data = await dashboard_service.get_accountant_dashboard(db)
    return APIResponse(success=True, data=data)


@router.get("/invoices", response_model=APIResponse)
async def accountant_invoices(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=500),
    search: Optional[str] = None, status: Optional[str] = None,
    client_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    invoices, total = await finance_service.list_invoices(db, page, limit, search, status, client_id)
    pages = (total + limit - 1) // limit
    items = []
    for inv in invoices:
        items.append(await finance_service.get_invoice_with_details(db, inv))
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/payments", response_model=APIResponse)
async def accountant_payments(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=500),
    payment_type: Optional[str] = None, client_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    payments, total = await finance_service.list_payments(db, page, limit, payment_type, client_id)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(p, c.key) for c in p.__table__.columns} for p in payments]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/ledger", response_model=APIResponse)
async def accountant_ledger(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=500),
    ledger_type: Optional[str] = None, client_id: Optional[int] = None,
    date_from: Optional[date] = None, date_to: Optional[date] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.LEDGER_READ)),
):
    entries, total = await finance_service.list_ledger(db, page, limit, ledger_type, client_id, date_from, date_to)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(e, c.key) for c in e.__table__.columns} for e in entries]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/receivables", response_model=APIResponse)
async def accountant_receivables(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    from sqlalchemy import select, func, case, and_
    from app.models.postgres.finance import Invoice, InvoiceStatus
    from app.models.postgres.client import Client

    today = date.today()

    # Return per-invoice rows so the Flutter Pay button can pass invoice_id
    # to POST /receivables/record-payment
    result = await db.execute(
        select(
            Invoice.id,
            Invoice.invoice_number,
            Invoice.client_id,
            Client.name.label("client_name"),
            Invoice.amount_due,
            Invoice.due_date,
        )
        .join(Client, Client.id == Invoice.client_id)
        .where(
            Invoice.is_deleted == False,
            Invoice.amount_due > 0,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
        .order_by(Invoice.due_date.asc())
    )
    items = []
    for r in result.all():
        due_date = r[5]
        aging_days = max(0, (today - due_date).days) if due_date else 0
        is_overdue = (due_date < today) if due_date else False
        items.append({
            "id": r[0],
            "invoice_number": r[1],
            "client_id": r[2],
            "client_name": r[3],
            "amount_due": float(r[4]),
            "due_date": due_date.isoformat() if due_date else None,
            "is_overdue": is_overdue,
            "aging_days": aging_days,
        })
    return APIResponse(success=True, data=items)


@router.get("/expenses", response_model=APIResponse)
async def accountant_expenses(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=500),
    verified: Optional[bool] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EXPENSE_READ)),
):
    from sqlalchemy import select, func
    from app.models.postgres.trip import TripExpense, ExpenseStatusEnum

    query = select(TripExpense)
    count_query = select(func.count(TripExpense.id))

    if verified is not None:
        query = query.where(TripExpense.is_verified == verified)
        count_query = count_query.where(TripExpense.is_verified == verified)

    if status:
        try:
            status_enum = ExpenseStatusEnum(status.upper())
            query = query.where(TripExpense.expense_status == status_enum)
            count_query = count_query.where(TripExpense.expense_status == status_enum)
        except (ValueError, KeyError):
            pass

    total = (await db.execute(count_query)).scalar() or 0
    pages = (total + limit - 1) // limit
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(TripExpense.expense_date.desc()))
    expenses = result.scalars().all()
    items = [{
        **{c.key: getattr(e, c.key) for c in e.__table__.columns},
        'status': (e.expense_status.value.lower() if hasattr(e.expense_status, 'value') else str(e.expense_status or 'pending').lower()),
    } for e in expenses]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.put("/expenses/{expense_id}", response_model=APIResponse)
async def accountant_update_expense(
    expense_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EXPENSE_UPDATE)),
):
    expense = await db.get(TripExpense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    roles = _role_set(current_user)
    is_finance_owner = _is_admin_or_accountant(current_user)
    category = _expense_category_value(expense)

    if expense.is_verified and not is_finance_owner:
        raise HTTPException(status_code=403, detail="Finalized expenses cannot be edited")

    if "fleet_manager" in roles:
        if category not in {"fuel", "repair", "vehicle_maintenance"}:
            raise HTTPException(status_code=403, detail="Fleet manager can only edit fuel/maintenance expenses")

    allowed_fields = {"amount", "description", "payment_mode", "reference_number", "receipt_url", "verification_remarks", "expense_date", "category", "sub_category", "location"}
    updates = {k: v for k, v in (payload or {}).items() if k in allowed_fields}

    if "category" in updates and updates["category"] is not None:
        updates["category"] = ExpenseCategory(str(updates["category"]).lower())
    if "expense_date" in updates and updates["expense_date"]:
        if isinstance(updates["expense_date"], str):
            updates["expense_date"] = datetime.fromisoformat(updates["expense_date"].replace("Z", "+00:00")).replace(tzinfo=None)

    for key, value in updates.items():
        setattr(expense, key, value)

    await db.commit()
    return APIResponse(success=True, message="Expense updated")


@router.delete("/expenses/{expense_id}", response_model=APIResponse)
async def accountant_delete_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EXPENSE_DELETE)),
):
    expense = await db.get(TripExpense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    roles = _role_set(current_user)
    is_finance_owner = _is_admin_or_accountant(current_user)

    if expense.is_verified and not is_finance_owner:
        raise HTTPException(status_code=403, detail="Approved expenses cannot be deleted")
    if "fleet_manager" in roles and not is_finance_owner:
        raise HTTPException(status_code=403, detail="Fleet manager cannot delete expenses")

    await db.delete(expense)
    await db.commit()
    return APIResponse(success=True, message="Expense deleted")


@router.put("/expenses/{expense_id}/approve", response_model=APIResponse)
async def accountant_approve_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EXPENSE_APPROVE)),
):
    if not _is_admin_or_accountant(current_user):
        raise HTTPException(status_code=403, detail="Only accountant/admin can approve expenses")

    expense = await db.get(TripExpense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    from app.models.postgres.trip import ExpenseStatusEnum
    expense.is_verified = True
    expense.verified_by = current_user.user_id
    expense.verified_at = datetime.utcnow()
    expense.expense_status = ExpenseStatusEnum.APPROVED
    await finance_service.post_expense_approval_entries(db, expense, current_user.user_id)

    # Create a PENDING payment record so it appears in accountant's driver-payments queue
    import random, string
    suffix = ''.join(random.choices(string.digits, k=6))
    from app.models.postgres.finance import PaymentMethod, PaymentStatus
    pending_pay = Payment(
        payment_number=f"EXP-{suffix}",
        payment_date=date.today(),
        payment_type="paid",
        trip_id=expense.trip_id,
        driver_id=expense.entered_by,  # driver who submitted
        source_ref=f"expense:{expense.id}",
        amount=expense.amount,
        net_amount=expense.amount,
        currency="INR",
        payment_method=PaymentMethod.CASH,
        status=PaymentStatus.PENDING,
        remarks=f"Expense reimbursement: {_expense_category_value(expense)} — {expense.description or ''}",
        tenant_id=getattr(expense, 'tenant_id', None),
        created_by=current_user.user_id,
    )
    db.add(pending_pay)

    await db.commit()
    return APIResponse(success=True, message="Expense approved")


@router.put("/expenses/{expense_id}/reject", response_model=APIResponse)
async def accountant_reject_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EXPENSE_APPROVE)),
):
    if not _is_admin_or_accountant(current_user):
        raise HTTPException(status_code=403, detail="Only accountant/admin can reject expenses")

    expense = await db.get(TripExpense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    from app.models.postgres.trip import ExpenseStatusEnum
    expense.is_verified = False
    expense.verified_by = current_user.user_id
    expense.verified_at = datetime.utcnow()
    expense.verification_remarks = "Rejected"
    expense.expense_status = ExpenseStatusEnum.REJECTED
    await db.commit()
    return APIResponse(success=True, message="Expense rejected")


@router.put("/expenses/{expense_id}/mark-paid", response_model=APIResponse)
async def accountant_mark_expense_paid(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EXPENSE_APPROVE)),
):
    if not _is_admin_or_accountant(current_user):
        raise HTTPException(status_code=403, detail="Only accountant/admin can mark expenses as paid")

    expense = await db.get(TripExpense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    from app.models.postgres.trip import ExpenseStatusEnum
    if expense.expense_status != ExpenseStatusEnum.APPROVED:
        raise HTTPException(status_code=400, detail="Only approved expenses can be marked as paid")

    expense.paid_by = current_user.user_id
    expense.paid_at = datetime.utcnow()
    expense.expense_status = ExpenseStatusEnum.PAID
    await db.commit()
    return APIResponse(success=True, message="Expense marked as paid")


@router.get("/banking", response_model=APIResponse)
async def accountant_banking(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission([Permissions.PAYMENT_READ, Permissions.LEDGER_READ])),
):
    accounts = await finance_service.list_bank_accounts(db)
    items = [{c.key: getattr(a, c.key) for c in a.__table__.columns} for a in accounts]
    return APIResponse(success=True, data=items)


# ==================== INVOICE CRUD ====================

@router.post("/invoices", response_model=APIResponse)
async def create_invoice(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    invoice = await finance_service.create_invoice(db, data, user_id=current_user.user_id)
    await db.commit()
    result = await finance_service.get_invoice_with_details(db, invoice)
    return APIResponse(success=True, data=result, message="Invoice created")


@router.put("/invoices/{invoice_id}", response_model=APIResponse)
async def update_invoice(
    invoice_id: int,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    invoice = await finance_service.update_invoice(db, invoice_id, data)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    await db.commit()
    result = await finance_service.get_invoice_with_details(db, invoice)
    return APIResponse(success=True, data=result, message="Invoice updated")


@router.delete("/invoices/{invoice_id}", response_model=APIResponse)
async def delete_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    deleted = await finance_service.delete_invoice(db, invoice_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Invoice not found")
    await db.commit()
    return APIResponse(success=True, message="Invoice deleted")


# ==================== RECORD PAYMENT ====================

@router.post("/payments", response_model=APIResponse)
async def record_payment(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    payment = await finance_service.create_payment(db, data, user_id=current_user.user_id)
    await db.commit()
    row = {c.key: getattr(payment, c.key) for c in payment.__table__.columns}
    return APIResponse(success=True, data=row, message="Payment recorded")


# ==================== PAYABLES ====================

@router.get("/payables", response_model=APIResponse)
async def accountant_payables(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.LEDGER_READ)),
):
    from app.models.postgres.finance import Vendor
    today = date.today()
    result = await db.execute(
        select(
            Vendor.id, Vendor.name, Vendor.code, Vendor.vendor_type,
            func.sum(Payable.total_outstanding).label("total_outstanding"),
            func.sum(Payable.current).label("current"),
            func.sum(Payable.days_30_60).label("days_30_60"),
            func.sum(Payable.days_60_90).label("days_60_90"),
            func.sum(Payable.days_90_plus).label("days_90_plus"),
        )
        .join(Payable, Payable.vendor_id == Vendor.id)
        .where(Vendor.is_deleted == False, Payable.total_outstanding > 0)
        .group_by(Vendor.id, Vendor.name, Vendor.code, Vendor.vendor_type)
        .order_by(func.sum(Payable.total_outstanding).desc())
    )
    items = []
    for r in result.all():
        items.append({
            "vendor_id": r[0], "vendor_name": r[1], "vendor_code": r[2],
            "vendor_type": r[3],
            "total_outstanding": float(r[4] or 0),
            "current": float(r[5] or 0),
            "days_30_60": float(r[6] or 0),
            "days_60_90": float(r[7] or 0),
            "days_90_plus": float(r[8] or 0),
        })
    return APIResponse(success=True, data=items)


# ==================== GST ENTRIES ====================

@router.get("/gst", response_model=APIResponse)
async def accountant_gst(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    financial_year: Optional[str] = None,
    tax_period: Optional[str] = None,
    gstr_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.LEDGER_READ)),
):
    query = select(GSTEntry)
    count_query = select(func.count(GSTEntry.id))
    if financial_year:
        query = query.where(GSTEntry.financial_year == financial_year)
        count_query = count_query.where(GSTEntry.financial_year == financial_year)
    if tax_period:
        query = query.where(GSTEntry.tax_period == tax_period)
        count_query = count_query.where(GSTEntry.tax_period == tax_period)
    if gstr_type:
        query = query.where(GSTEntry.gstr_return_type == gstr_type)
        count_query = count_query.where(GSTEntry.gstr_return_type == gstr_type)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(GSTEntry.id.desc()))
    entries = result.scalars().all()
    items = [{c.key: getattr(e, c.key) for c in e.__table__.columns} for e in entries]

    # GST summary aggregation for current page
    summary_q = await db.execute(
        select(
            func.sum(GSTEntry.taxable_value).label("total_taxable"),
            func.sum(GSTEntry.cgst_amount).label("total_cgst"),
            func.sum(GSTEntry.sgst_amount).label("total_sgst"),
            func.sum(GSTEntry.igst_amount).label("total_igst"),
            func.sum(GSTEntry.total_value).label("total_value"),
        )
        .where(GSTEntry.financial_year == financial_year) if financial_year else
        select(
            func.sum(GSTEntry.taxable_value).label("total_taxable"),
            func.sum(GSTEntry.cgst_amount).label("total_cgst"),
            func.sum(GSTEntry.sgst_amount).label("total_sgst"),
            func.sum(GSTEntry.igst_amount).label("total_igst"),
            func.sum(GSTEntry.total_value).label("total_value"),
        )
    )
    s = summary_q.one()
    summary = {
        "total_taxable": float(s[0] or 0),
        "total_cgst": float(s[1] or 0),
        "total_sgst": float(s[2] or 0),
        "total_igst": float(s[3] or 0),
        "total_gst": float((s[1] or 0) + (s[2] or 0) + (s[3] or 0)),
        "total_value": float(s[4] or 0),
    }

    return APIResponse(
        success=True,
        data={"entries": items, "summary": summary},
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=(total + limit - 1) // limit),
    )


# ==================== LEDGER ENTRY (manual) ====================

@router.post("/ledger", response_model=APIResponse)
async def create_ledger_entry(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.LEDGER_READ)),
):
    entry = await finance_service.create_ledger_entry(db, data, user_id=current_user.user_id)
    await db.commit()
    row = {c.key: getattr(entry, c.key) for c in entry.__table__.columns}
    return APIResponse(success=True, data=row, message="Ledger entry created")


# ==================== VOUCHERS ====================
# Vouchers = payments with voucher_type classification
# Payment Voucher: payment_type="paid"  Receipt Voucher: payment_type="received"
# Journal Voucher: ledger entries with reference_type="journal"

@router.get("/vouchers", response_model=APIResponse)
async def list_vouchers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    voucher_type: Optional[str] = None,  # "payment", "receipt", "journal", "contra"
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    # Payments as vouchers
    pay_query = select(Payment).where(Payment.is_deleted == False)
    pay_count = select(func.count(Payment.id)).where(Payment.is_deleted == False)

    if voucher_type == "payment":
        pay_query = pay_query.where(Payment.payment_type == "paid")
        pay_count = pay_count.where(Payment.payment_type == "paid")
    elif voucher_type == "receipt":
        pay_query = pay_query.where(Payment.payment_type == "received")
        pay_count = pay_count.where(Payment.payment_type == "received")
    elif voucher_type == "journal":
        # Return journal ledger entries instead
        j_query = select(Ledger).where(Ledger.reference_type == "journal")
        j_count = select(func.count(Ledger.id)).where(Ledger.reference_type == "journal")
        if date_from:
            j_query = j_query.where(Ledger.entry_date >= date_from)
        if date_to:
            j_query = j_query.where(Ledger.entry_date <= date_to)
        total = (await db.execute(j_count)).scalar() or 0
        offset = (page - 1) * limit
        result = await db.execute(j_query.offset(offset).limit(limit).order_by(Ledger.id.desc()))
        entries = result.scalars().all()
        items = [{"voucher_type": "journal", **{c.key: getattr(e, c.key) for c in e.__table__.columns}} for e in entries]
        return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=(total + limit - 1) // limit))

    if date_from:
        pay_query = pay_query.where(Payment.payment_date >= date_from)
        pay_count = pay_count.where(Payment.payment_date >= date_from)
    if date_to:
        pay_query = pay_query.where(Payment.payment_date <= date_to)
        pay_count = pay_count.where(Payment.payment_date <= date_to)

    total = (await db.execute(pay_count)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(pay_query.offset(offset).limit(limit).order_by(Payment.id.desc()))
    payments = result.scalars().all()
    items = []
    for p in payments:
        vtype = "receipt" if p.payment_type == "received" else "payment"
        items.append({"voucher_type": vtype, **{c.key: getattr(p, c.key) for c in p.__table__.columns}})
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=(total + limit - 1) // limit))


@router.post("/vouchers", response_model=APIResponse)
async def create_voucher(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    voucher_type = data.pop("voucher_type", "receipt")
    if voucher_type == "journal":
        data["reference_type"] = "journal"
        # Strip Payment-only fields not needed for ledger entries
        for key in ["payment_type", "payment_method", "transaction_ref"]:
            data.pop(key, None)
        entry = await finance_service.create_ledger_entry(db, data, user_id=current_user.user_id)
        await db.commit()
        row = {c.key: getattr(entry, c.key) for c in entry.__table__.columns}
        return APIResponse(success=True, data={"voucher_type": "journal", **row}, message="Journal voucher created")
    else:
        data["payment_type"] = "received" if voucher_type == "receipt" else "paid"
        # Strip ledger-only fields not valid on the Payment model
        for key in ["account_name", "narration", "debit", "credit", "entry_date"]:
            data.pop(key, None)
        payment = await finance_service.create_payment(db, data, user_id=current_user.user_id)
        await db.commit()
        row = {c.key: getattr(payment, c.key) for c in payment.__table__.columns}
        return APIResponse(success=True, data={"voucher_type": voucher_type, **row}, message="Voucher created")


# ==================== FINANCIAL STATEMENTS (P&L) ====================

@router.get("/statements", response_model=APIResponse)
async def financial_statements(
    period: Optional[str] = Query("monthly", description="monthly | quarterly | yearly"),
    financial_year: Optional[str] = Query(None, description="e.g. 2025-26"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.LEDGER_READ)),
):
    today = date.today()
    
    # Determine date range
    if financial_year:
        fy_start_year = int(financial_year.split("-")[0])
        start_date = date(fy_start_year, 4, 1)
        end_date = date(fy_start_year + 1, 3, 31)
    elif period == "monthly":
        start_date = today.replace(day=1)
        end_date = today
    elif period == "quarterly":
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        start_date = today.replace(month=quarter_month, day=1)
        end_date = today
    else:  # yearly
        start_date = date(today.year, 4, 1) if today.month >= 4 else date(today.year - 1, 4, 1)
        end_date = today

    # Revenue: sum of paid/partially_paid invoices in period
    rev_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.amount_paid), 0))
        .where(
            Invoice.is_deleted == False,
            Invoice.invoice_date >= start_date,
            Invoice.invoice_date <= end_date,
            Invoice.status.in_([InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID]),
        )
    )
    total_revenue = float(rev_result.scalar() or 0)

    # Outstanding (unpaid invoices)
    out_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.amount_due), 0))
        .where(
            Invoice.is_deleted == False,
            Invoice.due_date <= end_date,
            Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID]),
        )
    )
    total_outstanding = float(out_result.scalar() or 0)

    # Expenses: sum from ledger payable entries in period
    exp_result = await db.execute(
        select(func.coalesce(func.sum(Ledger.credit), 0))
        .where(
            Ledger.ledger_type == LedgerType.PAYABLE,
            Ledger.entry_date >= start_date,
            Ledger.entry_date <= end_date,
        )
    )
    total_expenses = float(exp_result.scalar() or 0)

    # GST collected (output)
    gst_out_result = await db.execute(
        select(
            func.coalesce(func.sum(GSTEntry.cgst_amount + GSTEntry.sgst_amount + GSTEntry.igst_amount), 0)
        ).where(
            GSTEntry.transaction_type == "outward",
            GSTEntry.invoice_date >= start_date,
            GSTEntry.invoice_date <= end_date,
        )
    )
    gst_collected = float(gst_out_result.scalar() or 0)

    # GST paid (input)
    gst_in_result = await db.execute(
        select(
            func.coalesce(func.sum(GSTEntry.cgst_amount + GSTEntry.sgst_amount + GSTEntry.igst_amount), 0)
        ).where(
            GSTEntry.transaction_type == "inward",
            GSTEntry.invoice_date >= start_date,
            GSTEntry.invoice_date <= end_date,
        )
    )
    gst_paid = float(gst_in_result.scalar() or 0)

    net_profit = total_revenue - total_expenses
    gst_payable = gst_collected - gst_paid

    return APIResponse(success=True, data={
        "period": period,
        "start_date": str(start_date),
        "end_date": str(end_date),
        "income_statement": {
            "total_revenue": total_revenue,
            "total_expenses": total_expenses,
            "gross_profit": total_revenue - total_expenses,
            "net_profit": net_profit,
        },
        "outstanding": {
            "total_receivables": total_outstanding,
        },
        "tax_summary": {
            "gst_collected": gst_collected,
            "gst_paid": gst_paid,
            "gst_payable": gst_payable,
        },
    })


# ==================== DRIVER PAYMENTS (pending + history) ====================

@router.get("/driver-payments", response_model=APIResponse)
async def accountant_driver_payments(
    status_filter: Optional[str] = Query(None, description="pending | completed | all"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    """Return driver-related Payment records (trip pay + expense reimbursements)."""
    from app.models.postgres.finance import PaymentStatus

    q = (
        select(Payment)
        .where(
            Payment.is_deleted == False,
            Payment.source_ref.isnot(None),
            Payment.payment_type == "paid",
        )
        .order_by(Payment.id.desc())
    )
    if status_filter == "pending":
        q = q.where(Payment.status == PaymentStatus.PENDING)
    elif status_filter == "completed":
        q = q.where(Payment.status == PaymentStatus.COMPLETED)

    result = await db.execute(q)
    payments = result.scalars().all()

    items = []
    for p in payments:
        row = {c.key: getattr(p, c.key) for c in p.__table__.columns}
        # Stringify enums
        row["status"] = p.status.value if hasattr(p.status, "value") else str(p.status)
        row["payment_method"] = p.payment_method.value if hasattr(p.payment_method, "value") else str(p.payment_method)
        row["amount"] = float(p.amount or 0)
        row["net_amount"] = float(p.net_amount or p.amount or 0)
        # Determine payment kind from source_ref
        if p.source_ref and p.source_ref.startswith("trip_pay:"):
            row["kind"] = "trip_pay"
            row["kind_label"] = "Trip Payment"
        elif p.source_ref and p.source_ref.startswith("expense:"):
            row["kind"] = "expense_reimburse"
            row["kind_label"] = "Expense Reimbursement"
        else:
            row["kind"] = "other"
            row["kind_label"] = "Other"
        items.append(row)

    pending = [i for i in items if i["status"] == "PENDING"]
    completed = [i for i in items if i["status"] == "COMPLETED"]
    return APIResponse(success=True, data={
        "pending": pending,
        "history": completed,
        "total_pending": sum(i["amount"] for i in pending),
        "total_paid": sum(i["amount"] for i in completed),
    })


@router.post("/driver-payments/{payment_id}/mark-paid", response_model=APIResponse)
async def accountant_mark_driver_payment_paid(
    payment_id: int,
    data: dict = Body(default={}),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    """Mark a pending driver payment as completed (manual or after Razorpay confirmation)."""
    if not _is_admin_or_accountant(current_user):
        raise HTTPException(status_code=403, detail="Only accountant/admin can mark payments")

    from app.models.postgres.finance import PaymentStatus, PaymentMethod

    payment = await db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status == PaymentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Payment already completed")

    payment.status = PaymentStatus.COMPLETED
    payment.payment_date = date.today()
    if data.get("transaction_ref"):
        payment.transaction_ref = data["transaction_ref"]
    if data.get("payment_method"):
        try:
            payment.payment_method = PaymentMethod(data["payment_method"].upper())
        except ValueError:
            pass
    if data.get("remarks"):
        payment.remarks = (payment.remarks or "") + " | " + data["remarks"]

    # If this was an expense payment, mark the expense as PAID too
    if payment.source_ref and payment.source_ref.startswith("expense:"):
        try:
            expense_id = int(payment.source_ref.split(":")[1])
            from app.models.postgres.trip import TripExpense, ExpenseStatusEnum
            expense = await db.get(TripExpense, expense_id)
            if expense:
                expense.expense_status = ExpenseStatusEnum.PAID
                expense.paid_by = current_user.user_id
                expense.paid_at = datetime.utcnow()
        except (ValueError, IndexError):
            pass

    await db.commit()
    return APIResponse(
        success=True,
        message="Payment marked as completed.",
        data={"payment_number": payment.payment_number, "amount": float(payment.amount)},
    )
