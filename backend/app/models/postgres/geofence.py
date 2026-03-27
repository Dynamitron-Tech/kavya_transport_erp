# Geofence Model
# Transport ERP — Phase B: AIS-140 + Geofencing

import enum
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Numeric, Text, Enum as SQLEnum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin, SoftDeleteMixin


class GeofenceType(enum.Enum):
    ROUTE = "ROUTE"
    ZONE = "ZONE"
    LOADING = "LOADING"
    UNLOADING = "UNLOADING"
    FUEL_STATION = "FUEL_STATION"
    RESTRICTED = "RESTRICTED"


class Geofence(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "geofences"

    name = Column(String(200), nullable=False)
    geofence_type = Column(SQLEnum(GeofenceType), nullable=False, default=GeofenceType.ZONE)

    # Optional link to trip or route
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)

    # Polygon definition — array of {lat, lng} points
    polygon = Column(JSON, nullable=True)

    # Circular geofence (simpler alternative)
    center_lat = Column(Float, nullable=True)
    center_lng = Column(Float, nullable=True)
    radius_meters = Column(Float, nullable=True)

    # Alert thresholds
    alert_threshold_meters = Column(Float, default=500)
    speed_limit_kmph = Column(Float, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)

    # Relationships
    trip = relationship("Trip", foreign_keys=[trip_id])
    route = relationship("Route", foreign_keys=[route_id])

    def __repr__(self):
        return f"<Geofence {self.id} {self.name} ({self.geofence_type.value})>"
