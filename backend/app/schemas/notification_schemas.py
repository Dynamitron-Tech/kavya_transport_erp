# Notification Schemas
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class NotificationOut(BaseModel):
    id: int
    event_type: str
    title: str
    body: str
    target_role: Optional[str] = None
    target_user_id: Optional[int] = None
    data: Optional[dict] = {}
    is_read: bool
    urgency: str
    triggered_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UnreadCountOut(BaseModel):
    count: int


class MarkReadRequest(BaseModel):
    pass
