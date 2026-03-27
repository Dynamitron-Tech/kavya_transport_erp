# Finance Automation Models — Banking, Reconciliation, Settlements, Alerts
# Transport ERP - PostgreSQL

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey,
    DateTime, Text, Numeric, Date, Enum as SQLEnum, UniqueConstraint,
)
from sqlalchemy.orm import relationship
import enum
from .base import Base, TimestampMixin, SoftDeleteMixin


# ======================== ENUMS ========================

class PaymentLinkStatus(enum.Enum):
    CREATED = "CREATED"
    SENT = "SENT"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class ReconciliationStatus(enum.Enum):
    PENDING = "PENDING"
    AUTO_MATCHED = "AUTO_MATCHED"
    MANUAL_MATCHED = "MANUAL_MATCHED"
    EXCEPTION = "EXCEPTION"
    IGNORED = "IGNORED"


class SettlementStatus(enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    PAID = "PAID"
    DISPUTED = "DISPUTED"


class FinanceAlertType(enum.Enum):
    OVERDUE_INVOICE = "OVERDUE_INVOICE"
    PAYMENT_REMINDER = "PAYMENT_REMINDER"
    LOW_BALANCE = "LOW_BALANCE"
    LARGE_PAYMENT = "LARGE_PAYMENT"
    RECONCILIATION_EXCEPTION = "RECONCILIATION_EXCEPTION"
    GST_REMINDER = "GST_REMINDER"
    FAILED_IMPORT = "FAILED_IMPORT"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    DRIVER_SETTLEMENT_DUE = "DRIVER_SETTLEMENT_DUE"
    SUPPLIER_PAYABLE_DUE = "SUPPLIER_PAYABLE_DUE"


class FinanceAlertSeverity(enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class BankStatementSource(enum.Enum):
    MANUAL_UPLOAD = "MANUAL_UPLOAD"
    ACCOUNT_AGGREGATOR = "ACCOUNT_AGGREGATOR"
    NETBANKING_API = "NETBANKING_API"


class FASTagTxnType(enum.Enum):
    TOLL = "TOLL"
    PARKING = "PARKING"
    FUEL = "FUEL"
    OTHER = "OTHER"


# ======================== PAYMENT LINKS (Razorpay) ========================

class PaymentLink(Base, TimestampMixin, SoftDeleteMixin):
    """Razorpay payment link tracking."""

    __tablename__ = "payment_links"

    # Link identifier
    link_id = Column(String(100), unique=True, nullable=False, index=True)
    short_url = Column(String(500), nullable=True)

    # Linked entities
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)

    # Amount
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(5), default="INR")
    description = Column(String(500), nullable=True)

    # Customer info snapshot
    customer_name = Column(String(200), nullable=True)
    customer_phone = Column(String(20), nullable=True)
    customer_email = Column(String(255), nullable=True)

    # Status
    status = Column(SQLEnum(PaymentLinkStatus), default=PaymentLinkStatus.CREATED)
    razorpay_payment_id = Column(String(100), nullable=True)
    paid_at = Column(DateTime, nullable=True)
    expired_at = Column(DateTime, nullable=True)

    # Retry tracking
    send_count = Column(Integer, default=0)
    last_sent_at = Column(DateTime, nullable=True)
    sent_via = Column(String(50), nullable=True)  # whatsapp, email, sms

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    def __repr__(self):
        return f"<PaymentLink {self.link_id}>"


# ======================== BANK STATEMENTS ========================

class BankStatement(Base, TimestampMixin):
    """Imported bank statement header."""

    __tablename__ = "bank_statements"

    account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=False)
    source = Column(SQLEnum(BankStatementSource), default=BankStatementSource.MANUAL_UPLOAD)
    import_date = Column(DateTime, nullable=False)

    # Period
    period_from = Column(Date, nullable=False)
    period_to = Column(Date, nullable=False)

    # Stats
    total_credits = Column(Numeric(15, 2), default=0)
    total_debits = Column(Numeric(15, 2), default=0)
    transaction_count = Column(Integer, default=0)
    matched_count = Column(Integer, default=0)
    exception_count = Column(Integer, default=0)

    # File
    file_url = Column(String(500), nullable=True)

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class BankStatementLine(Base, TimestampMixin):
    """Individual bank statement transaction line."""

    __tablename__ = "bank_statement_lines"

    statement_id = Column(Integer, ForeignKey("bank_statements.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=False)

    # Transaction details
    transaction_date = Column(Date, nullable=False)
    value_date = Column(Date, nullable=True)
    description = Column(Text, nullable=True)
    reference_number = Column(String(100), nullable=True)
    cheque_number = Column(String(30), nullable=True)

    # Amount
    debit = Column(Numeric(15, 2), default=0)
    credit = Column(Numeric(15, 2), default=0)
    balance = Column(Numeric(15, 2), nullable=True)

    # Reconciliation
    reconciliation_status = Column(
        SQLEnum(ReconciliationStatus), default=ReconciliationStatus.PENDING
    )
    matched_payment_id = Column(Integer, ForeignKey("payments.id"), nullable=True)
    matched_invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    matched_bank_txn_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    matched_at = Column(DateTime, nullable=True)
    matched_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    match_confidence = Column(Numeric(5, 2), nullable=True)  # 0-100%
    exception_reason = Column(String(500), nullable=True)

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)


# ======================== DRIVER SETTLEMENTS ========================

class DriverSettlement(Base, TimestampMixin, SoftDeleteMixin):
    """Driver payment settlement records."""

    __tablename__ = "driver_settlements"

    # Settlement number
    settlement_number = Column(String(30), unique=True, nullable=False, index=True)
    settlement_date = Column(Date, nullable=False)

    # Driver
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False)

    # Linked trip (per-trip settlement)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True)

    # Period
    period_from = Column(Date, nullable=False)
    period_to = Column(Date, nullable=False)

    # Earnings
    base_salary = Column(Numeric(12, 2), default=0)
    trip_allowance = Column(Numeric(12, 2), default=0)
    overtime_amount = Column(Numeric(12, 2), default=0)
    incentive_amount = Column(Numeric(12, 2), default=0)
    gross_amount = Column(Numeric(12, 2), default=0)

    # Deductions
    advance_deducted = Column(Numeric(12, 2), default=0)
    fuel_deducted = Column(Numeric(12, 2), default=0)
    damage_deducted = Column(Numeric(12, 2), default=0)
    tds_amount = Column(Numeric(12, 2), default=0)
    other_deductions = Column(Numeric(12, 2), default=0)
    total_deductions = Column(Numeric(12, 2), default=0)

    # Net
    net_amount = Column(Numeric(12, 2), default=0)

    # Trip summary
    trips_completed = Column(Integer, default=0)
    total_km = Column(Numeric(12, 2), default=0)

    # Status
    status = Column(SQLEnum(SettlementStatus), default=SettlementStatus.PENDING)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    paid_date = Column(Date, nullable=True)
    payment_method_str = Column(String(50), nullable=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=True)

    # Remarks
    remarks = Column(Text, nullable=True)

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    def __repr__(self):
        return f"<DriverSettlement {self.settlement_number}>"


# ======================== SUPPLIER PAYABLES ========================

class SupplierPayable(Base, TimestampMixin, SoftDeleteMixin):
    """Supplier/vendor payable tracking with due dates."""

    __tablename__ = "supplier_payables"

    # Payable number
    payable_number = Column(String(30), unique=True, nullable=False, index=True)

    # Vendor
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)

    # Invoice reference from vendor
    vendor_invoice_number = Column(String(100), nullable=True)
    vendor_invoice_date = Column(Date, nullable=True)

    # Amount
    amount = Column(Numeric(15, 2), nullable=False)
    tds_rate = Column(Numeric(5, 2), default=0)
    tds_amount = Column(Numeric(12, 2), default=0)
    net_payable = Column(Numeric(15, 2), nullable=False)

    # Schedule
    due_date = Column(Date, nullable=False)
    paid_date = Column(Date, nullable=True)

    # Status
    status = Column(SQLEnum(SettlementStatus), default=SettlementStatus.PENDING)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=True)

    # Category
    expense_category = Column(String(50), nullable=True)  # fuel, tyre, maintenance, broker

    # Linked entities
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True)

    # Remarks
    remarks = Column(Text, nullable=True)

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    def __repr__(self):
        return f"<SupplierPayable {self.payable_number}>"


# ======================== FASTAG TRANSACTIONS ========================

class FASTagTransaction(Base, TimestampMixin):
    """FASTag toll transaction auto-logged."""

    __tablename__ = "fastag_transactions"

    # Vehicle
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    tag_id = Column(String(50), nullable=True)

    # Transaction
    transaction_id = Column(String(100), unique=True, nullable=False, index=True)
    transaction_date = Column(DateTime, nullable=False)
    transaction_type = Column(SQLEnum(FASTagTxnType), default=FASTagTxnType.TOLL)

    # Toll plaza
    plaza_name = Column(String(200), nullable=True)
    plaza_code = Column(String(50), nullable=True)
    lane_number = Column(String(10), nullable=True)

    # Amount
    amount = Column(Numeric(10, 2), nullable=False)
    balance_after = Column(Numeric(12, 2), nullable=True)

    # Trip link
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True)

    # Auto-expense link
    expense_id = Column(Integer, nullable=True)  # linked after auto-creation

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)


# ======================== FINANCE ALERTS ========================

class FinanceAlert(Base, TimestampMixin):
    """Finance automation alerts."""

    __tablename__ = "finance_alerts"

    alert_type = Column(SQLEnum(FinanceAlertType), nullable=False)
    severity = Column(SQLEnum(FinanceAlertSeverity), default=FinanceAlertSeverity.INFO)

    # Title & message
    title = Column(String(300), nullable=False)
    message = Column(Text, nullable=True)

    # Linked entities
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=True)

    # Status
    is_read = Column(Boolean, default=False)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Notification tracking
    notified_via = Column(String(100), nullable=True)  # email,whatsapp,push
    notified_at = Column(DateTime, nullable=True)

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)


# ======================== FINANCE REPORTS (cached) ========================

class FinanceReportCache(Base, TimestampMixin):
    """Cached finance report snapshots."""

    __tablename__ = "finance_report_cache"

    report_type = Column(String(50), nullable=False)  # daily_digest, weekly_pl, monthly_close, gstr1
    report_date = Column(Date, nullable=False)
    period_from = Column(Date, nullable=False)
    period_to = Column(Date, nullable=False)

    # JSON data stored as text
    report_data = Column(Text, nullable=True)
    pdf_url = Column(String(500), nullable=True)

    # Stats
    total_revenue = Column(Numeric(15, 2), default=0)
    total_expenses = Column(Numeric(15, 2), default=0)
    net_profit = Column(Numeric(15, 2), default=0)
    outstanding_receivables = Column(Numeric(15, 2), default=0)
    outstanding_payables = Column(Numeric(15, 2), default=0)

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    __table_args__ = (
        UniqueConstraint("report_type", "report_date", "tenant_id", name="uq_report_type_date_tenant"),
    )
