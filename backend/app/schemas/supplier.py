# Supplier Schemas
from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime


class SupplierCreate(BaseModel):
    name: str
    code: Optional[str] = None
    supplier_type: str = "broker"
    contact_person: Optional[str] = None
    phone: str
    email: Optional[str] = None
    pan: Optional[str] = None
    gstin: Optional[str] = None
    aadhaar: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_name: Optional[str] = None
    rate_card: Optional[Dict[str, float]] = None
    tds_applicable: bool = True
    tds_rate: float = 1.0
    credit_limit: Optional[float] = None
    credit_days: int = 30


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    supplier_type: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    pan: Optional[str] = None
    gstin: Optional[str] = None
    aadhaar: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_name: Optional[str] = None
    rate_card: Optional[Dict[str, float]] = None
    tds_applicable: Optional[bool] = None
    tds_rate: Optional[float] = None
    credit_limit: Optional[float] = None
    credit_days: Optional[int] = None
    is_active: Optional[bool] = None


class SupplierVehicleCreate(BaseModel):
    vehicle_id: Optional[int] = None
    vehicle_registration: Optional[str] = None
    vehicle_type: Optional[str] = None
