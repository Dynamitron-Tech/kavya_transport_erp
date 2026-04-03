# User & Role Schemas
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: Optional[str] = Field(None, min_length=6)  # auto-generated when omitted
    first_name: str
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role_names: List[str] = []
    branch_id: Optional[int] = None
    is_active: bool = True
    # Employee profile fields
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    joining_date: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    # Bank / salary fields
    bank_account_holder: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    account_type: Optional[str] = None
    upi_id: Optional[str] = None
    salary_amount: Optional[str] = None
    pay_type: Optional[str] = None


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6)
    role_names: Optional[List[str]] = None
    branch_id: Optional[int] = None
    is_active: Optional[bool] = None
    # Employee profile fields
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    joining_date: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    # Bank / salary fields
    bank_account_holder: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    account_type: Optional[str] = None
    upi_id: Optional[str] = None
    salary_amount: Optional[str] = None
    pay_type: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: Optional[str] = None
    phone: Optional[str] = None
    employee_id: Optional[str] = None
    roles: List[str] = []
    branch_id: Optional[int] = None
    is_active: bool = True
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
