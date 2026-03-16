# Job Model
# Transport ERP - PostgreSQL

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey, 
    DateTime, Text, Numeric, Date, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
import enum
from .base import Base, TimestampMixin, SoftDeleteMixin


class JobStatusEnum(enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"


class JobPriority(enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class ContractType(enum.Enum):
    SPOT = "spot"
    CONTRACT = "contract"
    DEDICATED = "dedicated"


class Job(Base, TimestampMixin, SoftDeleteMixin):
    """Job/Booking model - represents a transport contract/booking."""
    
    __tablename__ = "jobs"
    
    # Basic Info
    job_number = Column(String(30), unique=True, nullable=False, index=True)
    job_date = Column(Date, nullable=False)
    
    # Client
    client_id = Column(Integer, ForeignKey('clients.id'), nullable=False)
    client_ref_number = Column(String(50), nullable=True)  # Client's PO/Ref number
    
    # Route
    origin_address = Column(Text, nullable=False)
    origin_city = Column(String(100), nullable=False)
    origin_state = Column(String(100), nullable=True)
    origin_pincode = Column(String(10), nullable=True)
    origin_latitude = Column(Numeric(10, 8), nullable=True)
    origin_longitude = Column(Numeric(11, 8), nullable=True)
    
    destination_address = Column(Text, nullable=False)
    destination_city = Column(String(100), nullable=False)
    destination_state = Column(String(100), nullable=True)
    destination_pincode = Column(String(10), nullable=True)
    destination_latitude = Column(Numeric(10, 8), nullable=True)
    destination_longitude = Column(Numeric(11, 8), nullable=True)
    
    route_id = Column(Integer, ForeignKey('routes.id'), nullable=True)
    estimated_distance_km = Column(Numeric(10, 2), nullable=True)
    
    # Job Type & Priority
    contract_type = Column(SQLEnum(ContractType), default=ContractType.SPOT)
    priority = Column(SQLEnum(JobPriority), default=JobPriority.NORMAL)
    
    # Cargo/Material Details
    material_type = Column(String(100), nullable=True)
    material_description = Column(Text, nullable=True)
    quantity = Column(Numeric(12, 2), nullable=True)
    quantity_unit = Column(String(20), nullable=True)  # tons, kgs, pieces
    declared_value = Column(Numeric(15, 2), nullable=True)
    is_hazardous = Column(Boolean, default=False)
    
    # Vehicle Requirements
    vehicle_type_required = Column(String(50), nullable=True)
    num_vehicles_required = Column(Integer, default=1)
    special_requirements = Column(Text, nullable=True)
    
    # Scheduling
    pickup_date = Column(DateTime, nullable=True)
    expected_delivery_date = Column(DateTime, nullable=True)
    
    # Pricing
    rate_type = Column(String(20), default='per_trip')  # per_trip, per_ton, per_km
    agreed_rate = Column(Numeric(15, 2), nullable=True)
    loading_charges = Column(Numeric(12, 2), default=0)
    unloading_charges = Column(Numeric(12, 2), default=0)
    other_charges = Column(Numeric(12, 2), default=0)
    total_amount = Column(Numeric(15, 2), nullable=True)
    
    # Budget from route
    budgeted_expense = Column(Numeric(15, 2), nullable=True)
    expected_profit = Column(Numeric(15, 2), nullable=True)
    
    # Status
    status = Column(SQLEnum(JobStatusEnum), default=JobStatusEnum.DRAFT)
    
    # Approval
    approved_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approval_remarks = Column(Text, nullable=True)
    
    # Completion
    completed_at = Column(DateTime, nullable=True)
    completion_remarks = Column(Text, nullable=True)
    
    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    
    # Relationships
    client = relationship("Client", back_populates="jobs")
    route = relationship("Route")
    lrs = relationship("LR", back_populates="job")
    trips = relationship("Trip", back_populates="job")
    approver = relationship("User", foreign_keys=[approved_by])
    creator = relationship("User", foreign_keys=[created_by])
    status_history = relationship("JobStatus", back_populates="job", order_by="JobStatus.created_at")
    
    def __repr__(self):
        return f"<Job {self.job_number}>"


class JobStatus(Base, TimestampMixin):
    """Job status change history."""
    
    __tablename__ = "job_status_history"
    
    job_id = Column(Integer, ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False)
    from_status = Column(String(30), nullable=True)
    to_status = Column(String(30), nullable=False)
    changed_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    remarks = Column(Text, nullable=True)
    
    # Relationships
    job = relationship("Job", back_populates="status_history")
    user = relationship("User")
