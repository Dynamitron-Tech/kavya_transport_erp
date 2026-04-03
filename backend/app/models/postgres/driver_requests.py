import enum
from sqlalchemy import Column, Integer, String, Date, DateTime, Text, ForeignKey, Numeric
from sqlalchemy import Enum as SQLEnum
from datetime import datetime
from .base import Base, TimestampMixin


class LeaveStatusEnum(enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class AdvanceStatusEnum(enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class DriverLeave(Base, TimestampMixin):
    __tablename__ = "driver_leaves"

    driver_id   = Column(Integer, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False, index=True)
    start_date  = Column(Date, nullable=False)
    end_date    = Column(Date, nullable=False)
    reason      = Column(Text, nullable=True)
    status      = Column(SQLEnum(LeaveStatusEnum), default=LeaveStatusEnum.PENDING, nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(Text, nullable=True)


class DriverAdvanceRequest(Base, TimestampMixin):
    __tablename__ = "driver_advance_requests"

    driver_id   = Column(Integer, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False, index=True)
    trip_id     = Column(Integer, ForeignKey("trips.id", ondelete="SET NULL"), nullable=True, index=True)
    amount      = Column(Numeric(10, 2), nullable=False, default=1500)
    status      = Column(SQLEnum(AdvanceStatusEnum), default=AdvanceStatusEnum.PENDING, nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(Text, nullable=True)


class DriverSalaryAdvanceRequest(Base, TimestampMixin):
    __tablename__ = "driver_salary_advance_requests"

    driver_id   = Column(Integer, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False, index=True)
    amount      = Column(Numeric(10, 2), nullable=False)
    status      = Column(SQLEnum(AdvanceStatusEnum), default=AdvanceStatusEnum.PENDING, nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(Text, nullable=True)
