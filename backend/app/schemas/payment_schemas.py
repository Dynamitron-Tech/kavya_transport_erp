# Payment Schemas — Receivable UPI Payment Recording
# Transport ERP

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, validator


class RecordPaymentRequest(BaseModel):
    invoice_id: int
    amount_paid: float = Field(..., gt=0, description="Must be > 0")
    payment_mode: Literal["UPI", "NEFT", "RTGS", "CHEQUE", "CASH"]
    reference_number: Optional[str] = Field(None, max_length=100)
    upi_txn_id: Optional[str] = Field(None, max_length=100)
    payment_date: date
    notes: Optional[str] = None

    @validator("reference_number", "upi_txn_id", pre=True)
    def _strip_or_none(cls, v):
        if v is not None:
            v = str(v).strip()
            return v if v else None
        return None


class RecordPaymentResponse(BaseModel):
    success: bool
    payment_id: int
    invoice_id: int
    new_status: str
    outstanding_balance: float


class ClientPaymentInfoResponse(BaseModel):
    upi_available: bool
    upi_id: Optional[str] = None
    phone: Optional[str] = None
    name: str


class PaymentRecordOut(BaseModel):
    payment_id: int
    amount_paid: float
    payment_mode: str
    reference_number: Optional[str] = None
    payment_date: date
    recorded_by_name: Optional[str] = None
