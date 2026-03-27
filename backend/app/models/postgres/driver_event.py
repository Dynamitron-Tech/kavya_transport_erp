# Driver Event Model
# Transport ERP — Phase B: AIS-140 + Geofencing / Phase C: Driver Scoring

import enum
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum as SQLEnum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin


class DriverEventType(enum.Enum):
    HARSH_BRAKE = "HARSH_BRAKE"
    HARSH_ACCEL = "HARSH_ACCEL"
    OVERSPEED = "OVERSPEED"
    NIGHT_DRIVING = "NIGHT_DRIVING"
    EXCESSIVE_IDLE = "EXCESSIVE_IDLE"
    GEOFENCE_BREACH = "GEOFENCE_BREACH"
    UNAUTHORIZED_HALT = "UNAUTHORIZED_HALT"
    SOS = "SOS"


class DriverEvent(Base, TimestampMixin):
    __tablename__ = "driver_events"

    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)

    event_type = Column(SQLEnum(DriverEventType), nullable=False, index=True)
    severity = Column(Integer, default=1, nullable=False)  # 1-5

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_name = Column(String(300), nullable=True)
    speed_kmph = Column(Float, nullable=True)

    # Raw data / extra context
    details = Column(JSON, nullable=True)

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)

    # Relationships
    driver = relationship("Driver", foreign_keys=[driver_id])
    trip = relationship("Trip", foreign_keys=[trip_id])
    vehicle = relationship("Vehicle", foreign_keys=[vehicle_id])

    def __repr__(self):
        return f"<DriverEvent {self.id} {self.event_type.value} driver={self.driver_id}>"
