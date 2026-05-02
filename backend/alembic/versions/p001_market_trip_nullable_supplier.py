"""Make supplier_id nullable on market_trips (allow creation from LR form)

Revision ID: p001_market_trip_nullable_supplier
Revises: o001_market_trip_fields
Create Date: 2026-04-03 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "p001_mkt_nullable_supplier"
down_revision = "o001_market_trip_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("market_trips", "supplier_id", nullable=True)


def downgrade() -> None:
    # Only safe to reverse if no nulls exist
    op.alter_column("market_trips", "supplier_id", nullable=False)
