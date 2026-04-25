# Notification Model — in-app + push notification records
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from .base import Base


class Notification(Base):
    """Per-user notification record stored in PostgreSQL."""

    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    event_type = Column(String(60), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    # Routing — one of these must be set
    target_role = Column(String(30), nullable=True, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    data = Column(JSONB, nullable=True, default={})
    is_read = Column(Boolean, nullable=False, default=False)
    urgency = Column(String(20), nullable=False, default="normal")
    triggered_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
