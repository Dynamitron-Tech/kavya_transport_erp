"""
Payment Models — Razorpay Payouts, Contacts, Schedules, Expense Submissions
For Finance Manager role — all outgoing payments.
"""

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey,
    DateTime, Text, Date, Float, JSON
)
from sqlalchemy.orm import relationship
from datetime import datetime

from .base import Base, TimestampMixin


class PaymentContact(Base, TimestampMixin):
    """Bank account / UPI details per person or vendor for Razorpay payouts."""
    __tablename__ = "payment_contacts"

    contact_type = Column(String(20), nullable=False, index=True)
    # 'driver' | 'staff' | 'vendor' | 'tax_authority'
    entity_id = Column(Integer, nullable=True)
    entity_name = Column(String(200), nullable=False)

    # Razorpay contact
    razorpay_contact_id = Column(String(100), nullable=True)
    razorpay_fund_account_id = Column(String(100), nullable=True)

    # Bank details
    bank_account_number = Column(String(50), nullable=True)
    bank_ifsc = Column(String(20), nullable=True)
    bank_name = Column(String(100), nullable=True)
    account_holder_name = Column(String(200), nullable=True)

    # UPI
    upi_id = Column(String(100), nullable=True)

    preferred_method = Column(String(20), default="imps")
    # 'imps' | 'neft' | 'upi'

    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)


class Payout(Base, TimestampMixin):
    """Every outgoing payment — salary, advance, expense, rent, tax, insurance, permit."""
    __tablename__ = "payouts"

    payout_type = Column(String(30), nullable=False, index=True)
    # 'salary' | 'advance' | 'expense' | 'rent' | 'tax' | 'insurance' | 'permit' | 'spare_part' | 'loading'

    contact_id = Column(Integer, ForeignKey("payment_contacts.id"), nullable=True)
    amount_paise = Column(Integer, nullable=False)
    currency = Column(String(3), default="INR")
    payment_method = Column(String(10), nullable=True)
    # 'imps' | 'neft' | 'upi'

    purpose = Column(String(50), nullable=True)
    narration = Column(String(200), nullable=True)

    # Business reference
    reference_type = Column(String(30), nullable=True)
    # 'trip' | 'expense' | 'salary_month' | 'vehicle' | 'invoice'
    reference_id = Column(String(100), nullable=True)

    # Razorpay
    razorpay_payout_id = Column(String(100), nullable=True, index=True)
    razorpay_fund_account_id = Column(String(100), nullable=True)
    utr = Column(String(100), nullable=True)
    razorpay_fees_paise = Column(Integer, nullable=True)
    razorpay_tax_paise = Column(Integer, nullable=True)

    # Status
    status = Column(String(20), default="pending", index=True)
    # pending | processing | processed | failed | cancelled | reversed | queued
    failure_reason = Column(String(500), nullable=True)
    processed_at = Column(DateTime, nullable=True)

    # Audit
    initiated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Employee / driver info (denormalized for quick listing)
    recipient_name = Column(String(200), nullable=True)
    recipient_bank_last4 = Column(String(4), nullable=True)

    # Relationships
    contact = relationship("PaymentContact", foreign_keys=[contact_id])


class PaymentSchedule(Base, TimestampMixin):
    """Recurring payment schedules — salary, rent, insurance, tax, permits."""
    __tablename__ = "payment_schedules"

    schedule_type = Column(String(30), nullable=False, index=True)
    # 'salary' | 'rent' | 'insurance' | 'tax' | 'permit'

    contact_id = Column(Integer, ForeignKey("payment_contacts.id"), nullable=True)
    amount_paise = Column(Integer, nullable=False)
    frequency = Column(String(20), nullable=False)
    # 'monthly' | 'annual' | 'quarterly' | 'one_time'

    due_day = Column(Integer, nullable=True)   # day of month (1-31) for monthly
    due_date = Column(Date, nullable=True)      # for annual / one-time

    description = Column(String(200), nullable=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    is_active = Column(Boolean, default=True)
    last_paid_at = Column(DateTime, nullable=True)
    next_due_date = Column(Date, nullable=True)

    # Vendor / payee
    payee_name = Column(String(200), nullable=True)

    # Relationships
    contact = relationship("PaymentContact", foreign_keys=[contact_id])
    vehicle = relationship("Vehicle", foreign_keys=[vehicle_id])


class ExpenseSubmission(Base, TimestampMixin):
    """GPay expense receipts submitted by drivers/staff for approval."""
    __tablename__ = "expense_submissions"

    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)

    category = Column(String(30), nullable=False)
    # 'spare_part' | 'loading' | 'fuel' | 'toll' | 'parking' | 'food' | 'other'

    amount_paise = Column(Integer, nullable=False)
    payment_method = Column(String(10), default="gpay")
    # 'gpay' | 'cash'

    upi_ref_number = Column(String(100), nullable=True)
    receipt_image_s3 = Column(String(500), nullable=True)
    description = Column(String(300), nullable=True)

    # Status
    status = Column(String(20), default="pending", index=True)
    # pending | approved | rejected | auto_approved | reimbursed

    rejection_reason = Column(String(300), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)

    # If reimbursement was paid via Razorpay
    payout_id = Column(Integer, ForeignKey("payouts.id"), nullable=True)

    submitted_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    trip = relationship("Trip", foreign_keys=[trip_id])
    vehicle = relationship("Vehicle", foreign_keys=[vehicle_id])
    payout = relationship("Payout", foreign_keys=[payout_id])
