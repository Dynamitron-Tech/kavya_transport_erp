# Client Model
# Transport ERP - PostgreSQL

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey, 
    DateTime, Text, Numeric
)
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin, SoftDeleteMixin


class Client(Base, TimestampMixin, SoftDeleteMixin):
    """Client/Customer model for business relationships."""
    
    __tablename__ = "clients"
    
    # Basic Info
    name = Column(String(200), nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False)
    client_type = Column(String(50), default='regular')  # regular, premium, contract
    legal_name = Column(String(250), nullable=True)
    trade_name = Column(String(250), nullable=True)
    nature_of_business = Column(String(200), nullable=True)
    designation = Column(String(100), nullable=True)
    
    # Contact Info
    contact_person = Column(String(200), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    alt_phone = Column(String(20), nullable=True)
    website = Column(String(255), nullable=True)
    industry = Column(String(100), nullable=True)
    company_size = Column(String(50), nullable=True)
    
    # Address
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=True)
    country = Column(String(100), default='India')
    
    # GST & Tax
    gstin = Column(String(20), nullable=True, index=True)
    pan = Column(String(15), nullable=True)
    gst_state_code = Column(String(5), nullable=True)
    tan = Column(String(15), nullable=True)
    reg_type = Column(String(50), nullable=True)
    date_of_liability = Column(String(20), nullable=True)
    assessment_year = Column(String(10), nullable=True)
    tds_rate = Column(String(10), nullable=True)
    tax_exempt = Column(Boolean, default=False)

    # TDS (Form 16A) Details
    name_deductor = Column(String(200), nullable=True)
    name_deductee = Column(String(200), nullable=True)
    pan_deductor = Column(String(15), nullable=True)
    pan_deductee = Column(String(15), nullable=True)
    nature_payment = Column(String(200), nullable=True)
    tds_amount = Column(String(30), nullable=True)
    
    # UPI / Payment
    upi_id = Column(String(60), nullable=True)   # VPA e.g. "9876543210@okaxis"

    # Financial
    credit_limit = Column(Numeric(15, 2), default=0)
    credit_days = Column(Integer, default=30)
    outstanding_amount = Column(Numeric(15, 2), default=0)
    invoice_frequency = Column(String(30), default='per_order')  # per_order, weekly, monthly, quarterly
    payment_method = Column(String(30), default='bank_transfer')  # bank_transfer, upi, cheque, cash
    bank_account = Column(String(30), nullable=True)
    ifsc_code = Column(String(15), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    status = Column(String(20), default='active')  # active, suspended, blacklisted
    
    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    
    # TMS Automation (SCH-02)
    do_not_remind = Column(Boolean, default=False)

    # Audit
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    
    # Relationships
    contacts = relationship("ClientContact", back_populates="client", cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="client")
    invoices = relationship("Invoice", back_populates="client")
    
    def __repr__(self):
        return f"<Client {self.name}>"


class ClientContact(Base, TimestampMixin):
    """Client contact persons."""
    
    __tablename__ = "client_contacts"
    
    client_id = Column(Integer, ForeignKey('clients.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(100), nullable=False)
    designation = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    is_primary = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    client = relationship("Client", back_populates="contacts")


class ClientAddress(Base, TimestampMixin):
    """Multiple addresses for clients (pickup/delivery points)."""
    
    __tablename__ = "client_addresses"
    
    client_id = Column(Integer, ForeignKey('clients.id', ondelete='CASCADE'), nullable=False)
    address_type = Column(String(50), default='delivery')  # billing, delivery, pickup, warehouse
    label = Column(String(100), nullable=True)  # Custom label like "Main Warehouse"
    address_line1 = Column(String(255), nullable=False)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    pincode = Column(String(10), nullable=False)
    latitude = Column(Numeric(10, 8), nullable=True)
    longitude = Column(Numeric(11, 8), nullable=True)
    contact_name = Column(String(100), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    client = relationship("Client")
