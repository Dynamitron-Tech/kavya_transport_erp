# Supplier Model
# Transport ERP - PostgreSQL

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey,
    DateTime, Text, Numeric, Enum as SQLEnum, JSON
)
from sqlalchemy.orm import relationship
import enum
from .base import Base, TimestampMixin, SoftDeleteMixin


class SupplierType(enum.Enum):
    BROKER = "BROKER"
    FLEET_OWNER = "FLEET_OWNER"
    INDIVIDUAL = "INDIVIDUAL"


class Supplier(Base, TimestampMixin, SoftDeleteMixin):
    """Supplier/Contractor model - brokers or fleet owners providing market trucks."""

    __tablename__ = "suppliers"

    name = Column(String(200), nullable=False)
    code = Column(String(30), unique=True, nullable=False, index=True)
    supplier_type = Column(SQLEnum(SupplierType), default=SupplierType.BROKER, nullable=False)

    # Contact
    contact_person = Column(String(200), nullable=True)
    phone = Column(String(20), nullable=False)
    email = Column(String(200), nullable=True)

    # KYC
    pan = Column(String(10), nullable=True)
    gstin = Column(String(15), nullable=True)
    aadhaar = Column(String(12), nullable=True)

    # Address
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=True)

    # Banking
    bank_account_number = Column(String(30), nullable=True)
    bank_ifsc = Column(String(11), nullable=True)
    bank_name = Column(String(100), nullable=True)

    # Rates & TDS
    rate_card = Column(JSON, nullable=True)  # {route_code: rate, ...}
    tds_applicable = Column(Boolean, default=True)
    tds_rate = Column(Numeric(5, 2), default=1.0)  # 194C: 1% for individuals, 2% for companies
    credit_limit = Column(Numeric(15, 2), nullable=True)
    credit_days = Column(Integer, default=30)

    is_active = Column(Boolean, default=True, nullable=False)

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)

    # Relationships
    vehicles = relationship("SupplierVehicle", back_populates="supplier")
    market_trips = relationship("MarketTrip", back_populates="supplier")

    def __repr__(self):
        return f"<Supplier {self.code} - {self.name}>"


class SupplierVehicle(Base, TimestampMixin):
    """Many-to-many link: suppliers to their vehicles."""

    __tablename__ = "supplier_vehicles"

    supplier_id = Column(Integer, ForeignKey('suppliers.id', ondelete='CASCADE'), nullable=False)
    vehicle_id = Column(Integer, ForeignKey('vehicles.id', ondelete='CASCADE'), nullable=True)
    vehicle_registration = Column(String(20), nullable=True)  # For vehicles not in our system
    vehicle_type = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)

    # Relationships
    supplier = relationship("Supplier", back_populates="vehicles")
    vehicle = relationship("Vehicle")
