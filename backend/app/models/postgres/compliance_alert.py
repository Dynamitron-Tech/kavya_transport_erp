# Compliance Alert Model
# Transport ERP — Phase B: AIS-140 + Geofencing

import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin


class AlertType(enum.Enum):
    EXPIRED = "EXPIRED"
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


class AlertSeverity(enum.Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ComplianceAlert(Base, TimestampMixin):
    __tablename__ = "compliance_alerts"

    # Linked entities (nullable — alert can be for any entity)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)

    alert_type = Column(SQLEnum(AlertType), nullable=False, default=AlertType.WARNING)
    severity = Column(SQLEnum(AlertSeverity), nullable=False, default=AlertSeverity.MEDIUM)

    title = Column(String(300), nullable=False)
    message = Column(Text, nullable=True)

    # Generic entity reference
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)

    due_date = Column(DateTime, nullable=True)

    # Resolution
    resolved = Column(Boolean, default=False, nullable=False)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)

    # Relationships
    vehicle = relationship("Vehicle", foreign_keys=[vehicle_id])
    driver = relationship("Driver", foreign_keys=[driver_id])
    resolver = relationship("User", foreign_keys=[resolved_by])

    def __repr__(self):
        return f"<ComplianceAlert {self.id} {self.alert_type.value} — {self.title}>"
