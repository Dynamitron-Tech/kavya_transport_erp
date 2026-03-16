# Vehicle Model
# Transport ERP - PostgreSQL

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey, 
    DateTime, Text, Numeric, Date, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
import enum
from .base import Base, TimestampMixin, SoftDeleteMixin


class VehicleType(enum.Enum):
    TRUCK = "truck"
    TRAILER = "trailer"
    TANKER = "tanker"
    CONTAINER = "container"
    LCV = "lcv"
    MINI_TRUCK = "mini_truck"


class VehicleStatus(enum.Enum):
    AVAILABLE = "available"
    ON_TRIP = "on_trip"
    MAINTENANCE = "maintenance"
    BREAKDOWN = "breakdown"
    INACTIVE = "inactive"


class OwnershipType(enum.Enum):
    OWNED = "owned"
    LEASED = "leased"
    ATTACHED = "attached"
    MARKET = "market"


class Vehicle(Base, TimestampMixin, SoftDeleteMixin):
    """Vehicle/Fleet model."""
    
    __tablename__ = "vehicles"
    
    # Basic Info
    registration_number = Column(String(20), unique=True, nullable=False, index=True)
    vehicle_type = Column(SQLEnum(VehicleType), nullable=False)
    make = Column(String(50), nullable=True)  # TATA, Ashok Leyland, etc.
    model = Column(String(100), nullable=True)
    year_of_manufacture = Column(Integer, nullable=True)
    chassis_number = Column(String(50), nullable=True)
    engine_number = Column(String(50), nullable=True)
    
    # Capacity
    capacity_tons = Column(Numeric(10, 2), nullable=True)
    capacity_volume = Column(Numeric(10, 2), nullable=True)  # cubic feet
    num_axles = Column(Integer, default=2)
    num_tyres = Column(Integer, nullable=True)
    
    # Ownership
    ownership_type = Column(SQLEnum(OwnershipType), default=OwnershipType.OWNED)
    owner_name = Column(String(200), nullable=True)
    owner_phone = Column(String(20), nullable=True)
    
    # Status
    status = Column(SQLEnum(VehicleStatus), default=VehicleStatus.AVAILABLE)
    current_location = Column(String(255), nullable=True)
    current_latitude = Column(Numeric(10, 8), nullable=True)
    current_longitude = Column(Numeric(11, 8), nullable=True)
    odometer_reading = Column(Numeric(12, 2), default=0)
    
    # Fuel
    fuel_type = Column(String(20), default='diesel')
    fuel_tank_capacity = Column(Numeric(10, 2), nullable=True)
    mileage_per_litre = Column(Numeric(6, 2), nullable=True)
    
    # GPS Device
    gps_device_id = Column(String(100), nullable=True)
    gps_provider = Column(String(50), nullable=True)
    
    # Fitness & Permits
    fitness_valid_until = Column(Date, nullable=True)
    permit_valid_until = Column(Date, nullable=True)
    insurance_valid_until = Column(Date, nullable=True)
    puc_valid_until = Column(Date, nullable=True)
    
    # Financial
    purchase_value = Column(Numeric(15, 2), nullable=True)
    current_value = Column(Numeric(15, 2), nullable=True)
    
    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    
    # Relationships
    documents = relationship("VehicleDocument", back_populates="vehicle", cascade="all, delete-orphan")
    maintenance_records = relationship("VehicleMaintenance", back_populates="vehicle")
    trips = relationship("Trip", back_populates="vehicle")
    tyres = relationship("VehicleTyre", back_populates="vehicle")
    
    def __repr__(self):
        return f"<Vehicle {self.registration_number}>"


class VehicleDocument(Base, TimestampMixin):
    """Vehicle documents storage."""
    
    __tablename__ = "vehicle_documents"
    
    vehicle_id = Column(Integer, ForeignKey('vehicles.id', ondelete='CASCADE'), nullable=False)
    document_type = Column(String(50), nullable=False)  # rc, insurance, permit, fitness, puc
    document_number = Column(String(100), nullable=True)
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    file_url = Column(String(500), nullable=True)
    remarks = Column(Text, nullable=True)
    is_verified = Column(Boolean, default=False)
    verified_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    
    # Relationships
    vehicle = relationship("Vehicle", back_populates="documents")


class VehicleMaintenance(Base, TimestampMixin):
    """Vehicle maintenance records."""
    
    __tablename__ = "vehicle_maintenance"
    
    vehicle_id = Column(Integer, ForeignKey('vehicles.id', ondelete='CASCADE'), nullable=False)
    maintenance_type = Column(String(50), nullable=False)  # scheduled, breakdown, accident
    service_type = Column(String(100), nullable=True)  # oil_change, tyre_change, etc.
    description = Column(Text, nullable=True)
    odometer_at_service = Column(Numeric(12, 2), nullable=True)
    service_date = Column(Date, nullable=False)
    next_service_date = Column(Date, nullable=True)
    next_service_km = Column(Numeric(12, 2), nullable=True)
    vendor_name = Column(String(200), nullable=True)
    invoice_number = Column(String(50), nullable=True)
    parts_cost = Column(Numeric(12, 2), default=0)
    labor_cost = Column(Numeric(12, 2), default=0)
    total_cost = Column(Numeric(12, 2), default=0)
    status = Column(String(20), default='completed')  # pending, in_progress, completed
    
    # Relationships
    vehicle = relationship("Vehicle", back_populates="maintenance_records")


class VehicleTyre(Base, TimestampMixin):
    """Tyre management for vehicles."""
    
    __tablename__ = "vehicle_tyres"
    
    vehicle_id = Column(Integer, ForeignKey('vehicles.id', ondelete='CASCADE'), nullable=False)
    tyre_number = Column(String(50), nullable=False)  # Serial number
    position = Column(String(20), nullable=False)  # FL, FR, RL1, RR1, etc.
    brand = Column(String(50), nullable=True)
    size = Column(String(20), nullable=True)
    purchase_date = Column(Date, nullable=True)
    purchase_cost = Column(Numeric(10, 2), nullable=True)
    km_at_fitment = Column(Numeric(12, 2), nullable=True)
    current_km = Column(Numeric(12, 2), nullable=True)
    condition = Column(String(20), default='good')  # new, good, average, worn, replaced
    is_active = Column(Boolean, default=True)
    
    # Relationships
    vehicle = relationship("Vehicle", back_populates="tyres")
