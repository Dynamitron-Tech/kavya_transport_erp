# User & Role Schemas
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    first_name: str
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role_names: List[str] = []
    branch_id: Optional[int] = None
    is_active: bool = True


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6)
    role_names: Optional[List[str]] = None
    branch_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: Optional[str] = None
    phone: Optional[str] = None
    roles: List[str] = []
    branch_id: Optional[int] = None
    is_active: bool = True
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
