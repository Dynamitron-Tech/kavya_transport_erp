# Fuel Pump Management Models
# Transport ERP - PostgreSQL

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey,
    DateTime, Text, Numeric, Date, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
import enum
from .base import Base, TimestampMixin, SoftDeleteMixin


class FuelType(enum.Enum):
    DIESEL = "DIESEL"
    PETROL = "PETROL"
    CNG = "CNG"
    DEF = "DEF"


class TransactionType(enum.Enum):
    TANKER_REFILL = "TANKER_REFILL"
    MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT"
    ISSUE = "ISSUE"
    LOSS = "LOSS"


class TheftAlertStatus(enum.Enum):
    OPEN = "OPEN"
    INVESTIGATING = "INVESTIGATING"
    CONFIRMED = "CONFIRMED"
    FALSE_ALARM = "FALSE_ALARM"
    RESOLVED = "RESOLVED"


class DepotFuelTank(Base, TimestampMixin, SoftDeleteMixin):
    """Fuel tank at a depot/branch location."""

    __tablename__ = "depot_fuel_tanks"

    name = Column(String(100), nullable=False)
    fuel_type = Column(SQLEnum(FuelType), nullable=False, default=FuelType.DIESEL)
    capacity_litres = Column(Numeric(12, 2), nullable=False)
    current_stock_litres = Column(Numeric(12, 2), nullable=False, default=0)
    min_stock_alert = Column(Numeric(12, 2), nullable=True)
    location = Column(String(255), nullable=True)

    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)

    # Relationships
    fuel_issues = relationship("FuelIssue", back_populates="tank", cascade="all, delete-orphan")
    stock_transactions = relationship("FuelStockTransaction", back_populates="tank", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<DepotFuelTank {self.name}>"


class FuelIssue(Base, TimestampMixin):
    """Individual fuel dispensing record to a vehicle/driver."""

    __tablename__ = "fuel_issues"

    # References
    tank_id = Column(Integer, ForeignKey('depot_fuel_tanks.id'), nullable=False)
    vehicle_id = Column(Integer, ForeignKey('vehicles.id'), nullable=False)
    driver_id = Column(Integer, ForeignKey('drivers.id'), nullable=True)
    trip_id = Column(Integer, ForeignKey('trips.id'), nullable=True)

    # Fuel details
    fuel_type = Column(SQLEnum(FuelType), nullable=False, default=FuelType.DIESEL)
    quantity_litres = Column(Numeric(10, 2), nullable=False)
    rate_per_litre = Column(Numeric(8, 2), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)

    # Odometer
    odometer_reading = Column(Numeric(12, 2), nullable=True)

    # Dispensing info
    issued_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    issued_at = Column(DateTime, nullable=False)
    receipt_number = Column(String(50), nullable=True)
    remarks = Column(Text, nullable=True)

    # Theft detection
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(Text, nullable=True)

    # Multi-tenant
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)

    # Relationships
    tank = relationship("DepotFuelTank", back_populates="fuel_issues")
    vehicle = relationship("Vehicle", foreign_keys=[vehicle_id])
    driver = relationship("Driver", foreign_keys=[driver_id])
    trip = relationship("Trip", foreign_keys=[trip_id])
    issuer = relationship("User", foreign_keys=[issued_by])

    def __repr__(self):
        return f"<FuelIssue {self.id} - {self.quantity_litres}L>"


class FuelStockTransaction(Base, TimestampMixin):
    """Fuel stock movement log (refills, adjustments, losses)."""

    __tablename__ = "fuel_stock_transactions"

    tank_id = Column(Integer, ForeignKey('depot_fuel_tanks.id'), nullable=False)
    transaction_type = Column(SQLEnum(TransactionType), nullable=False)

    quantity_litres = Column(Numeric(10, 2), nullable=False)
    rate_per_litre = Column(Numeric(8, 2), nullable=True)
    total_amount = Column(Numeric(12, 2), nullable=True)

    stock_before = Column(Numeric(12, 2), nullable=False)
    stock_after = Column(Numeric(12, 2), nullable=False)

    reference_number = Column(String(100), nullable=True)  # Tanker bill, etc.
    remarks = Column(Text, nullable=True)

    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)

    # Multi-tenant
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)

    # Relationships
    tank = relationship("DepotFuelTank", back_populates="stock_transactions")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<FuelStockTransaction {self.transaction_type.value} {self.quantity_litres}L>"


class FuelTheftAlert(Base, TimestampMixin):
    """Fuel theft/anomaly detection alerts."""

    __tablename__ = "fuel_theft_alerts"

    fuel_issue_id = Column(Integer, ForeignKey('fuel_issues.id'), nullable=True)
    vehicle_id = Column(Integer, ForeignKey('vehicles.id'), nullable=False)
    driver_id = Column(Integer, ForeignKey('drivers.id'), nullable=True)

    alert_type = Column(String(50), nullable=False)  # e.g., "excessive_consumption", "odometer_mismatch"
    severity = Column(String(20), nullable=False, default="warning")  # info, warning, critical
    description = Column(Text, nullable=False)

    expected_litres = Column(Numeric(10, 2), nullable=True)
    actual_litres = Column(Numeric(10, 2), nullable=True)
    deviation_pct = Column(Numeric(6, 2), nullable=True)

    status = Column(SQLEnum(TheftAlertStatus), default=TheftAlertStatus.OPEN)
    resolved_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)

    # Multi-tenant
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)

    # Relationships
    fuel_issue = relationship("FuelIssue", foreign_keys=[fuel_issue_id])
    vehicle = relationship("Vehicle", foreign_keys=[vehicle_id])
    driver = relationship("Driver", foreign_keys=[driver_id])
    resolver = relationship("User", foreign_keys=[resolved_by])

    def __repr__(self):
        return f"<FuelTheftAlert {self.alert_type} - {self.status.value}>"
