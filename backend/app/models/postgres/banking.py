# Banking Entry & CSV Import Models
# Transport ERP — Phase 1 Banking Management

from sqlalchemy import (
    Column, String, Integer, BigInteger, Boolean, ForeignKey,
    DateTime, Text, Date, Enum as SQLEnum, JSON,
)
from sqlalchemy.orm import relationship
import enum
from .base import Base, TimestampMixin, SoftDeleteMixin


class BankingEntryType(enum.Enum):
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"
    PAYMENT_MADE = "PAYMENT_MADE"
    BANK_TRANSFER = "BANK_TRANSFER"
    CASH_DEPOSIT = "CASH_DEPOSIT"
    CASH_WITHDRAWAL = "CASH_WITHDRAWAL"
    JOURNAL_ENTRY = "JOURNAL_ENTRY"


class BankingEntry(Base, TimestampMixin, SoftDeleteMixin):
    """Banking entry — supports 6 entry types with paise-based amounts."""

    __tablename__ = "banking_entries"

    entry_no = Column(String(30), unique=True, nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=False)
    entry_date = Column(Date, nullable=False)
    entry_type = Column(
        SQLEnum(BankingEntryType, name="bankingentrytype", create_type=False),
        nullable=False,
    )
    amount_paise = Column(BigInteger, nullable=False)
    payment_method = Column(String(20), nullable=True)
    reference_no = Column(String(80), nullable=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    transfer_to_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=True)
    description = Column(Text, nullable=True)
    reconciled = Column(Boolean, default=False)
    reconciled_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)

    # Relationships
    account = relationship("BankAccount", foreign_keys=[account_id])
    transfer_to_account = relationship("BankAccount", foreign_keys=[transfer_to_account_id])

    def __repr__(self):
        return f"<BankingEntry {self.entry_no} {self.entry_type.value}>"


class BankCSVImport(Base):
    """Imported bank CSV statement."""

    __tablename__ = "bank_csv_imports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=False)
    filename = Column(String(200), nullable=True)
    row_count = Column(Integer, default=0)
    matched_count = Column(Integer, default=0)
    unmatched_count = Column(Integer, default=0)
    status = Column(String(20), default="processing")
    imported_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    imported_at = Column(DateTime(timezone=True), server_default="now()")

    transactions = relationship("BankCSVTransaction", back_populates="csv_import", cascade="all, delete-orphan")


class BankCSVTransaction(Base):
    """Individual line from an imported bank CSV."""

    __tablename__ = "bank_csv_transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    import_id = Column(Integer, ForeignKey("bank_csv_imports.id", ondelete="CASCADE"), nullable=False)
    txn_date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)
    reference_no = Column(String(80), nullable=True)
    debit_paise = Column(BigInteger, default=0)
    credit_paise = Column(BigInteger, default=0)
    balance_paise = Column(BigInteger, default=0)
    match_status = Column(String(20), default="unmatched")
    matched_entry_id = Column(Integer, ForeignKey("banking_entries.id"), nullable=True)
    matched_invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    raw_row = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default="now()")

    csv_import = relationship("BankCSVImport", back_populates="transactions")
