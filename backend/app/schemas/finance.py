# Finance Schemas - Invoice, Payment, Ledger, Banking
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


# --- Invoice ---
class InvoiceItemCreate(BaseModel):
    description: str
    hsn_sac_code: Optional[str] = None
    trip_id: Optional[int] = None
    lr_id: Optional[int] = None
    quantity: float = 1
    unit: Optional[str] = None
    rate: float
    tax_rate: float = 18


class InvoiceItemResponse(BaseModel):
    id: int
    item_number: int
    description: str
    hsn_sac_code: Optional[str] = None
    trip_id: Optional[int] = None
    lr_id: Optional[int] = None
    quantity: float
    rate: float
    amount: float
    tax_rate: float
    tax_amount: float
    total: float

    class Config:
        from_attributes = True


class InvoiceCreate(BaseModel):
    invoice_date: date
    due_date: date
    invoice_type: str = "tax_invoice"
    client_id: int
    billing_name: str
    billing_address: Optional[str] = None
    billing_gstin: Optional[str] = None
    billing_state_code: Optional[str] = None
    reference_number: Optional[str] = None
    discount_percent: float = 0
    terms_conditions: Optional[str] = None
    notes: Optional[str] = None
    items: List[InvoiceItemCreate] = []


class InvoiceUpdate(BaseModel):
    due_date: Optional[date] = None
    billing_name: Optional[str] = None
    billing_address: Optional[str] = None
    billing_gstin: Optional[str] = None
    reference_number: Optional[str] = None
    discount_percent: Optional[float] = None
    terms_conditions: Optional[str] = None
    notes: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    invoice_date: date
    due_date: date
    invoice_type: str
    client_id: int
    client_name: Optional[str] = None
    billing_name: str
    billing_gstin: Optional[str] = None
    subtotal: float = 0
    discount_amount: float = 0
    taxable_amount: float = 0
    cgst_amount: float = 0
    sgst_amount: float = 0
    igst_amount: float = 0
    total_tax: float = 0
    total_amount: float = 0
    amount_paid: float = 0
    amount_due: float = 0
    status: str = "draft"
    pdf_url: Optional[str] = None
    items: List[InvoiceItemResponse] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Payment ---
class PaymentCreate(BaseModel):
    payment_date: date
    payment_type: str  # received, paid
    invoice_id: Optional[int] = None
    client_id: Optional[int] = None
    vendor_id: Optional[int] = None
    amount: float
    payment_method: str  # cash, bank_transfer, cheque, upi, neft, rtgs
    bank_name: Optional[str] = None
    cheque_number: Optional[str] = None
    cheque_date: Optional[date] = None
    transaction_ref: Optional[str] = None
    tds_rate: float = 0
    tds_amount: float = 0
    remarks: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    payment_number: str
    payment_date: date
    payment_type: str
    invoice_id: Optional[int] = None
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    amount: float
    payment_method: str
    bank_name: Optional[str] = None
    transaction_ref: Optional[str] = None
    status: str = "completed"
    tds_amount: float = 0
    net_amount: Optional[float] = None
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Ledger ---
class LedgerEntryCreate(BaseModel):
    entry_date: date
    ledger_type: str
    account_name: str
    account_code: Optional[str] = None
    client_id: Optional[int] = None
    vendor_id: Optional[int] = None
    invoice_id: Optional[int] = None
    payment_id: Optional[int] = None
    trip_id: Optional[int] = None
    debit: float = 0
    credit: float = 0
    narration: Optional[str] = None
    reference_type: Optional[str] = None
    reference_number: Optional[str] = None


class LedgerEntryResponse(BaseModel):
    id: int
    entry_number: str
    entry_date: date
    ledger_type: str
    account_name: str
    account_code: Optional[str] = None
    client_id: Optional[int] = None
    vendor_id: Optional[int] = None
    debit: float = 0
    credit: float = 0
    balance: float = 0
    narration: Optional[str] = None
    reference_type: Optional[str] = None
    reference_number: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Vendor ---
class VendorCreate(BaseModel):
    name: str
    code: str
    vendor_type: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    bank_account: Optional[str] = None
    bank_name: Optional[str] = None
    bank_ifsc: Optional[str] = None


class VendorResponse(BaseModel):
    id: int
    name: str
    code: str
    vendor_type: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    gstin: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Bank Account ---
class BankAccountCreate(BaseModel):
    account_name: str
    account_number: str
    bank_name: str
    branch_name: Optional[str] = None
    ifsc_code: str
    account_type: Optional[str] = None
    current_balance: float = 0
    is_default: bool = False


class BankAccountResponse(BaseModel):
    id: int
    account_name: str
    account_number: str
    bank_name: str
    branch_name: Optional[str] = None
    ifsc_code: str
    account_type: Optional[str] = None
    current_balance: float = 0
    is_default: bool = False
    is_active: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Bank Transaction ---
class BankTransactionCreate(BaseModel):
    account_id: int
    transaction_date: date
    transaction_type: str  # credit, debit
    amount: float
    reference_number: Optional[str] = None
    narration: Optional[str] = None
    payment_id: Optional[int] = None
    invoice_id: Optional[int] = None
    client_id: Optional[int] = None


class BankTransactionResponse(BaseModel):
    id: int
    account_id: int
    transaction_date: date
    transaction_type: str
    amount: float
    balance_after: Optional[float] = None
    reference_number: Optional[str] = None
    narration: Optional[str] = None
    payment_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Route ---
class RouteCreate(BaseModel):
    route_name: str
    origin_city: str
    origin_state: Optional[str] = None
    destination_city: str
    destination_state: Optional[str] = None
    distance_km: float
    estimated_hours: Optional[float] = None
    toll_gates: int = 0


class RouteUpdate(BaseModel):
    route_name: Optional[str] = None
    distance_km: Optional[float] = None
    estimated_hours: Optional[float] = None
    toll_gates: Optional[int] = None
    is_active: Optional[bool] = None


class RouteResponse(BaseModel):
    id: int
    route_code: str
    route_name: str
    origin_city: str
    origin_state: Optional[str] = None
    destination_city: str
    destination_state: Optional[str] = None
    distance_km: float
    estimated_hours: Optional[float] = None
    toll_gates: int = 0
    is_active: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
