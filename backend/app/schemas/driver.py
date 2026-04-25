# Driver Schemas
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


class DriverLicenseCreate(BaseModel):
    license_number: str
    license_type: str = "hmv"
    issuing_authority: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: date


class DriverLicenseResponse(DriverLicenseCreate):
    id: int
    driver_id: int
    is_verified: bool = False
    days_to_expiry: Optional[int] = None

    class Config:
        from_attributes = True


class DriverCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: Optional[str] = None
    employee_code: Optional[str] = None
    father_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    phone: str = Field(..., min_length=10)
    alternate_phone: Optional[str] = None
    email: Optional[str] = None
    permanent_address: Optional[str] = None
    current_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    aadhaar_number: Optional[str] = None
    pan_number: Optional[str] = None
    date_of_joining: Optional[date] = None
    designation: str = "driver"
    salary_type: str = "monthly"
    base_salary: Optional[float] = None
    per_km_rate: Optional[float] = None
    bank_account_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_ifsc: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    security_pin: Optional[str] = Field(None, min_length=6, max_length=6, pattern=r'^\d{6}$', description='6-digit security PIN for expense verification')
    licenses: List[DriverLicenseCreate] = []


class DriverUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    email: Optional[str] = None
    permanent_address: Optional[str] = None
    current_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    blood_group: Optional[str] = None
    date_of_joining: Optional[date] = None
    base_salary: Optional[float] = None
    per_km_rate: Optional[float] = None
    bank_account_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_ifsc: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    security_pin: Optional[str] = Field(None, min_length=6, max_length=6, pattern=r'^\d{6}$', description='6-digit security PIN')
    status: Optional[str] = None


class DriverResponse(BaseModel):
    id: int
    employee_code: str
    first_name: str
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    phone: str
    email: Optional[str] = None
    status: str = "available"
    blood_group: Optional[str] = None
    date_of_joining: Optional[date] = None
    city: Optional[str] = None
    state: Optional[str] = None
    designation: str = "driver"
    salary_type: str = "monthly"
    base_salary: Optional[float] = None
    licenses: List[DriverLicenseResponse] = []
    license_expiry_alert: bool = False
    days_to_license_expiry: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
