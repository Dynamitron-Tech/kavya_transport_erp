"""add payment tracking fields

Adds upi_txn_id to existing payments table, adds payment_status to invoices,
and creates a partial unique index on (invoice_id, transaction_ref) to prevent
duplicate payment entries.

Revision ID: d002
Revises: d001
Create Date: 2026-03-21 00:00:00.000000

NOTE: The `payments` table and `invoices` table already exist.
      `invoices.amount_paid` already exists — only `payment_status` is added.
"""

from alembic import op
import sqlalchemy as sa


revision = "d002"
down_revision = "d001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── payments: UPI transaction ID field ─────────────────────────────────
    op.add_column(
        "payments",
        sa.Column("upi_txn_id", sa.String(100), nullable=True),
    )

    # Partial unique index: prevents duplicate (invoice_id, reference) entries.
    # WHERE clause ensures NULL transaction_ref rows are not constrained.
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uix_payments_invoice_ref
        ON payments (invoice_id, transaction_ref)
        WHERE transaction_ref IS NOT NULL
          AND is_deleted IS NOT TRUE
        """
    )

    # ── invoices: simple UNPAID / PARTIAL / PAID status ────────────────────
    # Create the enum type first (PostgreSQL requires explicit type creation)
    op.execute(
        "CREATE TYPE invoice_payment_status AS ENUM ('UNPAID', 'PARTIAL', 'PAID')"
    )
    op.add_column(
        "invoices",
        sa.Column(
            "payment_status",
            sa.Enum("UNPAID", "PARTIAL", "PAID", name="invoice_payment_status"),
            nullable=True,
            server_default="UNPAID",
        ),
    )


def downgrade() -> None:
    op.drop_index("uix_payments_invoice_ref", table_name="payments")
    op.drop_column("payments", "upi_txn_id")
    op.drop_column("invoices", "payment_status")
    op.execute("DROP TYPE IF EXISTS invoice_payment_status")
