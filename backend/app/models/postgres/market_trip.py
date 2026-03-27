# Market Trip Model
# Transport ERP - PostgreSQL

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey,
    DateTime, Text, Numeric, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
import enum
from .base import Base, TimestampMixin, SoftDeleteMixin


class MarketTripStatus(enum.Enum):
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    SETTLED = "SETTLED"
    CANCELLED = "CANCELLED"


class MarketTrip(Base, TimestampMixin, SoftDeleteMixin):
    """Market Trip - hired/contracted truck trips via suppliers/brokers."""

    __tablename__ = "market_trips"

    # Linked job
    job_id = Column(Integer, ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False)

    # Supplier
    supplier_id = Column(Integer, ForeignKey('suppliers.id'), nullable=False)

    # Vehicle & Driver (market vehicles may not exist in our vehicles table)
    vehicle_registration = Column(String(20), nullable=True)
    driver_name = Column(String(200), nullable=True)
    driver_phone = Column(String(20), nullable=True)
    driver_license = Column(String(30), nullable=True)

    # Rates
    client_rate = Column(Numeric(15, 2), nullable=False)  # What client pays us
    contractor_rate = Column(Numeric(15, 2), nullable=False)  # What we pay supplier
    advance_amount = Column(Numeric(15, 2), default=0)
    loading_charges = Column(Numeric(12, 2), default=0)
    unloading_charges = Column(Numeric(12, 2), default=0)
    other_charges = Column(Numeric(12, 2), default=0)

    # Auto-generated purchase invoice
    purchase_invoice_id = Column(Integer, ForeignKey('invoices.id'), nullable=True)

    # TDS (194C deduction)
    tds_rate = Column(Numeric(5, 2), default=1.0)
    tds_amount = Column(Numeric(15, 2), default=0)
    net_payable = Column(Numeric(15, 2), default=0)

    # Status
    status = Column(SQLEnum(MarketTripStatus), default=MarketTripStatus.PENDING, nullable=False)

    # Timestamps for lifecycle
    assigned_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    settled_at = Column(DateTime, nullable=True)
    settlement_reference = Column(String(100), nullable=True)
    settlement_remarks = Column(Text, nullable=True)

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)

    # Relationships
    job = relationship("Job", backref="market_trips")
    supplier = relationship("Supplier", back_populates="market_trips")
    purchase_invoice = relationship("Invoice", foreign_keys=[purchase_invoice_id])
    creator = relationship("User", foreign_keys=[created_by])

    @property
    def margin(self):
        """Profit margin = client_rate - contractor_rate"""
        if self.client_rate and self.contractor_rate:
            return float(self.client_rate) - float(self.contractor_rate)
        return 0

    @property
    def margin_pct(self):
        """Margin percentage"""
        if self.client_rate and float(self.client_rate) > 0:
            return (self.margin / float(self.client_rate)) * 100
        return 0

    def __repr__(self):
        return f"<MarketTrip job={self.job_id} supplier={self.supplier_id}>"
