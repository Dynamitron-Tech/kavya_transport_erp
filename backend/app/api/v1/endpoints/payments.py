# Payment Endpoints — Razorpay integration
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse
from app.middleware.permissions import require_permission, Permissions
from app.services import razorpay_service

router = APIRouter()


class PaymentLinkRequest(BaseModel):
    amount: float
    description: str
    customer_name: str
    customer_phone: str
    customer_email: str = ""
    reference_id: str = ""


class PaymentVerifyRequest(BaseModel):
    payment_id: str
    payment_link_id: str
    signature: str


@router.post("/create-link", response_model=APIResponse)
async def create_payment_link(
    payload: PaymentLinkRequest,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_CREATE)),
):
    """Create a Razorpay payment link."""
    result = await razorpay_service.create_payment_link(
        amount=payload.amount,
        description=payload.description,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_email=payload.customer_email,
        reference_id=payload.reference_id,
    )
    return APIResponse(success=True, data=result, message="Payment link created")


@router.post("/verify", response_model=APIResponse)
async def verify_payment(
    payload: PaymentVerifyRequest,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    """Verify a Razorpay payment signature."""
    result = await razorpay_service.verify_payment(
        payment_id=payload.payment_id,
        payment_link_id=payload.payment_link_id,
        signature=payload.signature,
    )
    return APIResponse(success=True, data=result, message="Payment verification completed")


@router.get("/status/{payment_id}", response_model=APIResponse)
async def get_payment_status(
    payment_id: str,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    """Get payment status from Razorpay."""
    result = await razorpay_service.get_payment_status(payment_id)
    return APIResponse(success=True, data=result, message="Payment status fetched")
