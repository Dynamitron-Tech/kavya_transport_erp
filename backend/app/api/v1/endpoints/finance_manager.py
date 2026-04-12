# Finance Manager API Endpoints
# Salary, advances, expenses, payouts, schedules, vendor payments
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import Optional
from datetime import date, datetime, timedelta

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse, PaginationMeta
from app.models.postgres.payment import PaymentContact, Payout, PaymentSchedule, ExpenseSubmission
from app.models.postgres.trip import Trip, TripExpense, TripStatusEnum, ExpenseStatusEnum
from app.models.postgres.user import User
from app.services import payment_service

router = APIRouter()


def _allowed(user: TokenData) -> bool:
    roles = {str(r).lower() for r in (user.roles or [])}
    return bool(roles & {"admin", "finance_manager", "accountant"})


def _require_finance(user: TokenData):
    if not _allowed(user):
        raise HTTPException(status_code=403, detail="Finance Manager access required.")


# ─── Dashboard ──────────────────────────────────────────────────────────────────


@router.get("/dashboard/summary", response_model=APIResponse)
async def finance_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)
    today = date.today()
    month_start = today.replace(day=1)

    # Pending expense submissions
    pending_r = await db.execute(
        select(func.count(), func.coalesce(func.sum(ExpenseSubmission.amount_paise), 0))
        .select_from(ExpenseSubmission)
        .where(ExpenseSubmission.status == "pending")
    )
    pending_row = pending_r.one()
    pending_count = pending_row[0] or 0
    pending_amount = pending_row[1] or 0

    # Salary payouts this month
    salary_r = await db.execute(
        select(
            func.count(),
            func.coalesce(func.sum(Payout.amount_paise), 0),
        ).select_from(Payout).where(
            Payout.payout_type == "salary",
            Payout.created_at >= month_start,
            Payout.status == "processed",
        )
    )
    salary_row = salary_r.one()

    # Unpaid salary count
    total_staff_r = await db.execute(
        select(func.count()).select_from(User).where(User.is_active == True, User.is_deleted == False)
    )
    total_staff = total_staff_r.scalar() or 0

    # Payables due this week
    week_end = today + timedelta(days=7)
    due_r = await db.execute(
        select(func.count(), func.coalesce(func.sum(PaymentSchedule.amount_paise), 0))
        .select_from(PaymentSchedule)
        .where(
            PaymentSchedule.is_active == True,
            PaymentSchedule.next_due_date <= week_end,
        )
    )
    due_row = due_r.one()

    # Overdue
    overdue_r = await db.execute(
        select(func.count()).select_from(PaymentSchedule).where(
            PaymentSchedule.is_active == True,
            PaymentSchedule.next_due_date < today,
        )
    )
    overdue_count = overdue_r.scalar() or 0

    # Razorpay balance
    try:
        from app.services import razorpay_payout_service as rpx
        balance = await rpx.get_balance()
    except Exception:
        balance = 0

    return APIResponse(success=True, data={
        "expenses": {
            "pending_count": pending_count,
            "pending_amount_paise": pending_amount,
        },
        "salary": {
            "total_staff": total_staff,
            "paid_count": salary_row[0] or 0,
            "paid_paise": salary_row[1] or 0,
        },
        "payables": {
            "overdue_count": overdue_count,
            "due_this_week_count": due_row[0] or 0,
            "due_this_week_paise": due_row[1] or 0,
        },
        "razorpay_balance_paise": balance,
        "month": today.strftime("%B %Y"),
    })


# ─── Salary Payments ───────────────────────────────────────────────────────────


@router.get("/salary-summary", response_model=APIResponse)
async def salary_summary(
    month: str = Query(default=None, description="YYYY-MM"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)
    if not month:
        month = date.today().strftime("%Y-%m")

    # All active users with salary
    users_r = await db.execute(
        select(User).where(User.is_active == True, User.is_deleted == False)
    )
    users = users_r.scalars().all()

    # All salary payouts for this month
    payouts_r = await db.execute(
        select(Payout).where(
            Payout.payout_type == "salary",
            Payout.reference_id.like(f"%_{month}"),
        )
    )
    payouts = {p.reference_id: p for p in payouts_r.scalars().all()}

    staff_list = []
    for u in users:
        ref_key = f"{u.id}_{month}"
        payout = payouts.get(ref_key)
        salary_paise = int((getattr(u, "salary_amount", 0) or 0) * 100)
        staff_list.append({
            "employee_id": u.id,
            "name": f"{u.first_name} {u.last_name or ''}".strip(),
            "designation": getattr(u, "designation", "Staff"),
            "bank_last4": (u.account_number or "")[-4:] if u.account_number else None,
            "bank_name": u.bank_name,
            "salary_paise": salary_paise,
            "status": payout.status if payout else "unpaid",
            "payout_id": payout.id if payout else None,
            "utr": payout.utr if payout else None,
            "paid_at": payout.processed_at.isoformat() if payout and payout.processed_at else None,
            "has_bank_account": bool(u.account_number),
        })

    total_due = sum(s["salary_paise"] for s in staff_list)
    paid_count = sum(1 for s in staff_list if s["status"] == "processed")
    paid_paise = sum(s["salary_paise"] for s in staff_list if s["status"] == "processed")

    return APIResponse(success=True, data={
        "month": month,
        "staff": staff_list,
        "total_due_paise": total_due,
        "paid_count": paid_count,
        "unpaid_count": len(staff_list) - paid_count,
        "paid_paise": paid_paise,
        "remaining_paise": total_due - paid_paise,
    })


@router.post("/payments/salary", response_model=APIResponse)
async def pay_salary(
    employee_id: int = Body(...),
    month: str = Body(...),
    amount_paise: int = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)

    user_r = await db.execute(select(User).where(User.id == employee_id))
    user = user_r.scalar_one_or_none()
    name = f"{user.first_name} {user.last_name or ''}".strip() if user else "Unknown"

    payout = await payment_service.initiate_salary_payment(
        db, employee_id, amount_paise, month, current_user.id, name,
    )
    return APIResponse(success=True, data={"payout_id": payout.id, "status": payout.status})


@router.post("/payments/salary/bulk", response_model=APIResponse)
async def pay_salary_bulk(
    payments: list = Body(...),
    month: str = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)
    results = []
    for item in payments:
        try:
            user_r = await db.execute(select(User).where(User.id == item["employee_id"]))
            user = user_r.scalar_one_or_none()
            name = f"{user.first_name} {user.last_name or ''}".strip() if user else ""
            payout = await payment_service.initiate_salary_payment(
                db, item["employee_id"], item["amount_paise"], month, current_user.id, name,
            )
            results.append({"employee_id": item["employee_id"], "status": "initiated", "payout_id": payout.id})
        except Exception as e:
            results.append({"employee_id": item["employee_id"], "status": "failed", "error": str(e)[:200]})
    initiated = sum(1 for r in results if r["status"] == "initiated")
    return APIResponse(success=True, data={"initiated": initiated, "failed": len(results) - initiated, "results": results})


# ─── Driver Advances ───────────────────────────────────────────────────────────


@router.post("/payments/advance", response_model=APIResponse)
async def issue_advance(
    driver_id: int = Body(...),
    trip_id: Optional[int] = Body(None),
    amount_paise: int = Body(150000),  # ₹1,500 default
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)
    from app.models.postgres.driver import Driver
    dr_r = await db.execute(select(Driver).where(Driver.id == driver_id))
    dr = dr_r.scalar_one_or_none()
    name = dr.name if dr else "Driver"

    payout = await payment_service.initiate_driver_advance(
        db, driver_id, amount_paise, trip_id, current_user.id, name,
    )
    return APIResponse(success=True, data={"payout_id": payout.id, "status": payout.status})


@router.get("/drivers/{driver_id}/advances", response_model=APIResponse)
async def driver_advances(
    driver_id: int,
    month: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)
    q = select(Payout).where(
        Payout.payout_type == "advance",
        or_(
            Payout.reference_id == str(driver_id),
            Payout.reference_id.like(f"%_{driver_id}_%"),
        ),
    ).order_by(Payout.created_at.desc())

    result = await db.execute(q)
    payouts = result.scalars().all()
    items = []
    for p in payouts:
        items.append({
            "id": p.id,
            "amount_paise": p.amount_paise,
            "trip_ref": p.reference_id,
            "status": p.status,
            "utr": p.utr,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "processed_at": p.processed_at.isoformat() if p.processed_at else None,
        })
    total = sum(i["amount_paise"] for i in items if items)
    return APIResponse(success=True, data={"advances": items, "total_advanced_paise": total})


# ─── Expense Submissions ───────────────────────────────────────────────────────


@router.get("/expense-queue", response_model=APIResponse)
async def expense_queue(
    status: Optional[str] = Query("pending"),
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)
    q = select(ExpenseSubmission)
    if status:
        q = q.where(ExpenseSubmission.status == status)
    if category:
        q = q.where(ExpenseSubmission.category == category)
    q = q.order_by(ExpenseSubmission.submitted_at.desc())

    total_r = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_r.scalar() or 0

    result = await db.execute(q.offset((page - 1) * limit).limit(limit))
    items = []
    for sub in result.scalars().all():
        # Get submitter name
        user_r = await db.execute(select(User).where(User.id == sub.submitted_by))
        user = user_r.scalar_one_or_none()
        items.append({
            "id": sub.id,
            "submitted_by": sub.submitted_by,
            "submitter_name": f"{user.first_name} {user.last_name or ''}".strip() if user else "Unknown",
            "category": sub.category,
            "amount_paise": sub.amount_paise,
            "payment_method": sub.payment_method,
            "upi_ref_number": sub.upi_ref_number,
            "receipt_image_s3": sub.receipt_image_s3,
            "description": sub.description,
            "status": sub.status,
            "trip_id": sub.trip_id,
            "vehicle_id": sub.vehicle_id,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
            "rejection_reason": sub.rejection_reason,
        })

    pages = (total + limit - 1) // limit
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.post("/expense-submissions", response_model=APIResponse)
async def submit_expense(
    category: str = Body(...),
    amount_paise: int = Body(...),
    payment_method: str = Body("gpay"),
    upi_ref: Optional[str] = Body(None),
    trip_id: Optional[int] = Body(None),
    vehicle_id: Optional[int] = Body(None),
    description: Optional[str] = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    # Threshold validation
    if category == "spare_part" and amount_paise < 300000:
        raise HTTPException(status_code=400, detail="Spare part expense below ₹3,000 threshold — not claimable.")
    if category == "loading" and amount_paise < 400000:
        raise HTTPException(status_code=400, detail="Loading expense below ₹4,000 threshold — not claimable.")

    # Auto-approve small toll/parking with receipt
    auto = False
    if category in ("toll", "parking") and amount_paise < 50000:
        auto = True

    sub = ExpenseSubmission(
        submitted_by=current_user.id,
        trip_id=trip_id,
        vehicle_id=vehicle_id,
        category=category,
        amount_paise=amount_paise,
        payment_method=payment_method,
        upi_ref_number=upi_ref,
        description=description,
        status="auto_approved" if auto else "pending",
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return APIResponse(success=True, data={"id": sub.id, "status": sub.status})


@router.patch("/expense-submissions/{sub_id}/approve", response_model=APIResponse)
async def approve_expense(
    sub_id: int,
    reimburse_now: bool = Body(False),
    notes: Optional[str] = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)
    result = await db.execute(select(ExpenseSubmission).where(ExpenseSubmission.id == sub_id))
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Expense submission not found.")

    sub.status = "approved"
    sub.approved_by = current_user.id
    sub.approved_at = datetime.utcnow()

    payout_data = None
    if reimburse_now:
        payout = await payment_service.initiate_expense_reimbursement(db, sub_id, current_user.id)
        payout_data = {"payout_id": payout.id, "status": payout.status}

    await db.commit()
    return APIResponse(success=True, data={"id": sub.id, "status": sub.status, "payout": payout_data})


@router.patch("/expense-submissions/{sub_id}/reject", response_model=APIResponse)
async def reject_expense(
    sub_id: int,
    reason: str = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)
    result = await db.execute(select(ExpenseSubmission).where(ExpenseSubmission.id == sub_id))
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Expense submission not found.")

    sub.status = "rejected"
    sub.rejection_reason = reason
    sub.approved_by = current_user.id
    sub.approved_at = datetime.utcnow()
    await db.commit()
    return APIResponse(success=True, data={"id": sub.id, "status": "rejected"})


# ─── Trip Expense Queue ────────────────────────────────────────────────────────


@router.get("/trip-expense-queue", response_model=APIResponse)
async def trip_expense_queue(
    status: Optional[str] = Query("PENDING"),
    trip_id: Optional[int] = None,
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """List trip expenses from completed trips for finance review and payment."""
    _require_finance(current_user)

    q = (
        select(TripExpense, Trip)
        .join(Trip, TripExpense.trip_id == Trip.id)
        .where(Trip.is_deleted == False)
    )

    # Only show from completed/closed trips unless filtering all
    if status and status.upper() != "ALL":
        try:
            q = q.where(TripExpense.expense_status == ExpenseStatusEnum(status.upper()))
        except ValueError:
            pass
        # For PENDING, only show from completed trips
        if status.upper() == "PENDING":
            q = q.where(Trip.status == TripStatusEnum.COMPLETED)
    
    if trip_id:
        q = q.where(TripExpense.trip_id == trip_id)
    if category:
        q = q.where(TripExpense.category.ilike(f"%{category}%"))

    q = q.order_by(TripExpense.created_at.desc())

    total_r = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_r.scalar() or 0

    result = await db.execute(q.offset((page - 1) * limit).limit(limit))
    rows = result.all()

    items = []
    for expense, trip in rows:
        items.append({
            "id": expense.id,
            "trip_id": expense.trip_id,
            "trip_number": trip.trip_number,
            "origin": trip.origin,
            "destination": trip.destination,
            "vehicle_registration": trip.vehicle_registration,
            "driver_name": trip.driver_name,
            "category": expense.category.value if expense.category else None,
            "sub_category": expense.sub_category,
            "description": expense.description,
            "amount": float(expense.amount),
            "payment_mode": expense.payment_mode,
            "reference_number": expense.reference_number,
            "receipt_url": expense.receipt_url,
            "expense_status": expense.expense_status.value if expense.expense_status else "PENDING",
            "is_verified": expense.is_verified,
            "entry_source": expense.entry_source,
            "expense_date": expense.expense_date.isoformat() if expense.expense_date else None,
            "created_at": expense.created_at.isoformat() if expense.created_at else None,
            "paid_at": expense.paid_at.isoformat() if expense.paid_at else None,
        })

    pages = (total + limit - 1) // limit
    return APIResponse(
        success=True,
        data=items,
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


@router.patch("/trip-expenses/{expense_id}/pay", response_model=APIResponse)
async def pay_trip_expense(
    expense_id: int,
    notes: Optional[str] = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Mark a trip expense as PAID."""
    _require_finance(current_user)
    result = await db.execute(select(TripExpense).where(TripExpense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Trip expense not found.")
    if expense.expense_status == ExpenseStatusEnum.PAID:
        raise HTTPException(status_code=400, detail="Expense already marked as paid.")

    expense.expense_status = ExpenseStatusEnum.PAID
    expense.is_verified = True
    expense.paid_by = current_user.id
    expense.paid_at = datetime.utcnow()
    if notes:
        expense.description = (expense.description or "") + f" [Finance: {notes}]"
    await db.commit()
    return APIResponse(success=True, data={"id": expense.id, "status": "PAID"})


@router.patch("/trip-expenses/{expense_id}/reject", response_model=APIResponse)
async def reject_trip_expense(
    expense_id: int,
    reason: str = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Reject a trip expense."""
    _require_finance(current_user)
    result = await db.execute(select(TripExpense).where(TripExpense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Trip expense not found.")

    expense.expense_status = ExpenseStatusEnum.REJECTED
    expense.description = (expense.description or "") + f" [Rejected: {reason}]"
    await db.commit()
    return APIResponse(success=True, data={"id": expense.id, "status": "REJECTED"})


# ─── Payment Contacts ──────────────────────────────────────────────────────────


@router.get("/payment-contacts", response_model=APIResponse)
async def list_payment_contacts(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)
    q = select(PaymentContact).where(PaymentContact.is_active == True)
    if entity_type:
        q = q.where(PaymentContact.contact_type == entity_type)
    if entity_id:
        q = q.where(PaymentContact.entity_id == entity_id)
    result = await db.execute(q.order_by(PaymentContact.created_at.desc()))
    items = []
    for c in result.scalars().all():
        items.append({
            "id": c.id,
            "contact_type": c.contact_type,
            "entity_id": c.entity_id,
            "entity_name": c.entity_name,
            "bank_name": c.bank_name,
            "bank_last4": c.bank_account_number[-4:] if c.bank_account_number else None,
            "ifsc": c.bank_ifsc,
            "upi_id": c.upi_id,
            "is_verified": c.is_verified,
            "preferred_method": c.preferred_method,
            "razorpay_contact_id": c.razorpay_contact_id,
            "razorpay_fund_account_id": c.razorpay_fund_account_id,
        })
    return APIResponse(success=True, data=items)


@router.post("/payment-contacts", response_model=APIResponse)
async def create_payment_contact(
    entity_type: str = Body(...),
    entity_id: int = Body(...),
    entity_name: str = Body(...),
    bank_account_number: Optional[str] = Body(None),
    bank_ifsc: Optional[str] = Body(None),
    bank_name: Optional[str] = Body(None),
    account_holder_name: Optional[str] = Body(None),
    upi_id: Optional[str] = Body(None),
    phone: Optional[str] = Body(None),
    email: Optional[str] = Body(None),
    preferred_method: str = Body("imps"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)

    # Validate
    from app.services import razorpay_payout_service as rpx
    if bank_ifsc and not rpx.validate_ifsc(bank_ifsc):
        raise HTTPException(status_code=400, detail="Invalid IFSC code format.")
    if upi_id and not rpx.validate_upi(upi_id):
        raise HTTPException(status_code=400, detail="Invalid UPI ID format.")

    contact = PaymentContact(
        contact_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        bank_account_number=bank_account_number,
        bank_ifsc=bank_ifsc,
        bank_name=bank_name,
        account_holder_name=account_holder_name or entity_name,
        upi_id=upi_id,
        phone=phone,
        email=email,
        preferred_method=preferred_method,
    )

    # Register with Razorpay
    try:
        rp_contact = await rpx.create_contact(
            name=entity_name,
            contact_type="employee" if entity_type in ("driver", "staff") else "vendor",
            email=email,
            phone=phone,
            reference_id=f"{entity_type}_{entity_id}",
        )
        contact.razorpay_contact_id = rp_contact.get("id")

        if bank_account_number and bank_ifsc:
            fa = await rpx.add_bank_account(
                razorpay_contact_id=contact.razorpay_contact_id,
                account_number=bank_account_number,
                ifsc=bank_ifsc,
                account_holder_name=account_holder_name or entity_name,
            )
            contact.razorpay_fund_account_id = fa.get("id")
            contact.is_verified = True
        elif upi_id:
            fa = await rpx.add_upi(
                razorpay_contact_id=contact.razorpay_contact_id,
                upi_id=upi_id,
                account_holder_name=account_holder_name or entity_name,
            )
            contact.razorpay_fund_account_id = fa.get("id")
            contact.is_verified = True
    except Exception as e:
        # Save contact even if Razorpay registration fails
        contact.is_verified = False

    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return APIResponse(success=True, data={"id": contact.id, "is_verified": contact.is_verified})


# ─── Payment Schedules ─────────────────────────────────────────────────────────


@router.get("/payment-schedules", response_model=APIResponse)
async def list_schedules(
    schedule_type: Optional[str] = None,
    due_within_days: int = Query(30),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)
    q = select(PaymentSchedule).where(PaymentSchedule.is_active == True)
    if schedule_type:
        q = q.where(PaymentSchedule.schedule_type == schedule_type)

    cutoff = date.today() + timedelta(days=due_within_days)
    q = q.where(or_(
        PaymentSchedule.next_due_date <= cutoff,
        PaymentSchedule.next_due_date.is_(None),
    ))
    q = q.order_by(PaymentSchedule.next_due_date.asc())

    result = await db.execute(q)
    items = []
    today = date.today()
    for s in result.scalars().all():
        days_until = (s.next_due_date - today).days if s.next_due_date else None
        urgency = "overdue" if days_until is not None and days_until < 0 else (
            "urgent" if days_until is not None and days_until <= 7 else "normal"
        )
        items.append({
            "id": s.id,
            "schedule_type": s.schedule_type,
            "description": s.description,
            "payee_name": s.payee_name,
            "amount_paise": s.amount_paise,
            "frequency": s.frequency,
            "next_due_date": s.next_due_date.isoformat() if s.next_due_date else None,
            "days_until_due": days_until,
            "urgency": urgency,
            "vehicle_id": s.vehicle_id,
            "last_paid_at": s.last_paid_at.isoformat() if s.last_paid_at else None,
        })

    return APIResponse(success=True, data=items)


@router.post("/payment-schedules", response_model=APIResponse)
async def create_schedule(
    schedule_type: str = Body(...),
    amount_paise: int = Body(...),
    frequency: str = Body(...),
    description: Optional[str] = Body(None),
    payee_name: Optional[str] = Body(None),
    due_day: Optional[int] = Body(None),
    due_date: Optional[str] = Body(None),
    vehicle_id: Optional[int] = Body(None),
    driver_id: Optional[int] = Body(None),
    employee_id: Optional[int] = Body(None),
    contact_id: Optional[int] = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)
    s = PaymentSchedule(
        schedule_type=schedule_type,
        amount_paise=amount_paise,
        frequency=frequency,
        description=description,
        payee_name=payee_name,
        due_day=due_day,
        due_date=date.fromisoformat(due_date) if due_date else None,
        vehicle_id=vehicle_id,
        driver_id=driver_id,
        employee_id=employee_id,
        contact_id=contact_id,
        next_due_date=date.fromisoformat(due_date) if due_date else None,
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return APIResponse(success=True, data={"id": s.id})


@router.delete("/payment-schedules/{schedule_id}", response_model=APIResponse)
async def deactivate_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)
    result = await db.execute(select(PaymentSchedule).where(PaymentSchedule.id == schedule_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    s.is_active = False
    await db.commit()
    return APIResponse(success=True, data={"id": s.id, "is_active": False})


# ─── Vendor Payments ────────────────────────────────────────────────────────────


@router.post("/payments/vendor", response_model=APIResponse)
async def pay_vendor(
    vendor_name: str = Body(...),
    amount_paise: int = Body(...),
    payment_type: str = Body(...),
    description: str = Body(""),
    vehicle_id: Optional[int] = Body(None),
    contact_id: Optional[int] = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)
    payout = await payment_service.initiate_vendor_payment(
        db, vendor_name, amount_paise, payment_type, description, vehicle_id, current_user.id, contact_id,
    )
    return APIResponse(success=True, data={"payout_id": payout.id, "status": payout.status})


# ─── Payout History ────────────────────────────────────────────────────────────


@router.get("/payouts", response_model=APIResponse)
@router.get("/payouts/", response_model=APIResponse)
async def list_payouts(
    payout_type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)
    q = select(Payout)
    if payout_type:
        q = q.where(Payout.payout_type == payout_type)
    if status:
        q = q.where(Payout.status == status)
    q = q.order_by(Payout.created_at.desc())

    total_r = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_r.scalar() or 0

    result = await db.execute(q.offset((page - 1) * limit).limit(limit))
    items = []
    for p in result.scalars().all():
        items.append({
            "id": p.id,
            "payout_type": p.payout_type,
            "recipient_name": p.recipient_name,
            "amount_paise": p.amount_paise,
            "payment_method": p.payment_method,
            "status": p.status,
            "utr": p.utr,
            "narration": p.narration,
            "reference_type": p.reference_type,
            "reference_id": p.reference_id,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "processed_at": p.processed_at.isoformat() if p.processed_at else None,
            "failure_reason": p.failure_reason,
            "razorpay_payout_id": p.razorpay_payout_id,
        })

    pages = (total + limit - 1) // limit
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


# ─── Razorpay Balance ──────────────────────────────────────────────────────────


@router.get("/razorpay/balance", response_model=APIResponse)
async def razorpay_balance(
    current_user: TokenData = Depends(get_current_user),
):
    _require_finance(current_user)
    try:
        from app.services import razorpay_payout_service as rpx
        balance = await rpx.get_balance()
        return APIResponse(success=True, data={"balance_paise": balance})
    except Exception as e:
        return APIResponse(success=True, data={"balance_paise": 0, "error": str(e)[:200]})


# ─── Webhook ────────────────────────────────────────────────────────────────────


@router.post("/webhooks/razorpay-payout")
async def razorpay_payout_webhook(
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Handle Razorpay payout webhook events. No auth — verify signature instead."""
    event = body.get("event", "")
    if not event.startswith("payout."):
        return {"status": "ignored"}

    result = await payment_service.handle_webhook(db, event, body)
    return result
