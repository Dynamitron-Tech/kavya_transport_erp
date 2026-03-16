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
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    gst_state_code: Optional[str] = None
    credit_limit: float = 0
    credit_days: int = 30
    contacts: List[ClientContactCreate] = []


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    client_type: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    gst_state_code: Optional[str] = None
    credit_limit: Optional[float] = None
    credit_days: Optional[int] = None
    is_active: Optional[bool] = None


class ClientResponse(BaseModel):
    id: int
    name: str
    code: str
    client_type: str
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    gst_state_code: Optional[str] = None
    credit_limit: float = 0
    credit_days: int = 30
    outstanding_amount: float = 0
    is_active: bool = True
    status: str = "active"
    contacts: List[ClientContactResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
