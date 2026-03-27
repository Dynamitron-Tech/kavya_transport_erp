# Sync Queue Model — Server-side offline action tracking
# Phase 2: KT Driver App elevation — batch sync support

import enum
from sqlalchemy import Column, Integer, String, DateTime, JSON, Enum as SQLEnum, ForeignKey, Text, Boolean
from .base import Base, TimestampMixin


class SyncActionStatus(enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CONFLICT = "CONFLICT"


class SyncQueue(Base, TimestampMixin):
    """Server-side record of offline actions submitted via batch sync."""

    __tablename__ = "sync_queue"

    # Who submitted
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    device_id = Column(String(100), nullable=True)

    # What action
    action_method = Column(String(10), nullable=False)  # POST, PUT, PATCH, DELETE
    action_path = Column(String(500), nullable=False)    # API path
    action_data = Column(JSON, nullable=True)            # Request body

    # Client-side metadata
    client_timestamp = Column(DateTime, nullable=True)   # When the action happened on device
    client_action_id = Column(String(100), nullable=True, index=True)  # Client-side unique ID for dedup

    # Processing
    status = Column(SQLEnum(SyncActionStatus), default=SyncActionStatus.PENDING, nullable=False, index=True)
    server_response = Column(JSON, nullable=True)        # Response from processing
    error_message = Column(Text, nullable=True)
    processed_at = Column(DateTime, nullable=True)
    retry_count = Column(Integer, default=0)

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)

    def __repr__(self):
        return f"<SyncQueue {self.id} {self.action_method} {self.action_path} {self.status.value}>"
