# LR (Lorry Receipt) Model
# Transport ERP - PostgreSQL

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey, 
    DateTime, Text, Numeric, Date, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
import enum
from .base import Base, TimestampMixin, SoftDeleteMixin


class LRStatus(enum.Enum):
    DRAFT = "draft"
    GENERATED = "generated"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    POD_RECEIVED = "pod_received"
    CANCELLED = "cancelled"


class PaymentMode(enum.Enum):
    TO_PAY = "to_pay"
    PAID = "paid"
    TO_BE_BILLED = "to_be_billed"


class LR(Base, TimestampMixin, SoftDeleteMixin):
    """LR (Lorry Receipt / Consignment Note) model."""
    
    __tablename__ = "lrs"
    
    # LR Number
    lr_number = Column(String(30), unique=True, nullable=False, index=True)
    lr_date = Column(Date, nullable=False)
    
    # Job Reference
    job_id = Column(Integer, ForeignKey('jobs.id'), nullable=False)
    
    # Consignor (Sender)
    consignor_name = Column(String(200), nullable=False)
    consignor_address = Column(Text, nullable=True)
    consignor_gstin = Column(String(20), nullable=True)
    consignor_phone = Column(String(20), nullable=True)
    
    # Consignee (Receiver)
    consignee_name = Column(String(200), nullable=False)
    consignee_address = Column(Text, nullable=True)
    consignee_gstin = Column(String(20), nullable=True)
    consignee_phone = Column(String(20), nullable=True)
    
    # Origin & Destination
    origin = Column(String(100), nullable=False)
    destination = Column(String(100), nullable=False)
    
    # Vehicle & Driver (assigned when trip is created)
    vehicle_id = Column(Integer, ForeignKey('vehicles.id'), nullable=True)
    driver_id = Column(Integer, ForeignKey('drivers.id'), nullable=True)
    
    # Trip Reference
    trip_id = Column(Integer, ForeignKey('trips.id'), nullable=True)
    
    # E-way Bill
    eway_bill_number = Column(String(20), nullable=True, index=True)
    eway_bill_date = Column(Date, nullable=True)
    eway_bill_valid_until = Column(DateTime, nullable=True)
    
    # Payment
    payment_mode = Column(SQLEnum(PaymentMode), default=PaymentMode.TO_BE_BILLED)
    freight_amount = Column(Numeric(12, 2), default=0)
    loading_charges = Column(Numeric(10, 2), default=0)
    unloading_charges = Column(Numeric(10, 2), default=0)
    detention_charges = Column(Numeric(10, 2), default=0)
    other_charges = Column(Numeric(10, 2), default=0)
    total_freight = Column(Numeric(12, 2), default=0)
    
    # Insurance
    insurance_company = Column(String(100), nullable=True)
    insurance_policy_number = Column(String(50), nullable=True)
    insurance_amount = Column(Numeric(15, 2), nullable=True)
    
    # Declared Value
    declared_value = Column(Numeric(15, 2), nullable=True)
    
    # Status
    status = Column(SQLEnum(LRStatus), default=LRStatus.DRAFT)
    
    # Delivery
    delivered_at = Column(DateTime, nullable=True)
    delivery_remarks = Column(Text, nullable=True)
    received_by = Column(String(100), nullable=True)
    
    # POD (Proof of Delivery)
    pod_uploaded = Column(Boolean, default=False)
    pod_upload_date = Column(DateTime, nullable=True)
    pod_file_url = Column(String(500), nullable=True)
    pod_verified = Column(Boolean, default=False)
    pod_verified_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    
    # Remarks
    remarks = Column(Text, nullable=True)
    special_instructions = Column(Text, nullable=True)
    
    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    
    # Relationships
    job = relationship("Job", back_populates="lrs")
    vehicle = relationship("Vehicle")
    driver = relationship("Driver")
    trip = relationship("Trip", back_populates="lrs")
    items = relationship("LRItem", back_populates="lr", cascade="all, delete-orphan")
    documents = relationship("LRDocument", back_populates="lr", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<LR {self.lr_number}>"


class LRItem(Base, TimestampMixin):
    """Line items in LR (multiple packages/materials)."""
    
    __tablename__ = "lr_items"
    
    lr_id = Column(Integer, ForeignKey('lrs.id', ondelete='CASCADE'), nullable=False)
    
    # Item Details
    item_number = Column(Integer, nullable=False)  # Sequence number
    description = Column(String(255), nullable=False)
    hsn_code = Column(String(20), nullable=True)
    
    # Quantity
    packages = Column(Integer, default=1)
    package_type = Column(String(50), nullable=True)  # bags, boxes, pallets, drums
    quantity = Column(Numeric(12, 3), nullable=True)
    quantity_unit = Column(String(20), nullable=True)  # kgs, tons, ltrs
    
    # Weight
    actual_weight = Column(Numeric(12, 3), nullable=True)
    charged_weight = Column(Numeric(12, 3), nullable=True)
    
    # Value
    rate = Column(Numeric(12, 2), nullable=True)
    amount = Column(Numeric(12, 2), nullable=True)
    
    # Relationships
    lr = relationship("LR", back_populates="items")


class LRDocument(Base, TimestampMixin):
    """Documents attached to LR."""
    
    __tablename__ = "lr_documents"
    
    lr_id = Column(Integer, ForeignKey('lrs.id', ondelete='CASCADE'), nullable=False)
    document_type = Column(String(50), nullable=False)  # invoice, packing_list, eway_bill, pod
    document_number = Column(String(50), nullable=True)
    file_url = Column(String(500), nullable=True)
    uploaded_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    remarks = Column(Text, nullable=True)
    
    # Relationships
    lr = relationship("LR", back_populates="documents")
