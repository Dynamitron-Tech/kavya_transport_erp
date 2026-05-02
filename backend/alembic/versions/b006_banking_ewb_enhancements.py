"""banking entries table + ewb alert columns

Revision ID: b006
Revises: a011
Create Date: 2026-03-19 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b006"
down_revision = "a011"
branch_labels = None
depends_on = None

bankingentrytype_enum = postgresql.ENUM(
    'PAYMENT_RECEIVED', 'PAYMENT_MADE', 'BANK_TRANSFER',
    'CASH_DEPOSIT', 'CASH_WITHDRAWAL', 'JOURNAL_ENTRY',
    name='bankingentrytype',
    create_type=False,
)


def upgrade() -> None:
    # ---- Enums ----
    bankingentrytype_enum.create(op.get_bind(), checkfirst=True)

    # ---- banking_entries table ----
    op.create_table(
        "banking_entries",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("entry_no", sa.String(30), unique=True, nullable=False, index=True),
        sa.Column("account_id", sa.Integer, sa.ForeignKey("bank_accounts.id"), nullable=False),
        sa.Column("entry_date", sa.Date, nullable=False),
        sa.Column(
            "entry_type",
            bankingentrytype_enum,
            nullable=False,
        ),
        sa.Column("amount_paise", sa.BigInteger, nullable=False),
        sa.Column("payment_method", sa.String(20), nullable=True),
        sa.Column("reference_no", sa.String(80), nullable=True),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id"), nullable=True),
        sa.Column("job_id", sa.Integer, sa.ForeignKey("jobs.id"), nullable=True),
        sa.Column("invoice_id", sa.Integer, sa.ForeignKey("invoices.id"), nullable=True),
        sa.Column("transfer_to_account_id", sa.Integer, sa.ForeignKey("bank_accounts.id"), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("reconciled", sa.Boolean, default=False, server_default="false"),
        sa.Column("reconciled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("tenant_id", sa.Integer, sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("branch_id", sa.Integer, sa.ForeignKey("branches.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column("is_deleted", sa.Boolean, default=False, server_default="false"),
    )
    op.create_index("idx_banking_entry_account_date", "banking_entries", ["account_id", "entry_date"])

    # ---- bank_csv_imports table ----
    op.create_table(
        "bank_csv_imports",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer, sa.ForeignKey("bank_accounts.id"), nullable=False),
        sa.Column("filename", sa.String(200), nullable=True),
        sa.Column("row_count", sa.Integer, default=0),
        sa.Column("matched_count", sa.Integer, default=0, server_default="0"),
        sa.Column("unmatched_count", sa.Integer, default=0, server_default="0"),
        sa.Column("status", sa.String(20), default="processing", server_default="processing"),
        sa.Column("imported_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("tenant_id", sa.Integer, sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ---- bank_csv_transactions table ----
    op.create_table(
        "bank_csv_transactions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("import_id", sa.Integer, sa.ForeignKey("bank_csv_imports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("txn_date", sa.Date, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("reference_no", sa.String(80), nullable=True),
        sa.Column("debit_paise", sa.BigInteger, default=0, server_default="0"),
        sa.Column("credit_paise", sa.BigInteger, default=0, server_default="0"),
        sa.Column("balance_paise", sa.BigInteger, default=0, server_default="0"),
        sa.Column("match_status", sa.String(20), default="unmatched", server_default="unmatched"),
        sa.Column("matched_entry_id", sa.Integer, sa.ForeignKey("banking_entries.id"), nullable=True),
        sa.Column("matched_invoice_id", sa.Integer, sa.ForeignKey("invoices.id"), nullable=True),
        sa.Column("raw_row", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ---- Add alert columns to eway_bills ----
    op.add_column("eway_bills", sa.Column("alert_8h_sent", sa.Boolean, server_default="false"))
    op.add_column("eway_bills", sa.Column("alert_4h_sent", sa.Boolean, server_default="false"))
    op.add_column("eway_bills", sa.Column("alert_1h_sent", sa.Boolean, server_default="false"))
    op.add_column("eway_bills", sa.Column("source", sa.String(20), server_default="manual"))
    op.add_column("eway_bills", sa.Column("nic_response", sa.JSON, nullable=True))
    op.add_column("eway_bills", sa.Column("trip_id", sa.Integer, sa.ForeignKey("trips.id"), nullable=True))

    # ---- Add opening_balance and alert_threshold to bank_accounts ----
    op.add_column("bank_accounts", sa.Column("opening_balance_paise", sa.BigInteger, server_default="0"))
    op.add_column("bank_accounts", sa.Column("alert_threshold_paise", sa.BigInteger, server_default="500000"))

    # ---- Indices for performance ----
    op.create_index("idx_ewb_valid_upto", "eway_bills", ["valid_until"])
    op.create_index("idx_csv_txn_import", "bank_csv_transactions", ["import_id", "match_status"])


def downgrade() -> None:
    op.drop_index("idx_csv_txn_import")
    op.drop_index("idx_ewb_valid_upto")
    op.drop_column("bank_accounts", "alert_threshold_paise")
    op.drop_column("bank_accounts", "opening_balance_paise")
    op.drop_column("eway_bills", "trip_id")
    op.drop_column("eway_bills", "nic_response")
    op.drop_column("eway_bills", "source")
    op.drop_column("eway_bills", "alert_1h_sent")
    op.drop_column("eway_bills", "alert_4h_sent")
    op.drop_column("eway_bills", "alert_8h_sent")
    op.drop_table("bank_csv_transactions")
    op.drop_table("bank_csv_imports")
    op.drop_index("idx_banking_entry_account_date")
    op.drop_table("banking_entries")
    bankingentrytype_enum.drop(op.get_bind(), checkfirst=True)
