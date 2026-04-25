# Finance Automation Schemas
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime, date
from decimal import Decimal


# --- Payment Link ---
class PaymentLinkCreate(BaseModel):
    invoice_id: int


class PaymentLinkResponse(BaseModel):
    id: int
    invoice_id: int
    razorpay_link_id: Optional[str] = None
    short_url: Optional[str] = None
    amount: float
    status: str
    send_count: int
    expires_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentLinkListResponse(BaseModel):
    items: List[PaymentLinkResponse]
    total: int


# --- Bank Statement ---
class BankStatementLineResponse(BaseModel):
    id: int
    statement_id: int
    transaction_date: date
    description: Optional[str] = None
    reference_number: Optional[str] = None
    debit_amount: float
    credit_amount: float
    balance: Optional[float] = None
    reconciliation_status: str
    matched_payment_id: Optional[int] = None
    matched_invoice_id: Optional[int] = None
    match_confidence: Optional[float] = None
    matched_by: Optional[int] = None
    matched_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BankStatementResponse(BaseModel):
    id: int
    account_id: int
    statement_date: date
    file_name: Optional[str] = None
    source: str
    opening_balance: float
    closing_balance: float
    total_credits: float
    total_debits: float
    line_count: int
    imported_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BankStatementDetailResponse(BankStatementResponse):
    lines: List[BankStatementLineResponse] = []


class ReconciliationSummary(BaseModel):
    total_lines: int
    matched: int
    unmatched: int
    exception: int
    ignored: int


class ManualMatchRequest(BaseModel):
    payment_id: Optional[int] = None
    invoice_id: Optional[int] = None


# --- Driver Settlement ---
class SettlementCreate(BaseModel):
    driver_id: int
    period_from: date
    period_to: date


class SettlementResponse(BaseModel):
    id: int
    settlement_number: str
    driver_id: int
    period_from: date
    period_to: date
    total_earnings: float
    trip_count: int
    total_deductions: float
    advance_deductions: float
    net_payable: float
    status: str
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    payment_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SettlementListResponse(BaseModel):
    items: List[SettlementResponse]
    total: int


# --- Supplier Payable ---
class SupplierPayableCreate(BaseModel):
    vendor_id: int
    description: str
    amount: float = Field(gt=0)
    due_date: date
    reference_number: Optional[str] = None


class SupplierPayableResponse(BaseModel):
    id: int
    payable_number: str
    vendor_id: int
    description: str
    amount: float
    paid_amount: float
    due_date: date
    status: str
    reference_number: Optional[str] = None
    payment_id: Optional[int] = None
    paid_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SupplierPayableListResponse(BaseModel):
    items: List[SupplierPayableResponse]
    total: int


# --- FASTag ---
class FASTagTransactionResponse(BaseModel):
    id: int
    vehicle_id: int
    trip_id: Optional[int] = None
    transaction_id: str
    transaction_type: str
    plaza_name: Optional[str] = None
    plaza_code: Optional[str] = None
    amount: float
    tag_id: Optional[str] = None
    transaction_time: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class FASTagListResponse(BaseModel):
    items: List[FASTagTransactionResponse]
    total: int


# --- Finance Alert ---
class FinanceAlertResponse(BaseModel):
    id: int
    alert_type: str
    severity: str
    title: str
    message: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    amount: Optional[float] = None
    is_read: bool
    is_resolved: bool
    resolved_by: Optional[int] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FinanceAlertListResponse(BaseModel):
    items: List[FinanceAlertResponse]
    total: int
    unread_count: int


# --- Reports ---
class ReportRequest(BaseModel):
    report_date: Optional[date] = None
    year: Optional[int] = None
    month: Optional[int] = None


class ReportResponse(BaseModel):
    report_type: str
    report_date: date
    data: Any
    generated_at: datetime
