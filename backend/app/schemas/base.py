# Base Schemas - Shared response/pagination models
from pydantic import BaseModel, Field
from typing import Optional, Any, List, Generic, TypeVar
from datetime import datetime

T = TypeVar("T")


class PaginationMeta(BaseModel):
    page: int = 1
    limit: int = 20
    total: int = 0
    pages: int = 0


class APIResponse(BaseModel):
    success: bool = True
    data: Any = None
    message: str = ""
    pagination: Optional[PaginationMeta] = None


class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    search: Optional[str] = None
    sort_by: Optional[str] = None
    sort_order: str = "desc"
