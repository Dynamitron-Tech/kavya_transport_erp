# Reconciliation Models — Session-based bank statement matching
# These supplement (not replace) the existing BankStatement/BankStatementLine in finance_automation.py
# This session model tracks the full accountant review workflow with confidence scores.

from __future__ import annotations

from datetime import date, datetime
from sqlalchemy import (
    Column, String, Integer, BigInteger, Boolean, ForeignKey,
    DateTime, Text, Date,
)
from .base import Base, TimestampMixin


class ReconciliationSession(Base, TimestampMixin):
    """One reconciliation session = one bank statement file upload."""

    __tablename__ = "reconciliation_sessions"

    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=False)
    statement_from = Column(Date, nullable=True)
    statement_to = Column(Date, nullable=True)
    source_file_name = Column(String(300), nullable=False)
    source_file_s3 = Column(String(500), nullable=True)
    bank_name = Column(String(50), nullable=True)   # HDFC, ICICI, SBI, AXIS, KOTAK, GENERIC
    account_number_hint = Column(String(10), nullable=True)  # last 4 digits

    # Status
    status = Column(String(20), default="pending_review")
    # values: pending_review | in_progress | completed

    # Counts
    total_transactions = Column(Integer, default=0)
    confirmed_count = Column(Integer, default=0)
    skipped_count = Column(Integer, default=0)
    unmatched_count = Column(Integer, default=0)
    high_confidence_count = Column(Integer, default=0)
    medium_confidence_count = Column(Integer, default=0)

    # Balance hints from parsed statement
    opening_balance_paise = Column(BigInteger, nullable=True)
    closing_balance_paise = Column(BigInteger, nullable=True)
    total_credits_paise = Column(BigInteger, default=0)
    total_debits_paise = Column(BigInteger, default=0)

    # Audit
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Parse warnings (JSON text)
    parse_warnings_json = Column(Text, nullable=True)  # JSON array of warning strings


class ReconciliationLine(Base, TimestampMixin):
    """One line = one bank transaction row from the uploaded file."""

    __tablename__ = "reconciliation_lines"

    session_id = Column(Integer, ForeignKey("reconciliation_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    row_number = Column(Integer, nullable=False)

    # Transaction details (from bank CSV)
    txn_date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)
    description_normalized = Column(Text, nullable=True)
    reference_number = Column(String(100), nullable=True)
    debit_paise = Column(BigInteger, default=0)
    credit_paise = Column(BigInteger, default=0)
    balance_paise = Column(BigInteger, nullable=True)
    transaction_type = Column(String(10), nullable=False)  # "debit" | "credit"

    # Auto-match result
    matched_entity_type = Column(String(20), nullable=True)   # "invoice" | "expense" | None
    matched_entity_id = Column(Integer, nullable=True)
    matched_entity_ref = Column(String(100), nullable=True)   # Invoice no. or expense description
    matched_amount_paise = Column(BigInteger, nullable=True)
    confidence = Column(String(10), nullable=True)            # "HIGH" | "MEDIUM" | "LOW" | "NONE"
    match_reason = Column(Text, nullable=True)
    suggested_category = Column(String(50), nullable=True)    # For unmatched debits
    alternative_matches_json = Column(Text, nullable=True)    # JSON array of alternatives

    # Accountant decision
    status = Column(String(20), default="pending")
    # values: pending | confirmed | skipped | overridden

    override_entity_type = Column(String(20), nullable=True)
    override_entity_id = Column(Integer, nullable=True)
    expense_category = Column(String(50), nullable=True)  # When action = create_expense
    action_taken = Column(String(20), nullable=True)
    # values: confirm_match | create_expense | skip | manual_entry

    notes = Column(Text, nullable=True)
    confirmed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    confirmed_at = Column(DateTime, nullable=True)

    # Created BankingEntry or Expense by this confirmation
    created_banking_entry_id = Column(Integer, ForeignKey("banking_entries.id"), nullable=True)
    created_expense_id = Column(Integer, nullable=True)
