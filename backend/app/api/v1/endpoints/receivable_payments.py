# Receivable Payments — UPI / NEFT / RTGS / Cheque / Cash recording endpoints
# Transport ERP
#
# Routes (registered without prefix in api_router so paths are exact):
#   GET  /clients/{client_id}/payment-info
#   POST /receivables/record-payment
#   GET  /receivables/{invoice_id}/payments

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse
from app.schemas.payment_schemas import RecordPaymentRequest
from app.services import receivable_payment_service

router = APIRouter()


@router.get("/clients/{client_id}/payment-info", response_model=APIResponse)
async def get_client_payment_info(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    """
    Returns UPI info (upi_id, phone) for a client.
    Flutter uses this before showing the payment sheet.
    Returns { upi_available: false } when neither field is set.
    """
    data = await receivable_payment_service.get_client_payment_info(db, client_id)
    return APIResponse(success=True, data=data)


@router.post("/receivables/record-payment", response_model=APIResponse)
async def record_receivable_payment(
    payload: RecordPaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_CREATE)),
):
    """
    Record a payment against an invoice.

    Validates:
    - amount > 0 and <= outstanding
    - UPI: needs reference_number OR upi_txn_id
    - NEFT/RTGS: needs reference_number (UTR)
    - No duplicate (invoice_id, reference_number) pairs
    - Invoice must not be already PAID

    On success: inserts Payment row, updates Invoice amounts/status,
    posts double-entry ledger (DR Bank, CR AR).
    All steps run within a single DB session (auto-rollback on any exception).
    """
    result = await receivable_payment_service.record_receivable_payment(
        db, payload, current_user.user_id
    )
    return APIResponse(
        success=True,
        data=result,
        message=(
            f"₹{payload.amount_paid:,.2f} recorded via {payload.payment_mode}"
        ),
    )


@router.get("/receivables/{invoice_id}/payments", response_model=APIResponse)
async def get_invoice_payment_history(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    """Returns all payment records for a given invoice."""
    data = await receivable_payment_service.get_invoice_payments(db, invoice_id)
    return APIResponse(success=True, data=data)
