# Client Schemas
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime


class ClientContactCreate(BaseModel):
    name: str
    designation: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_primary: bool = False


class ClientContactResponse(ClientContactCreate):
    id: int
    client_id: int
    is_active: bool = True

    class Config:
        from_attributes = True


class ClientCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    code: Optional[str] = None  # auto-generated if not provided
    client_type: str = "regular"
    contact_person: Optional[str] = None
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    nature_of_business: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    alt_phone: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    gst_state_code: Optional[str] = None
    tan: Optional[str] = None
    reg_type: Optional[str] = None
    date_of_liability: Optional[str] = None
    assessment_year: Optional[str] = None
    tds_rate: Optional[str] = None
    tax_exempt: bool = False
    name_deductor: Optional[str] = None
    name_deductee: Optional[str] = None
    pan_deductor: Optional[str] = None
    pan_deductee: Optional[str] = None
    nature_payment: Optional[str] = None
    tds_amount: Optional[str] = None
    credit_limit: float = 0
    credit_days: int = 30
    invoice_frequency: str = "per_order"
    payment_method: str = "bank_transfer"
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    contacts: List[ClientContactCreate] = []


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    client_type: Optional[str] = None
    contact_person: Optional[str] = None
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    nature_of_business: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    alt_phone: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    gst_state_code: Optional[str] = None
    tan: Optional[str] = None
    reg_type: Optional[str] = None
    date_of_liability: Optional[str] = None
    assessment_year: Optional[str] = None
    tds_rate: Optional[str] = None
    tax_exempt: Optional[bool] = None
    name_deductor: Optional[str] = None
    name_deductee: Optional[str] = None
    pan_deductor: Optional[str] = None
    pan_deductee: Optional[str] = None
    nature_payment: Optional[str] = None
    tds_amount: Optional[str] = None
    credit_limit: Optional[float] = None
    credit_days: Optional[int] = None
    invoice_frequency: Optional[str] = None
    payment_method: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    is_active: Optional[bool] = None


class ClientResponse(BaseModel):
    id: int
    name: str
    code: str
    client_type: str
    contact_person: Optional[str] = None
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    nature_of_business: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    alt_phone: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    gst_state_code: Optional[str] = None
    tan: Optional[str] = None
    reg_type: Optional[str] = None
    date_of_liability: Optional[str] = None
    assessment_year: Optional[str] = None
    tds_rate: Optional[str] = None
    tax_exempt: bool = False
    name_deductor: Optional[str] = None
    name_deductee: Optional[str] = None
    pan_deductor: Optional[str] = None
    pan_deductee: Optional[str] = None
    nature_payment: Optional[str] = None
    tds_amount: Optional[str] = None
    credit_limit: float = 0
    credit_days: int = 30
    outstanding_amount: float = 0
    invoice_frequency: str = "per_order"
    payment_method: str = "bank_transfer"
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    is_active: bool = True
    status: str = "active"
    contacts: List[ClientContactResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
