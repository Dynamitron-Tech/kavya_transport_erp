# Portal Schemas
# Transport ERP — Phase D: Customer + Supplier Portals

from pydantic import BaseModel
from typing import Optional
from datetime import date


class PortalLoginRequest(BaseModel):
    email: str
    password: Optional[str] = None  # For future password-based login
    phone: Optional[str] = None


class BookingRequest(BaseModel):
    origin_city: str
    origin_address: Optional[str] = None
    destination_city: str
    destination_address: Optional[str] = None
    pickup_date: Optional[date] = None
    material_type: Optional[str] = None
    quantity: Optional[float] = None
    quantity_unit: Optional[str] = "MT"
    vehicle_type_required: Optional[str] = None
    special_requirements: Optional[str] = None
    remarks: Optional[str] = None


class SupplierInvoiceSubmit(BaseModel):
    amount: float
    invoice_number: Optional[str] = None
    remarks: Optional[str] = None
