# Driver Model
# Transport ERP - PostgreSQL

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey, 
    DateTime, Text, Numeric, Date, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
import enum
from .base import Base, TimestampMixin, SoftDeleteMixin


class DriverStatus(enum.Enum):
    AVAILABLE = "available"
    ON_TRIP = "on_trip"
    ON_LEAVE = "on_leave"
    SUSPENDED = "suspended"
    INACTIVE = "inactive"


class LicenseType(enum.Enum):
    LMV = "lmv"
    HMV = "hmv"
    HGMV = "hgmv"
    TRANSPORT = "transport"


class Driver(Base, TimestampMixin, SoftDeleteMixin):
    """Driver model."""
    
    __tablename__ = "drivers"
    
    # Link to user account (optional - drivers may or may not have app access)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    
    # Personal Info
    employee_code = Column(String(20), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=True)
    father_name = Column(String(200), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(10), nullable=True)
    blood_group = Column(String(5), nullable=True)
    photo_url = Column(String(500), nullable=True)
    
    # Contact
    phone = Column(String(20), nullable=False, index=True)
    alternate_phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    
    # Address
    permanent_address = Column(Text, nullable=True)
    current_address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=True)
    
    # ID Proofs
    aadhaar_number = Column(String(20), nullable=True)
    pan_number = Column(String(15), nullable=True)
    
    # Employment
    date_of_joining = Column(Date, nullable=True)
    date_of_leaving = Column(Date, nullable=True)
    designation = Column(String(50), default='driver')  # driver, senior_driver, helper
    
    # Status
    status = Column(SQLEnum(DriverStatus), default=DriverStatus.AVAILABLE)
    current_location = Column(String(255), nullable=True)
    
    # Salary & Payment
    salary_type = Column(String(20), default='monthly')  # monthly, per_trip, per_km
    base_salary = Column(Numeric(12, 2), nullable=True)
    per_km_rate = Column(Numeric(8, 2), nullable=True)
    bank_account_number = Column(String(30), nullable=True)
    bank_name = Column(String(100), nullable=True)
    bank_ifsc = Column(String(15), nullable=True)
    
    # Emergency Contact
    emergency_contact_name = Column(String(100), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    emergency_contact_relation = Column(String(50), nullable=True)
    
    # Training & Certification
    is_hazmat_certified = Column(Boolean, default=False)
    is_adr_certified = Column(Boolean, default=False)
    
    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    
    # Relationships
    user = relationship("User")
    licenses = relationship("DriverLicense", back_populates="driver", cascade="all, delete-orphan")
    documents = relationship("DriverDocument", back_populates="driver", cascade="all, delete-orphan")
    trips = relationship("Trip", back_populates="driver", foreign_keys="[Trip.driver_id]")
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name or ''}".strip()
    
    def __repr__(self):
        return f"<Driver {self.employee_code} - {self.full_name}>"


class DriverLicense(Base, TimestampMixin):
    """Driver license details."""
    
    __tablename__ = "driver_licenses"
    
    driver_id = Column(Integer, ForeignKey('drivers.id', ondelete='CASCADE'), nullable=False)
    license_number = Column(String(30), nullable=False, unique=True)
    license_type = Column(SQLEnum(LicenseType), nullable=False)
    issuing_authority = Column(String(100), nullable=True)
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=False)
    is_verified = Column(Boolean, default=False)
    file_url = Column(String(500), nullable=True)
    
    # Relationships
    driver = relationship("Driver", back_populates="licenses")


class DriverDocument(Base, TimestampMixin):
    """Driver documents storage."""
    
    __tablename__ = "driver_documents"
    
    driver_id = Column(Integer, ForeignKey('drivers.id', ondelete='CASCADE'), nullable=False)
    document_type = Column(String(50), nullable=False)  # aadhaar, pan, photo, address_proof
    document_number = Column(String(50), nullable=True)
    file_url = Column(String(500), nullable=True)
    is_verified = Column(Boolean, default=False)
    verified_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    remarks = Column(Text, nullable=True)
    
    # Relationships
    driver = relationship("Driver", back_populates="documents")


class DriverAttendance(Base, TimestampMixin):
    """Driver attendance records (summary in PostgreSQL, detailed logs in MongoDB)."""
    
    __tablename__ = "driver_attendance"
    
    driver_id = Column(Integer, ForeignKey('drivers.id', ondelete='CASCADE'), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False)  # present, absent, half_day, on_trip, leave
    check_in_time = Column(DateTime, nullable=True)
    check_out_time = Column(DateTime, nullable=True)
    trip_id = Column(Integer, ForeignKey('trips.id'), nullable=True)
    remarks = Column(Text, nullable=True)
    
    # Relationships
    driver = relationship("Driver")
