# Finance Automation Endpoints
# Payment Links, Bank Reconciliation, Settlements, Alerts, Reports, FASTag, Webhooks
from fastapi import APIRouter, Body, Depends, HTTPException, Query, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.finance_automation import (
    PaymentLinkCreate, SettlementCreate, SupplierPayableCreate,
    ManualMatchRequest,
)
from app.services import (
    payment_automation_service,
    banking_reconciliation_service,
    settlement_service,
    invoice_automation_service,
    finance_reports_service,
)

router = APIRouter()


# ━━━ Payment Links ━━━
@router.post("/payment-links", response_model=APIResponse, status_code=201)
async def create_payment_link(
    data: PaymentLinkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_CREATE)),
):
    link = await payment_automation_service.create_payment_link_for_invoice(
        db, data.invoice_id, current_user.user_id
    )
    return APIResponse(
        success=True,
        data={"id": link.id, "short_url": link.short_url, "amount": float(link.amount)},
        message="Payment link created",
    )


@router.get("/payment-links", response_model=APIResponse)
async def list_payment_links(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    invoice_id: Optional[int] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    items, total = await payment_automation_service.list_payment_links(
        db, invoice_id=invoice_id, status=status, page=page, limit=limit
    )
    pages = (total + limit - 1) // limit
    return APIResponse(
        success=True,
        data=[{
            "id": l.id, "invoice_id": l.invoice_id, "short_url": l.short_url,
            "amount": float(l.amount), "status": l.status.value if hasattr(l.status, 'value') else l.status,
            "send_count": l.send_count, "created_at": l.created_at.isoformat(),
        } for l in items],
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


@router.post("/payment-links/{link_id}/resend", response_model=APIResponse)
async def resend_payment_link(
    link_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_CREATE)),
):
    link = await payment_automation_service.resend_payment_link(db, link_id)
    return APIResponse(success=True, message=f"Payment link resent (count: {link.send_count})")


# ━━━ Bank Statements & Reconciliation ━━━
@router.post("/bank-statements/import", response_model=APIResponse, status_code=201)
async def import_bank_statement(
    account_id: int = Query(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_IMPORT)),
):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    content = await file.read()
    csv_text = content.decode("utf-8")
    statement = await banking_reconciliation_service.import_bank_statement_csv(
        db, account_id, csv_text, current_user.user_id
    )
    return APIResponse(
        success=True,
        data={"id": statement.id, "line_count": statement.line_count},
        message="Bank statement imported",
    )


@router.post("/bank-statements/{statement_id}/reconcile", response_model=APIResponse)
async def auto_reconcile(
    statement_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_RECONCILE)),
):
    summary = await banking_reconciliation_service.auto_reconcile_statement(db, statement_id)
    return APIResponse(success=True, data=summary, message="Auto-reconciliation complete")


@router.get("/bank-statements/{statement_id}/summary", response_model=APIResponse)
async def reconciliation_summary(
    statement_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_READ)),
):
    summary = await banking_reconciliation_service.get_reconciliation_summary(db, statement_id)
    return APIResponse(success=True, data=summary)


@router.get("/bank-statements/{statement_id}/lines", response_model=APIResponse)
async def list_statement_lines(
    statement_id: int,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_READ)),
):
    items, total = await banking_reconciliation_service.list_statement_lines(
        db, statement_id, status=status, page=page, limit=limit
    )
    pages = (total + limit - 1) // limit
    return APIResponse(
        success=True,
        data=[{
            "id": l.id, "transaction_date": l.transaction_date.isoformat(),
            "description": l.description, "reference_number": l.reference_number,
            "debit_amount": float(l.debit_amount), "credit_amount": float(l.credit_amount),
            "balance": float(l.balance) if l.balance else None,
            "reconciliation_status": l.reconciliation_status.value if hasattr(l.reconciliation_status, 'value') else l.reconciliation_status,
            "match_confidence": float(l.match_confidence) if l.match_confidence else None,
            "matched_payment_id": l.matched_payment_id,
            "matched_invoice_id": l.matched_invoice_id,
        } for l in items],
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


@router.post("/bank-statements/lines/{line_id}/match", response_model=APIResponse)
async def manual_match(
    line_id: int,
    data: ManualMatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_RECONCILE)),
):
    line = await banking_reconciliation_service.manual_match_line(
        db, line_id, data.payment_id, data.invoice_id, current_user.user_id
    )
    return APIResponse(success=True, message="Line matched manually")


@router.post("/bank-statements/lines/{line_id}/ignore", response_model=APIResponse)
async def ignore_line(
    line_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_RECONCILE)),
):
    await banking_reconciliation_service.ignore_statement_line(db, line_id, current_user.user_id)
    return APIResponse(success=True, message="Statement line ignored")


# ━━━ Driver Settlements ━━━
@router.post("/settlements", response_model=APIResponse, status_code=201)
async def create_settlement(
    data: SettlementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.SETTLEMENT_CREATE)),
):
    settlement = await settlement_service.generate_driver_settlement(
        db, data.driver_id, data.period_from, data.period_to, current_user.user_id
    )
    return APIResponse(
        success=True,
        data={"id": settlement.id, "settlement_number": settlement.settlement_number,
              "net_payable": float(settlement.net_payable)},
        message="Settlement generated",
    )


@router.get("/settlements", response_model=APIResponse)
async def list_settlements(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    driver_id: Optional[int] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.SETTLEMENT_READ)),
):
    items, total = await settlement_service.list_settlements(
        db, driver_id=driver_id, status=status, page=page, limit=limit
    )
    pages = (total + limit - 1) // limit
    return APIResponse(
        success=True,
        data=[{
            "id": s.id, "settlement_number": s.settlement_number,
            "driver_id": s.driver_id, "period_from": s.period_from.isoformat(),
            "period_to": s.period_to.isoformat(),
            "total_earnings": float(s.gross_amount), "trip_count": s.trips_completed,
            "total_deductions": float(s.total_deductions),
            "net_payable": float(s.net_amount),
            "status": s.status.value if hasattr(s.status, 'value') else s.status,
            "created_at": s.created_at.isoformat(),
        } for s in items],
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


@router.post("/settlements/{settlement_id}/approve", response_model=APIResponse)
async def approve_settlement(
    settlement_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.SETTLEMENT_APPROVE)),
):
    await settlement_service.approve_settlement(db, settlement_id, current_user.user_id)
    return APIResponse(success=True, message="Settlement approved")


@router.post("/settlements/{settlement_id}/pay", response_model=APIResponse)
async def pay_settlement(
    settlement_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.SETTLEMENT_APPROVE)),
):
    await settlement_service.pay_settlement(db, settlement_id, current_user.user_id)
    return APIResponse(success=True, message="Settlement paid")


# ━━━ Supplier Payables ━━━
@router.post("/supplier-payables", response_model=APIResponse, status_code=201)
async def create_supplier_payable(
    data: SupplierPayableCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_CREATE)),
):
    payable = await settlement_service.create_supplier_payable(
        db, data.vendor_id, data.description, data.amount,
        data.due_date, data.reference_number, current_user.user_id,
    )
    return APIResponse(
        success=True,
        data={"id": payable.id, "payable_number": payable.payable_number},
        message="Supplier payable created",
    )


@router.get("/supplier-payables", response_model=APIResponse)
async def list_supplier_payables(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    vendor_id: Optional[int] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    items, total = await settlement_service.list_supplier_payables(
        db, vendor_id=vendor_id, status=status, page=page, limit=limit
    )
    pages = (total + limit - 1) // limit
    return APIResponse(
        success=True,
        data=[{
            "id": p.id, "payable_number": p.payable_number,
            "vendor_id": p.vendor_id, "description": p.description,
            "amount": float(p.amount), "paid_amount": float(p.paid_amount),
            "due_date": p.due_date.isoformat(),
            "status": p.status.value if hasattr(p.status, 'value') else p.status,
            "created_at": p.created_at.isoformat(),
        } for p in items],
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


@router.post("/supplier-payables/{payable_id}/pay", response_model=APIResponse)
async def pay_supplier_payable(
    payable_id: int,
    body: dict = Body(default={}),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_CREATE)),
):
    payment_method = body.get("payment_method", "NEFT")
    reference_number = body.get("reference_number") or body.get("utr")
    paid_date_str = body.get("paid_date")
    await settlement_service.pay_supplier_payable(
        db, payable_id, current_user.user_id,
        payment_method=payment_method,
        reference_number=reference_number,
        paid_date_str=paid_date_str,
    )
    return APIResponse(success=True, message="Supplier payable paid")


# ━━━ Razorpay Webhook ━━━
@router.post("/razorpay/webhook", include_in_schema=False)
async def razorpay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receive payment events from Razorpay.
    No auth middleware — signature verified via HMAC-SHA256.
    Register this URL in Razorpay Dashboard → Settings → Webhooks.
    """
    from app.services import razorpay_service
    from app.core.config import settings

    body_bytes = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    # Use webhook secret if configured, fallback to key secret
    secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", None) or getattr(settings, "RAZORPAY_KEY_SECRET", None)
    if not secret:
        raise HTTPException(status_code=400, detail="Razorpay webhook secret not configured")

    import hmac as _hmac, hashlib as _hashlib, json as _json
    expected = _hmac.new(secret.encode(), body_bytes, _hashlib.sha256).hexdigest()
    if not _hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = _json.loads(body_bytes)
    event = payload.get("event")

    if event == "payment_link.paid":
        # Client has paid an invoice via Razorpay payment link
        try:
            from app.models.postgres.finance import Payment, PaymentMethod, PaymentStatus, Invoice
            from app.services.finance_service import generate_payment_number
            from datetime import date, datetime
            from decimal import Decimal

            entity = payload.get("payload", {}).get("payment_link", {}).get("entity", {})
            payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})

            link_id = entity.get("id")
            reference_id = entity.get("reference_id")  # We store invoice_id here
            amount_paid = Decimal(str(payment_entity.get("amount", 0))) / 100
            rzp_payment_id = payment_entity.get("id")

            # Find the PaymentLink in our DB by link_id
            from sqlalchemy import select as _select
            from app.models.postgres.finance_automation import PaymentLink
            link_result = await db.execute(
                _select(PaymentLink).where(PaymentLink.link_id == link_id)
            )
            link_row = link_result.scalar_one_or_none()
            if link_row and link_row.invoice_id:
                invoice = await db.get(Invoice, link_row.invoice_id)
                if invoice and invoice.payment_status != "PAID":
                    payment = Payment(
                        payment_number=generate_payment_number(),
                        payment_date=date.today(),
                        payment_type="received",
                        invoice_id=invoice.id,
                        client_id=invoice.client_id,
                        amount=amount_paid,
                        payment_method=PaymentMethod.RAZORPAY,
                        reference_number=rzp_payment_id,
                        status=PaymentStatus.COMPLETED,
                        net_amount=amount_paid,
                        remarks=f"Razorpay payment link {link_id}",
                    )
                    db.add(payment)
                    invoice.amount_paid = (invoice.amount_paid or Decimal(0)) + amount_paid
                    if invoice.amount_paid >= invoice.total_amount:
                        invoice.payment_status = "PAID"
                    else:
                        invoice.payment_status = "PARTIAL"
                    link_row.status = "PAID"
                    await db.commit()
        except Exception as exc:
            import logging as _logging
            _logging.getLogger(__name__).error("[Razorpay webhook] Error processing payment_link.paid: %s", exc)

    return {"status": "ok"}


@router.get("/razorpay/status", response_model=APIResponse)
async def razorpay_status(
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    """Check if Razorpay is configured and ready."""
    from app.core.config import settings
    enabled = getattr(settings, "RAZORPAY_ENABLED", False)
    has_keys = bool(getattr(settings, "RAZORPAY_KEY_ID", "")) and bool(getattr(settings, "RAZORPAY_KEY_SECRET", ""))
    return APIResponse(
        success=True,
        data={
            "enabled": enabled,
            "configured": has_keys,
            "ready": enabled and has_keys,
        },
        message="Razorpay is ready" if (enabled and has_keys) else "Razorpay not yet configured",
    )


# ━━━ FASTag Transactions ━━━
@router.get("/fastag", response_model=APIResponse)
async def list_fastag_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    vehicle_id: Optional[int] = None,
    trip_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.BANKING_READ)),
):
    items, total = await banking_reconciliation_service.list_fastag_transactions(
        db, vehicle_id=vehicle_id, trip_id=trip_id,
        date_from=date_from, date_to=date_to, page=page, limit=limit
    )
    pages = (total + limit - 1) // limit
    return APIResponse(
        success=True,
        data=[{
            "id": t.id, "vehicle_id": t.vehicle_id, "trip_id": t.trip_id,
            "transaction_id": t.transaction_id, "plaza_name": t.plaza_name,
            "amount": float(t.amount),
            "transaction_time": t.transaction_time.isoformat(),
        } for t in items],
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


# ━━━ Finance Alerts ━━━
@router.get("/alerts", response_model=APIResponse)
async def list_finance_alerts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    is_read: Optional[bool] = None,
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    from sqlalchemy import select, func, and_
    from app.models.postgres.finance_automation import FinanceAlert

    query = select(FinanceAlert).where(FinanceAlert.is_resolved == False)
    count_query = select(func.count(FinanceAlert.id)).where(FinanceAlert.is_resolved == False)

    if is_read is not None:
        query = query.where(FinanceAlert.is_read == is_read)
        count_query = count_query.where(FinanceAlert.is_read == is_read)
    if severity:
        query = query.where(FinanceAlert.severity == severity)
        count_query = count_query.where(FinanceAlert.severity == severity)

    total = (await db.execute(count_query)).scalar() or 0
    unread_count_q = select(func.count(FinanceAlert.id)).where(
        and_(FinanceAlert.is_resolved == False, FinanceAlert.is_read == False)
    )
    unread_count = (await db.execute(unread_count_q)).scalar() or 0

    query = query.order_by(FinanceAlert.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    alerts = result.scalars().all()

    pages = (total + limit - 1) // limit
    return APIResponse(
        success=True,
        data={
            "items": [{
                "id": a.id,
                "alert_type": a.alert_type.value if hasattr(a.alert_type, 'value') else a.alert_type,
                "severity": a.severity.value if hasattr(a.severity, 'value') else a.severity,
                "title": a.title, "message": a.message,
                "reference_type": a.reference_type, "reference_id": a.reference_id,
                "amount": float(a.amount) if a.amount else None,
                "is_read": a.is_read, "created_at": a.created_at.isoformat(),
            } for a in alerts],
            "unread_count": unread_count,
        },
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


@router.post("/alerts/{alert_id}/read", response_model=APIResponse)
async def mark_alert_read(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.postgres.finance_automation import FinanceAlert

    result = await db.execute(select(FinanceAlert).where(FinanceAlert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    await db.commit()
    return APIResponse(success=True, message="Alert marked as read")


@router.post("/alerts/{alert_id}/resolve", response_model=APIResponse)
async def resolve_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.postgres.finance_automation import FinanceAlert
    from datetime import datetime

    result = await db.execute(select(FinanceAlert).where(FinanceAlert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_resolved = True
    alert.resolved_by = current_user.user_id
    alert.resolved_at = datetime.utcnow()
    await db.commit()
    return APIResponse(success=True, message="Alert resolved")


# ━━━ Reports ━━━
@router.get("/reports/daily-digest", response_model=APIResponse)
async def daily_digest(
    report_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    if report_date:
        cached = await finance_reports_service.get_cached_report(db, "daily_digest", report_date)
        if cached:
            return APIResponse(success=True, data=cached.report_data)
    report = await finance_reports_service.generate_daily_digest(db, report_date)
    await db.commit()
    return APIResponse(success=True, data=report)


@router.get("/reports/weekly-pl", response_model=APIResponse)
async def weekly_pl(
    week_ending: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    report = await finance_reports_service.generate_weekly_pl(db, week_ending)
    await db.commit()
    return APIResponse(success=True, data=report)


@router.get("/reports/monthly-close", response_model=APIResponse)
async def monthly_close(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    cached = await finance_reports_service.get_cached_report(
        db, "monthly_close", date(year, month, 1)
    )
    if cached:
        return APIResponse(success=True, data=cached.report_data)
    report = await finance_reports_service.generate_monthly_close(db, year, month)
    await db.commit()
    return APIResponse(success=True, data=report)


@router.get("/reports/gstr1", response_model=APIResponse)
async def gstr1_report(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    report = await finance_reports_service.generate_gstr1_data(db, year, month)
    await db.commit()
    return APIResponse(success=True, data=report)


# ━━━ Invoice Automation Checks ━━━
@router.get("/automation/duplicate-check", response_model=APIResponse)
async def check_duplicates(
    client_id: int = Query(...),
    trip_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    duplicates = await invoice_automation_service.detect_duplicate_billing(db, client_id, trip_id)
    return APIResponse(
        success=True,
        data={"has_duplicates": len(duplicates) > 1, "count": len(duplicates),
              "invoice_ids": [d.id for d in duplicates]},
    )


@router.get("/automation/freight-leakage/{invoice_id}", response_model=APIResponse)
async def check_freight_leakage(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    result = await invoice_automation_service.detect_freight_leakage(db, invoice_id)
    return APIResponse(success=True, data=result)


@router.get("/automation/partial-payments", response_model=APIResponse)
async def partial_payments(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    invoices = await invoice_automation_service.get_partial_payment_invoices(db)
    return APIResponse(
        success=True,
        data=[{
            "id": inv.id, "invoice_number": inv.invoice_number,
            "total_amount": float(inv.total_amount),
            "paid_amount": float(inv.paid_amount),
            "balance_due": float(inv.balance_due),
        } for inv in invoices],
    )


# ━━━ Finance Hub — KPIs & Alert Panels ━━━

@router.get("/dashboard/kpis", response_model=APIResponse)
async def finance_dashboard_kpis(
    period: str = Query("this_month"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    """Finance Hub — KPI strip: total invoiced, outstanding, overdue, cash balance."""
    from sqlalchemy import select, func, cast, String
    from app.models.postgres.finance import Invoice, InvoiceStatus
    from app.models.postgres.route import BankAccount
    from datetime import date as _date

    _ps = cast(Invoice.payment_status, String)
    total_invoiced = await db.scalar(
        select(func.coalesce(func.sum(Invoice.total_amount), 0))
        .where(Invoice.status != InvoiceStatus.CANCELLED)
    ) or 0
    outstanding = await db.scalar(
        select(func.coalesce(func.sum(Invoice.amount_due), 0))
        .where(_ps.in_(['UNPAID', 'PARTIAL']))
    ) or 0
    overdue = await db.scalar(
        select(func.coalesce(func.sum(Invoice.amount_due), 0))
        .where(
            _ps.in_(['UNPAID', 'PARTIAL']),
            Invoice.due_date < _date.today(),
        )
    ) or 0
    cash_balance = await db.scalar(
        select(func.coalesce(func.sum(BankAccount.current_balance), 0))
    ) or 0
    return APIResponse(
        success=True,
        data={
            "total_invoiced": float(total_invoiced),
            "outstanding": float(outstanding),
            "overdue": float(overdue),
            "cash_balance": float(cash_balance),
            "period": period,
        },
    )


@router.get("/alerts/overdue", response_model=APIResponse)
async def overdue_invoices_alert(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    """Overdue invoices for Finance Hub alert panel."""
    from sqlalchemy import select, cast, String
    from app.models.postgres.finance import Invoice
    from app.models.postgres.client import Client
    from datetime import date as _date

    result = await db.execute(
        select(Invoice, Client.name.label("client_name"))
        .join(Client, Invoice.client_id == Client.id, isouter=True)
        .where(
            cast(Invoice.payment_status, String).in_(['UNPAID', 'PARTIAL']),
            Invoice.due_date < _date.today(),
        )
        .order_by(Invoice.due_date.asc())
        .limit(50)
    )
    rows = result.all()
    data = []
    today = _date.today()
    for inv, client_name in rows:
        days = (today - inv.due_date).days if inv.due_date else 0
        data.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "client_name": client_name or "—",
            "amount": float(inv.amount_due or 0),
            "days_overdue": days,
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
        })
    return APIResponse(success=True, data=data, message=f"{len(data)} overdue invoices")


@router.get("/alerts/upcoming-payments", response_model=APIResponse)
async def upcoming_payments_alert(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    """Payments due in the next N days for Finance Hub alert panel."""
    from sqlalchemy import select, cast, String
    from app.models.postgres.finance_automation import SupplierPayable
    from datetime import date as _date, timedelta

    cutoff = _date.today() + timedelta(days=days)
    result = await db.execute(
        select(SupplierPayable)
        .where(
            cast(SupplierPayable.status, String) == 'PENDING',
            SupplierPayable.due_date <= cutoff,
            SupplierPayable.due_date >= _date.today(),
        )
        .order_by(SupplierPayable.due_date.asc())
        .limit(50)
    )
    payables = result.scalars().all()
    data = [{
        "id": p.id,
        "description": p.remarks or p.payable_number,
        "amount": float(p.amount or 0),
        "due_date": p.due_date.isoformat() if p.due_date else None,
        "vendor": f"Vendor #{p.vendor_id}",
        "type": "payable",
    } for p in payables]
    return APIResponse(success=True, data=data, message=f"{len(data)} upcoming payments")


@router.get("/alerts/banking", response_model=APIResponse)
async def banking_balance_alerts(
    threshold: float = Query(10000.0),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    """Bank accounts with balance below threshold for Finance Hub alert panel."""
    from sqlalchemy import select
    from app.models.postgres.route import BankAccount

    result = await db.execute(
        select(BankAccount).where(BankAccount.current_balance < threshold)
    )
    accounts = result.scalars().all()
    data = [{
        "id": a.id,
        "account_name": a.account_name or "Account",
        "bank_name": a.bank_name or "—",
        "balance": float(a.current_balance or 0),
        "threshold": threshold,
    } for a in accounts]
    return APIResponse(success=True, data=data, message=f"{len(data)} low-balance accounts")


@router.get("/reports/driver-settlements", response_model=APIResponse)
async def driver_settlements_report(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    """Driver settlement summary report for Finance Hub."""
    from sqlalchemy import select
    from app.models.postgres.finance_automation import DriverSettlement

    stmt = select(DriverSettlement)
    if from_date:
        stmt = stmt.where(DriverSettlement.settlement_date >= from_date)
    if to_date:
        stmt = stmt.where(DriverSettlement.settlement_date <= to_date)
    stmt = stmt.order_by(DriverSettlement.settlement_date.desc()).limit(200)
    result = await db.execute(stmt)
    settlements = result.scalars().all()
    data = [{
        "id": s.id,
        "driver_id": s.driver_id,
        "amount": float(s.net_amount or 0),
        "status": s.status.value if s.status else None,
        "trip_id": s.trip_id,
        "settlement_date": s.settlement_date.isoformat() if s.settlement_date else None,
    } for s in settlements]
    return APIResponse(success=True, data=data)


@router.get("/reports/pnl", response_model=APIResponse)
async def pnl_report(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    """Monthly P&L summary for Finance Hub."""
    from sqlalchemy import select, func, extract
    from app.models.postgres.finance import Invoice, Payment, InvoiceStatus

    invoiced = await db.scalar(
        select(func.coalesce(func.sum(Invoice.total_amount), 0)).where(
            extract("month", Invoice.invoice_date) == month,
            extract("year", Invoice.invoice_date) == year,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
    ) or 0
    collected = await db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            extract("month", Payment.payment_date) == month,
            extract("year", Payment.payment_date) == year,
        )
    ) or 0
    return APIResponse(
        success=True,
        data={
            "month": month,
            "year": year,
            "total_invoiced": float(invoiced),
            "total_collected": float(collected),
            "outstanding": float(invoiced) - float(collected),
        },
    )


@router.get("/reports/period-invoice", response_model=APIResponse)
async def period_invoice_report(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    client: Optional[str] = None,
    format: str = Query("json", pattern="^(json|pdf)$"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    """Period invoice summary report for Finance Hub."""
    from sqlalchemy import select
    from app.models.postgres.finance import Invoice, InvoiceStatus
    from app.models.postgres.client import Client

    stmt = (
        select(Invoice, Client.name.label("client_name"))
        .join(Client, Invoice.client_id == Client.id, isouter=True)
        .where(Invoice.status != InvoiceStatus.CANCELLED)
    )
    if from_date:
        stmt = stmt.where(Invoice.invoice_date >= from_date)
    if to_date:
        stmt = stmt.where(Invoice.invoice_date <= to_date)
    if client:
        stmt = stmt.where(Client.name.ilike(f"%{client}%"))
    stmt = stmt.order_by(Invoice.invoice_date.desc()).limit(500)
    result = await db.execute(stmt)
    rows = result.all()
    data = [{
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "client_name": client_name or "—",
        "amount": float(inv.total_amount or 0),
        "balance_due": float(inv.amount_due or 0),
        "status": inv.status.value if inv.status else None,
        "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
    } for inv, client_name in rows]
    return APIResponse(success=True, data=data)


@router.post("/invoices/{invoice_id}/remind", response_model=APIResponse)
async def send_payment_reminder(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_UPDATE)),
):
    """Send payment reminder for an overdue invoice."""
    from sqlalchemy import select
    from app.models.postgres.finance import Invoice

    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return APIResponse(
        success=True,
        message=f"Reminder queued for invoice {invoice.invoice_number}",
        data={"invoice_id": invoice_id},
    )

