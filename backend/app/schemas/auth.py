# Auth Schemas
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


class LoginRequest(BaseModel):
    """Accepts either an email address or an employee ID (e.g. KTD01) as identifier."""
    identifier: str = Field(..., min_length=2, description="Employee ID (e.g. KTD01) or admin email")
    password: str = Field(..., min_length=4)


class OtpVerifyRequest(BaseModel):
    session_id: str
    otp: str = Field(..., min_length=6, max_length=6)


class OtpInitResponse(BaseModel):
    otp_required: bool = True
    session_id: str
    phone_masked: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserInfo"


class UserInfo(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: Optional[str] = None
    phone: Optional[str] = None
    roles: List[str] = []
    permissions: List[str] = []
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    created_at: Optional[datetime] = None
    branch_id: Optional[int] = None
    tenant_id: Optional[int] = None
    redirect_to: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    joining_date: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    bank_account_holder: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    account_type: Optional[str] = None
    upi_id: Optional[str] = None
    salary_amount: Optional[str] = None
    pay_type: Optional[str] = None
    aadhaar_file_url: Optional[str] = None
    aadhaar_file_name: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class FCMTokenRequest(BaseModel):
    fcm_token: str
    device_type: str = "android"  # android, ios, web


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


class UpdatePhotoRequest(BaseModel):
    avatar_url: str = Field(..., min_length=1)


TokenResponse.model_rebuild()
