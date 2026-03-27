# Audit Note Model
# Transport ERP — Phase B: AIS-140 + Geofencing

import enum
from sqlalchemy import Column, Integer, String, DateTime, Text, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin


class AuditNoteStatus(enum.Enum):
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"


class AuditNote(Base, TimestampMixin):
    __tablename__ = "audit_notes"

    resource_type = Column(String(50), nullable=False, index=True)  # vehicle, driver, trip, job, invoice
    resource_id = Column(Integer, nullable=False, index=True)

    note_text = Column(Text, nullable=False)
    status = Column(SQLEnum(AuditNoteStatus), default=AuditNoteStatus.OPEN, nullable=False)

    auditor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)

    # Relationships
    auditor = relationship("User", foreign_keys=[auditor_id])
    resolver = relationship("User", foreign_keys=[resolved_by])

    def __repr__(self):
        return f"<AuditNote {self.id} {self.resource_type}:{self.resource_id} ({self.status.value})>"
