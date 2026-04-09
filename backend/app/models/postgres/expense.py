# Company Expense Model
# Covers ALL outgoing company payments: salaries, rent, insurance, permits,
# field GPay expenses, and driver advances.
# Transport ERP - PostgreSQL

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey,
    DateTime, Text, Date, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
import enum
from .base import Base, TimestampMixin


class ExpenseCategory(str, enum.Enum):
    MARKET_VEHICLE_RENT = "market_vehicle_rent"
    DRIVER_SALARY       = "driver_salary"
    DRIVER_ADVANCE      = "driver_advance"
    STAFF_SALARY        = "staff_salary"
    TAX                 = "tax"
    INSURANCE           = "insurance"
    PERMIT_COMPLIANCE   = "permit_compliance"
    VEHICLE_SPARE_PART  = "vehicle_spare_part"
    LOADING_UNLOADING   = "loading_unloading"
    MISC_FIELD          = "misc_field"
    FUEL                = "fuel"


class PaymentMethod(str, enum.Enum):
    NETBANKING      = "netbanking"      # company NEFT/IMPS/RTGS transfer
    GPAY_UPI        = "gpay_upi"        # field payment via UPI
    RAZORPAY        = "razorpay"        # client invoice payment (incoming)
    RAZORPAY_PAYOUT = "razorpay_payout" # driver advance payout (outgoing via Razorpay X)
    CASH            = "cash"
    CHEQUE          = "cheque"


class ApprovalStatus(str, enum.Enum):
    PENDING  = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Expense(Base, TimestampMixin):
    """
    Company-level expense record.

    Payment routing rules (enforced in API layer):
      - NETBANKING  → market_vehicle_rent, driver_salary, staff_salary,
                      tax, insurance, permit_compliance
      - GPAY_UPI    → vehicle_spare_part (>₹3k), loading_unloading (>₹4k),
                      misc_field
      - RAZORPAY_PAYOUT → driver_advance (₹1,500 per trip via Razorpay X)
      - CASH/CHEQUE → small amounts, manual entries

    Driver advance (₹1,500) is issued BEFORE the trip starts by admin/accountant.
    Field expenses (GPay) are submitted by the driver DURING the trip.
    """

    __tablename__ = "company_expenses"

    # Category & method
    expense_category = Column(SQLEnum(ExpenseCategory), nullable=False, index=True)
    payment_method   = Column(SQLEnum(PaymentMethod), nullable=False)

    # Amount — always stored in paise (integer) to avoid floating point issues
    amount_paise = Column(Integer, nullable=False)

    # Description
    description = Column(String(500), nullable=True)

    # Date
    expense_date = Column(Date, nullable=False, index=True)

    # Links to business entities
    vehicle_id = Column(Integer, ForeignKey('vehicles.id'), nullable=True)
    driver_id  = Column(Integer, ForeignKey('drivers.id'), nullable=True)
    trip_id    = Column(Integer, ForeignKey('trips.id'), nullable=True)

    # GPay / UPI proof
    upi_ref_number    = Column(String(100), nullable=True)  # GPay transaction ID
    receipt_image_url = Column(String(500), nullable=True)  # S3 URL of photo receipt

    # Netbanking proof
    netbanking_ref    = Column(String(100), nullable=True)  # NEFT/IMPS/RTGS UTR
    bank_name         = Column(String(100), nullable=True)

    # Banking entry link (two-way reconciliation)
    banking_entry_id  = Column(Integer, ForeignKey('banking_entries.id'), nullable=True)

    # Approval workflow
    approval_status = Column(
        SQLEnum(ApprovalStatus), default=ApprovalStatus.PENDING, nullable=False, index=True
    )
    rejection_reason = Column(Text, nullable=True)
    approved_by      = Column(Integer, ForeignKey('users.id'), nullable=True)
    approved_at      = Column(DateTime, nullable=True)

    # Razorpay payout (driver advance only)
    razorpay_payout_id = Column(String(100), nullable=True)

    # Audit
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    branch_id  = Column(Integer, ForeignKey('branches.id'), nullable=True)

    # Vendor / payee name (for rent, salary, supplier payments)
    payee_name = Column(String(200), nullable=True)

    # Period (for recurring payments: salary month, insurance period, etc.)
    period_from = Column(Date, nullable=True)
    period_to   = Column(Date, nullable=True)

    # Relationships
    vehicle = relationship("Vehicle", foreign_keys=[vehicle_id])
    driver  = relationship("Driver",  foreign_keys=[driver_id])
    trip    = relationship("Trip",    foreign_keys=[trip_id])

    def __repr__(self):
        return (
            f"<Expense id={self.id} "
            f"category={self.expense_category} "
            f"amount=₹{self.amount_paise/100:.0f} "
            f"status={self.approval_status}>"
        )
