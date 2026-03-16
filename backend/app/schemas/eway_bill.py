# E-way Bill Schemas
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


class EwayItemCreate(BaseModel):
    product_name: str
    product_description: Optional[str] = None
    hsn_code: str
    quantity: float
    unit: str = "NOS"
    taxable_value: float
    cgst_rate: float = 0
    sgst_rate: float = 0
    igst_rate: float = 0


class EwayItemResponse(BaseModel):
    id: int
    product_name: str
    hsn_code: str
    quantity: float
    unit: str
    taxable_value: float
    cgst_rate: float = 0
    sgst_rate: float = 0
    igst_rate: float = 0

    class Config:
        from_attributes = True


class EwayBillCreate(BaseModel):
    lr_id: Optional[int] = None
    trip_id: Optional[int] = None
    supply_type: str = "outward"
    sub_supply_type: str = "supply"
    document_type: str = "tax_invoice"
    document_number: str
    document_date: date
    from_gstin: str
    from_name: str
    from_address: Optional[str] = None
    from_place: str
    from_state_code: str
    from_pincode: str
    to_gstin: Optional[str] = None
    to_name: str
    to_address: Optional[str] = None
    to_place: str
    to_state_code: str
    to_pincode: str
    total_value: float
    cgst_amount: float = 0
    sgst_amount: float = 0
    igst_amount: float = 0
    cess_amount: float = 0
    total_invoice_value: float
    transport_mode: str = "road"
    vehicle_number: Optional[str] = None
    vehicle_type: str = "regular"
    transporter_id: Optional[str] = None
    transporter_name: Optional[str] = None
    approximate_distance: Optional[int] = None
    items: List[EwayItemCreate] = []


class EwayBillUpdate(BaseModel):
    vehicle_number: Optional[str] = None
    vehicle_type: Optional[str] = None
    transporter_id: Optional[str] = None
    reason_for_update: Optional[str] = None


class EwayBillResponse(BaseModel):
    id: int
    eway_bill_number: Optional[str] = None
    eway_bill_date: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    lr_id: Optional[int] = None
    trip_id: Optional[int] = None
    supply_type: str
    document_number: str
    document_date: date
    from_name: str
    from_gstin: str
    from_place: str
    to_name: str
    to_place: str
    total_value: float
    total_invoice_value: float
    vehicle_number: Optional[str] = None
    status: str = "active"
    is_extended: bool = False
    items: List[EwayItemResponse] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
