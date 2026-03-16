# Auth Schemas
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=4)


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
    roles: List[str] = []
    permissions: List[str] = []
    avatar_url: Optional[str] = None
    branch_id: Optional[int] = None
    tenant_id: Optional[int] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class FCMTokenRequest(BaseModel):
    fcm_token: str
    device_type: str = "android"  # android, ios, web


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


TokenResponse.model_rebuild()
