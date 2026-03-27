"""add upi_id to drivers

Revision ID: e001
Revises: d002
Create Date: 2026-03-21 12:00:00.000000

Adds upi_id (UPI VPA) column to drivers table so the accountant module
can launch UPI deep-links for driver settlement payments.
"""

from alembic import op
import sqlalchemy as sa

revision = "e001"
down_revision = "d002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "drivers",
        sa.Column("upi_id", sa.String(60), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("drivers", "upi_id")
