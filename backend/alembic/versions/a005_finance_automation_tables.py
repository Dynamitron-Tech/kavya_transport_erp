"""add finance automation tables

Revision ID: a005
Revises: a004
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "a005"
down_revision = "a004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ---- Enums (use raw SQL with IF NOT EXISTS to avoid conflicts with ORM metadata) ----
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE paymentlinkstatus AS ENUM ('CREATED','SENT','PARTIALLY_PAID','PAID','EXPIRED','CANCELLED');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE reconciliationstatus AS ENUM ('PENDING','AUTO_MATCHED','MANUAL_MATCHED','EXCEPTION','IGNORED');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE settlementstatus AS ENUM ('PENDING','APPROVED','PAID','DISPUTED');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE financealerttype AS ENUM (
                'OVERDUE_INVOICE','PAYMENT_REMINDER','LOW_BALANCE','LARGE_PAYMENT',
                'RECONCILIATION_EXCEPTION','GST_REMINDER','FAILED_IMPORT',
                'PAYMENT_FAILED','DRIVER_SETTLEMENT_DUE','SUPPLIER_PAYABLE_DUE'
            );
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE financealertseverity AS ENUM ('INFO','WARNING','CRITICAL');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE bankstatementsource AS ENUM ('MANUAL_UPLOAD','ACCOUNT_AGGREGATOR','NETBANKING_API');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE fastagtxntype AS ENUM ('TOLL','PARKING','FUEL','OTHER');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)

    # ---- payment_links ----
    op.create_table(
        "payment_links",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("is_deleted", sa.Boolean, default=False, nullable=False),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
        sa.Column("deleted_by", sa.Integer, nullable=True),
        sa.Column("link_id", sa.String(100), unique=True, nullable=False, index=True),
        sa.Column("short_url", sa.String(500), nullable=True),
        sa.Column("invoice_id", sa.Integer, sa.ForeignKey("invoices.id"), nullable=True),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id"), nullable=True),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(5), server_default="INR"),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("customer_name", sa.String(200), nullable=True),
        sa.Column("customer_phone", sa.String(20), nullable=True),
        sa.Column("customer_email", sa.String(255), nullable=True),
        sa.Column("status", payment_link_status, server_default="CREATED"),
        sa.Column("razorpay_payment_id", sa.String(100), nullable=True),
        sa.Column("paid_at", sa.DateTime, nullable=True),
        sa.Column("expired_at", sa.DateTime, nullable=True),
        sa.Column("send_count", sa.Integer, server_default="0"),
        sa.Column("last_sent_at", sa.DateTime, nullable=True),
        sa.Column("sent_via", sa.String(50), nullable=True),
        sa.Column("tenant_id", sa.Integer, sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("branch_id", sa.Integer, sa.ForeignKey("branches.id"), nullable=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
    )

    # ---- bank_statements ----
    op.create_table(
        "bank_statements",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("account_id", sa.Integer, sa.ForeignKey("bank_accounts.id"), nullable=False),
        sa.Column("source", bank_statement_source, server_default="MANUAL_UPLOAD"),
        sa.Column("import_date", sa.DateTime, nullable=False),
        sa.Column("period_from", sa.Date, nullable=False),
        sa.Column("period_to", sa.Date, nullable=False),
        sa.Column("total_credits", sa.Numeric(15, 2), server_default="0"),
        sa.Column("total_debits", sa.Numeric(15, 2), server_default="0"),
        sa.Column("transaction_count", sa.Integer, server_default="0"),
        sa.Column("matched_count", sa.Integer, server_default="0"),
        sa.Column("exception_count", sa.Integer, server_default="0"),
        sa.Column("file_url", sa.String(500), nullable=True),
        sa.Column("tenant_id", sa.Integer, sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
    )

    # ---- bank_statement_lines ----
    op.create_table(
        "bank_statement_lines",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("statement_id", sa.Integer, sa.ForeignKey("bank_statements.id", ondelete="CASCADE"), nullable=False),
        sa.Column("account_id", sa.Integer, sa.ForeignKey("bank_accounts.id"), nullable=False),
        sa.Column("transaction_date", sa.Date, nullable=False),
        sa.Column("value_date", sa.Date, nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("reference_number", sa.String(100), nullable=True),
        sa.Column("cheque_number", sa.String(30), nullable=True),
        sa.Column("debit", sa.Numeric(15, 2), server_default="0"),
        sa.Column("credit", sa.Numeric(15, 2), server_default="0"),
        sa.Column("balance", sa.Numeric(15, 2), nullable=True),
        sa.Column("reconciliation_status", reconciliation_status, server_default="PENDING"),
        sa.Column("matched_payment_id", sa.Integer, sa.ForeignKey("payments.id"), nullable=True),
        sa.Column("matched_invoice_id", sa.Integer, sa.ForeignKey("invoices.id"), nullable=True),
        sa.Column("matched_bank_txn_id", sa.Integer, sa.ForeignKey("bank_transactions.id"), nullable=True),
        sa.Column("matched_at", sa.DateTime, nullable=True),
        sa.Column("matched_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("match_confidence", sa.Numeric(5, 2), nullable=True),
        sa.Column("exception_reason", sa.String(500), nullable=True),
        sa.Column("tenant_id", sa.Integer, sa.ForeignKey("tenants.id"), nullable=True),
    )

    # ---- driver_settlements ----
    op.create_table(
        "driver_settlements",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("is_deleted", sa.Boolean, default=False, nullable=False),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
        sa.Column("deleted_by", sa.Integer, nullable=True),
        sa.Column("settlement_number", sa.String(30), unique=True, nullable=False, index=True),
        sa.Column("settlement_date", sa.Date, nullable=False),
        sa.Column("driver_id", sa.Integer, sa.ForeignKey("drivers.id"), nullable=False),
        sa.Column("period_from", sa.Date, nullable=False),
        sa.Column("period_to", sa.Date, nullable=False),
        sa.Column("base_salary", sa.Numeric(12, 2), server_default="0"),
        sa.Column("trip_allowance", sa.Numeric(12, 2), server_default="0"),
        sa.Column("overtime_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("incentive_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("gross_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("advance_deducted", sa.Numeric(12, 2), server_default="0"),
        sa.Column("fuel_deducted", sa.Numeric(12, 2), server_default="0"),
        sa.Column("damage_deducted", sa.Numeric(12, 2), server_default="0"),
        sa.Column("tds_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("other_deductions", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total_deductions", sa.Numeric(12, 2), server_default="0"),
        sa.Column("net_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("trips_completed", sa.Integer, server_default="0"),
        sa.Column("total_km", sa.Numeric(12, 2), server_default="0"),
        sa.Column("status", settlement_status, server_default="PENDING"),
        sa.Column("approved_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime, nullable=True),
        sa.Column("paid_at", sa.DateTime, nullable=True),
        sa.Column("payment_id", sa.Integer, sa.ForeignKey("payments.id"), nullable=True),
        sa.Column("remarks", sa.Text, nullable=True),
        sa.Column("tenant_id", sa.Integer, sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("branch_id", sa.Integer, sa.ForeignKey("branches.id"), nullable=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
    )

    # ---- supplier_payables ----
    op.create_table(
        "supplier_payables",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("is_deleted", sa.Boolean, default=False, nullable=False),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
        sa.Column("deleted_by", sa.Integer, nullable=True),
        sa.Column("payable_number", sa.String(30), unique=True, nullable=False, index=True),
        sa.Column("vendor_id", sa.Integer, sa.ForeignKey("vendors.id"), nullable=False),
        sa.Column("vendor_invoice_number", sa.String(100), nullable=True),
        sa.Column("vendor_invoice_date", sa.Date, nullable=True),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("tds_rate", sa.Numeric(5, 2), server_default="0"),
        sa.Column("tds_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("net_payable", sa.Numeric(15, 2), nullable=False),
        sa.Column("due_date", sa.Date, nullable=False),
        sa.Column("paid_date", sa.Date, nullable=True),
        sa.Column("status", settlement_status, server_default="PENDING"),
        sa.Column("payment_id", sa.Integer, sa.ForeignKey("payments.id"), nullable=True),
        sa.Column("expense_category", sa.String(50), nullable=True),
        sa.Column("trip_id", sa.Integer, sa.ForeignKey("trips.id"), nullable=True),
        sa.Column("remarks", sa.Text, nullable=True),
        sa.Column("tenant_id", sa.Integer, sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("branch_id", sa.Integer, sa.ForeignKey("branches.id"), nullable=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
    )

    # ---- fastag_transactions ----
    op.create_table(
        "fastag_transactions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("vehicle_id", sa.Integer, sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("tag_id", sa.String(50), nullable=True),
        sa.Column("transaction_id", sa.String(100), unique=True, nullable=False, index=True),
        sa.Column("transaction_date", sa.DateTime, nullable=False),
        sa.Column("transaction_type", fastag_txn_type, server_default="TOLL"),
        sa.Column("plaza_name", sa.String(200), nullable=True),
        sa.Column("plaza_code", sa.String(50), nullable=True),
        sa.Column("lane_number", sa.String(10), nullable=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("balance_after", sa.Numeric(12, 2), nullable=True),
        sa.Column("trip_id", sa.Integer, sa.ForeignKey("trips.id"), nullable=True),
        sa.Column("expense_id", sa.Integer, nullable=True),
        sa.Column("tenant_id", sa.Integer, sa.ForeignKey("tenants.id"), nullable=True),
    )

    # ---- finance_alerts ----
    op.create_table(
        "finance_alerts",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("alert_type", finance_alert_type, nullable=False),
        sa.Column("severity", finance_alert_severity, server_default="INFO"),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("invoice_id", sa.Integer, sa.ForeignKey("invoices.id"), nullable=True),
        sa.Column("payment_id", sa.Integer, sa.ForeignKey("payments.id"), nullable=True),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id"), nullable=True),
        sa.Column("vendor_id", sa.Integer, sa.ForeignKey("vendors.id"), nullable=True),
        sa.Column("driver_id", sa.Integer, sa.ForeignKey("drivers.id"), nullable=True),
        sa.Column("bank_account_id", sa.Integer, sa.ForeignKey("bank_accounts.id"), nullable=True),
        sa.Column("is_read", sa.Boolean, server_default="false"),
        sa.Column("is_resolved", sa.Boolean, server_default="false"),
        sa.Column("resolved_at", sa.DateTime, nullable=True),
        sa.Column("resolved_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("notified_via", sa.String(100), nullable=True),
        sa.Column("notified_at", sa.DateTime, nullable=True),
        sa.Column("tenant_id", sa.Integer, sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("branch_id", sa.Integer, sa.ForeignKey("branches.id"), nullable=True),
    )

    # ---- finance_report_cache ----
    op.create_table(
        "finance_report_cache",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("report_date", sa.Date, nullable=False),
        sa.Column("period_from", sa.Date, nullable=False),
        sa.Column("period_to", sa.Date, nullable=False),
        sa.Column("report_data", sa.Text, nullable=True),
        sa.Column("pdf_url", sa.String(500), nullable=True),
        sa.Column("total_revenue", sa.Numeric(15, 2), server_default="0"),
        sa.Column("total_expenses", sa.Numeric(15, 2), server_default="0"),
        sa.Column("net_profit", sa.Numeric(15, 2), server_default="0"),
        sa.Column("outstanding_receivables", sa.Numeric(15, 2), server_default="0"),
        sa.Column("outstanding_payables", sa.Numeric(15, 2), server_default="0"),
        sa.Column("tenant_id", sa.Integer, sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("branch_id", sa.Integer, sa.ForeignKey("branches.id"), nullable=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.UniqueConstraint("report_type", "report_date", "tenant_id", name="uq_report_type_date_tenant"),
    )


def downgrade() -> None:
    op.drop_table("finance_report_cache")
    op.drop_table("finance_alerts")
    op.drop_table("fastag_transactions")
    op.drop_table("supplier_payables")
    op.drop_table("driver_settlements")
    op.drop_table("bank_statement_lines")
    op.drop_table("bank_statements")
    op.drop_table("payment_links")

    for name in [
        "fastagtxntype", "bankstatementsource", "financealertseverity",
        "financealerttype", "settlementstatus", "reconciliationstatus",
        "paymentlinkstatus",
    ]:
        sa.Enum(name=name).drop(op.get_bind(), checkfirst=True)
