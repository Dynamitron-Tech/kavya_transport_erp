"""add upi fields to clients

Revision ID: d001
Revises: c001
Create Date: 2026-03-21 00:00:00.000000

NOTE: The `phone` column already exists on the clients table (String(20)).
Only `upi_id` is new. This migration adds the UPI VPA identifier.
"""

from alembic import op
import sqlalchemy as sa


revision = "d001"
down_revision = "c001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add upi_id to clients (e.g. "9876543210@okaxis", "bala@oksbi")
    op.add_column(
        "clients",
        sa.Column("upi_id", sa.String(60), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("clients", "upi_id")
