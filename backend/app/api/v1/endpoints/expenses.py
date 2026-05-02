# Company Expense API Endpoints
# Handles all outgoing payments: field GPay expenses, driver advance, salaries, rent, etc.
# Transport ERP

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Body
from sqlalchemy import select, func, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, validator, Field

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.models.postgres.expense import (
    Expense, ExpenseCategory, PaymentMethod, ApprovalStatus
)
from app.models.postgres.driver import Driver
from app.core.config import settings

router = APIRouter()


# ─── Request / Response schemas ───────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    expense_category: ExpenseCategory
    payment_method:   PaymentMethod
    amount_paise:     int = Field(..., gt=0, description="Amount in paise (×100 of rupees)")
    description:      Optional[str] = None
    expense_date:     date
    vehicle_id:       Optional[int] = None
    driver_id:        Optional[int] = None
    trip_id:          Optional[int] = None
    upi_ref_number:   Optional[str] = None
    netbanking_ref:   Optional[str] = None
    bank_name:        Optional[str] = None
    payee_name:       Optional[str] = None
    period_from:      Optional[date] = None
    period_to:        Optional[date] = None

    @validator('payment_method')
    def validate_payment_method_for_category(cls, v, values):
        category = values.get('expense_category')
        amount   = values.get('amount_paise', 0)
        if category is None:
            return v

        netbanking_categories = {
            ExpenseCategory.MARKET_VEHICLE_RENT,
            ExpenseCategory.DRIVER_SALARY,
            ExpenseCategory.STAFF_SALARY,
            ExpenseCategory.TAX,
            ExpenseCategory.INSURANCE,
            ExpenseCategory.PERMIT_COMPLIANCE,
        }

        if category == ExpenseCategory.VEHICLE_SPARE_PART and amount >= 300000:
            if v not in (PaymentMethod.GPAY_UPI, PaymentMethod.NETBANKING):
                raise ValueError('Spare parts above ₹3,000 must use GPay or Netbanking')

        if category == ExpenseCategory.LOADING_UNLOADING and amount >= 400000:
            if v not in (PaymentMethod.GPAY_UPI, PaymentMethod.NETBANKING):
                raise ValueError('Loading/unloading above ₹4,000 must use GPay or Netbanking')

        if category in netbanking_categories:
            if v not in (PaymentMethod.NETBANKING, PaymentMethod.CHEQUE, PaymentMethod.CASH):
                raise ValueError(
                    f'{category.value} must use Netbanking, Cheque, or Cash — not a payment gateway'
                )

        return v

    @validator('upi_ref_number', pre=True)
    def strip_upi_ref(cls, v):
        return str(v).strip() if v else None


class ExpenseApproveBody(BaseModel):
    pass


class ExpenseRejectBody(BaseModel):
    rejection_reason: str = Field(..., min_length=3)


class DriverAdvanceCreate(BaseModel):
    driver_id: int
    trip_id:   Optional[int] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _role_set(user: TokenData) -> set:
    return {str(r).lower() for r in (user.roles or [])}


def _is_approver(user: TokenData) -> bool:
    roles = _role_set(user)
    return bool(roles & {"admin", "accountant", "manager"})


def _expense_to_dict(e: Expense) -> dict:
    return {
        "id":                  e.id,
        "expense_category":    e.expense_category.value if hasattr(e.expense_category, 'value') else e.expense_category,
        "payment_method":      e.payment_method.value   if hasattr(e.payment_method,   'value') else e.payment_method,
        "amount_paise":        e.amount_paise,
        "amount_rupees":       round(e.amount_paise / 100, 2),
        "description":         e.description,
        "expense_date":        e.expense_date.isoformat() if e.expense_date else None,
        "vehicle_id":          e.vehicle_id,
        "driver_id":           e.driver_id,
        "trip_id":             e.trip_id,
        "upi_ref_number":      e.upi_ref_number,
        "receipt_image_url":   e.receipt_image_url,
        "netbanking_ref":      e.netbanking_ref,
        "bank_name":           e.bank_name,
        "banking_entry_id":    e.banking_entry_id,
        "payee_name":          e.payee_name,
        "period_from":         e.period_from.isoformat()  if e.period_from  else None,
        "period_to":           e.period_to.isoformat()    if e.period_to    else None,
        "approval_status":     e.approval_status.value    if hasattr(e.approval_status, 'value') else e.approval_status,
        "rejection_reason":    e.rejection_reason,
        "approved_by":         e.approved_by,
        "approved_at":         e.approved_at.isoformat() if e.approved_at else None,
        "razorpay_payout_id":  e.razorpay_payout_id,
        "created_by":          e.created_by,
        "branch_id":           e.branch_id,
        "created_at":          e.created_at.isoformat() if e.created_at else None,
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("", response_model=APIResponse, status_code=201)
async def create_expense(
    data: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Create a company expense entry.
    - Drivers / field staff → approval_status = pending (needs accountant approval).
    - Accountant / admin / manager → approval_status = approved directly.
    """
    roles = _role_set(current_user)
    auto_approve = bool(roles & {"admin", "accountant", "manager"})

    status = ApprovalStatus.APPROVED if auto_approve else ApprovalStatus.PENDING

    expense = Expense(
        expense_category  = data.expense_category,
        payment_method    = data.payment_method,
        amount_paise      = data.amount_paise,
        description       = data.description,
        expense_date      = data.expense_date,
        vehicle_id        = data.vehicle_id,
        driver_id         = data.driver_id,
        trip_id           = data.trip_id,
        upi_ref_number    = data.upi_ref_number,
        netbanking_ref    = data.netbanking_ref,
        bank_name         = data.bank_name,
        payee_name        = data.payee_name,
        period_from       = data.period_from,
        period_to         = data.period_to,
        approval_status   = status,
        approved_by       = current_user.user_id if auto_approve else None,
        approved_at       = datetime.utcnow()   if auto_approve else None,
        created_by        = current_user.user_id,
        branch_id         = getattr(current_user, 'branch_id', None),
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return APIResponse(
        success = True,
        data    = _expense_to_dict(expense),
        message = "Expense submitted for approval." if not auto_approve else "Expense recorded.",
    )


@router.get("", response_model=APIResponse)
async def list_expenses(
    page:           int           = Query(1,  ge=1),
    limit:          int           = Query(20, ge=1, le=200),
    category:       Optional[str] = None,
    payment_method: Optional[str] = None,
    status:         Optional[str] = None,
    from_date:      Optional[date] = None,
    to_date:        Optional[date] = None,
    trip_id:        Optional[int] = None,
    vehicle_id:     Optional[int] = None,
    driver_id:      Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """List expenses with filters. Drivers only see their own expenses."""
    roles = _role_set(current_user)
    q = select(Expense)

    # Drivers can only see their own
    if "driver" in roles and "admin" not in roles and "accountant" not in roles:
        result = await db.execute(
            select(Driver.id).where(Driver.user_id == current_user.user_id)
        )
        own_driver_id = result.scalar_one_or_none()
        if own_driver_id:
            q = q.where(Expense.driver_id == own_driver_id)
        else:
            q = q.where(Expense.created_by == current_user.user_id)

    if category:
        q = q.where(Expense.expense_category == category)
    if payment_method:
        q = q.where(Expense.payment_method == payment_method)
    if status:
        q = q.where(Expense.approval_status == status)
    if from_date:
        q = q.where(Expense.expense_date >= from_date)
    if to_date:
        q = q.where(Expense.expense_date <= to_date)
    if trip_id:
        q = q.where(Expense.trip_id == trip_id)
    if vehicle_id:
        q = q.where(Expense.vehicle_id == vehicle_id)
    if driver_id:
        q = q.where(Expense.driver_id == driver_id)

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0

    q = q.order_by(Expense.expense_date.desc(), Expense.id.desc())
    q = q.offset((page - 1) * limit).limit(limit)
    rows = (await db.execute(q)).scalars().all()

    return APIResponse(
        success    = True,
        data       = [_expense_to_dict(e) for e in rows],
        pagination = PaginationMeta(page=page, limit=limit, total=total, pages=(total + limit - 1) // limit),
    )


@router.patch("/{expense_id}/approve", response_model=APIResponse)
async def approve_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Approve a pending expense. Roles: accountant, admin, manager."""
    if not _is_approver(current_user):
        raise HTTPException(status_code=403, detail="Only accountants, managers, or admins can approve expenses.")

    expense = await db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found.")

    expense.approval_status = ApprovalStatus.APPROVED
    expense.approved_by     = current_user.user_id
    expense.approved_at     = datetime.utcnow()
    expense.rejection_reason = None
    await db.commit()
    await db.refresh(expense)
    return APIResponse(success=True, data=_expense_to_dict(expense), message="Expense approved.")


@router.patch("/{expense_id}/reject", response_model=APIResponse)
async def reject_expense(
    expense_id: int,
    body: ExpenseRejectBody,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Reject a pending expense with a reason."""
    if not _is_approver(current_user):
        raise HTTPException(status_code=403, detail="Only accountants, managers, or admins can reject expenses.")

    expense = await db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found.")

    expense.approval_status  = ApprovalStatus.REJECTED
    expense.rejection_reason = body.rejection_reason
    expense.approved_by      = None
    expense.approved_at      = None
    await db.commit()
    return APIResponse(success=True, message="Expense rejected.")


@router.post("/{expense_id}/receipt", response_model=APIResponse)
async def upload_receipt(
    expense_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Upload receipt image for an expense. Stores locally (or S3 when configured)."""
    expense = await db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found.")

    # Use existing storage helper if available, else local
    try:
        from app.services.storage_service import upload_file
        url = await upload_file(file, folder="expense_receipts")
    except ImportError:
        import os
        upload_dir = "uploads/expense_receipts"
        os.makedirs(upload_dir, exist_ok=True)
        ext = os.path.splitext(file.filename or "receipt.jpg")[1] or ".jpg"
        fname = f"expense_{expense_id}_{int(datetime.utcnow().timestamp())}{ext}"
        fpath = os.path.join(upload_dir, fname)
        with open(fpath, "wb") as f:
            content = await file.read()
            f.write(content)
        url = f"/{fpath}"

    expense.receipt_image_url = url
    await db.commit()
    return APIResponse(success=True, data={"receipt_image_url": url})


@router.get("/summary", response_model=APIResponse)
async def expense_summary(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Monthly expense totals grouped by category (approved only)."""
    today = date.today()
    result = await db.execute(
        select(
            Expense.expense_category,
            Expense.payment_method,
            func.sum(Expense.amount_paise).label('total_paise'),
            func.count(Expense.id).label('count'),
        )
        .where(
            and_(
                Expense.approval_status == ApprovalStatus.APPROVED,
                extract('year',  Expense.expense_date) == today.year,
                extract('month', Expense.expense_date) == today.month,
            )
        )
        .group_by(Expense.expense_category, Expense.payment_method)
        .order_by(func.sum(Expense.amount_paise).desc())
    )
    rows = result.all()
    data = [
        {
            "category":       r.expense_category.value if hasattr(r.expense_category, 'value') else r.expense_category,
            "payment_method": r.payment_method.value   if hasattr(r.payment_method,   'value') else r.payment_method,
            "total_paise":    int(r.total_paise or 0),
            "total_rupees":   round(int(r.total_paise or 0) / 100, 2),
            "count":          int(r.count or 0),
        }
        for r in rows
    ]
    return APIResponse(success=True, data=data)


@router.post("/driver-advance", response_model=APIResponse, status_code=201)
async def issue_driver_advance(
    body: DriverAdvanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Issue the standard ₹1,500 driver advance BEFORE a trip starts.
    This is called by admin/accountant/manager — not by the driver.

    Flow:
    1. Check driver has a UPI ID on file.
    2. Create expense record (auto-approved, standard amount).
    3. If RAZORPAY_X_KEY_ID is configured → trigger payout.
    4. Otherwise → create pending manual payout record.
    """
    if not _is_approver(current_user):
        raise HTTPException(status_code=403, detail="Only accountants, managers, or admins can issue driver advances.")

    driver = await db.get(Driver, body.driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found.")
    if not getattr(driver, 'upi_id', None):
        raise HTTPException(
            status_code=400,
            detail="Driver has no UPI ID on file. Add UPI ID to driver profile first."
        )

    ADVANCE_PAISE = 150000  # ₹1,500

    expense = Expense(
        expense_category = ExpenseCategory.DRIVER_ADVANCE,
        payment_method   = PaymentMethod.RAZORPAY_PAYOUT,
        amount_paise     = ADVANCE_PAISE,
        description      = "Standard trip advance",
        expense_date     = date.today(),
        driver_id        = body.driver_id,
        trip_id          = body.trip_id,
        approval_status  = ApprovalStatus.APPROVED,
        approved_by      = current_user.user_id,
        approved_at      = datetime.utcnow(),
        created_by       = current_user.user_id,
        branch_id        = getattr(current_user, 'branch_id', None),
        payee_name       = f"{driver.first_name} {driver.last_name or ''}".strip(),
    )

    # Trigger Razorpay X payout if configured
    x_key = getattr(settings, 'RAZORPAY_X_KEY_ID', None)
    payout_status = "manual_pending"
    payout_id     = None

    if x_key:
        try:
            from app.services.razorpay_service import trigger_razorpay_payout
            result = await trigger_razorpay_payout(driver.upi_id, ADVANCE_PAISE)
            payout_id     = result.get('id')
            payout_status = "payout_triggered"
            expense.razorpay_payout_id = payout_id
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                "[DriverAdvance] Razorpay payout failed for driver %s: %s", body.driver_id, exc
            )
            payout_status = "payout_failed_manual_required"

    db.add(expense)
    await db.commit()
    await db.refresh(expense)

    return APIResponse(
        success = True,
        data    = {**_expense_to_dict(expense), "payout_status": payout_status, "payout_id": payout_id},
        message = f"Driver advance ₹1,500 issued. Status: {payout_status}",
    )
