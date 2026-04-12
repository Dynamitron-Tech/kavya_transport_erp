"""Add transport_type column to lrs table

Revision ID: u001_add_transport_type_to_lrs
Revises: t001_market_trip_nullable_job_rc_fields
Create Date: 2026-04-12 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 'u001_add_transport_type_to_lrs'
down_revision = 't001_market_trip_nullable_job_rc_fields'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'lrs',
        sa.Column('transport_type', sa.String(10), nullable=True, server_default='fleet'),
    )
    # Backfill: LRs with vehicle_id already set are fleet trips; others stay NULL (treated as fleet in UI)
    op.execute("UPDATE lrs SET transport_type = 'fleet'")


def downgrade():
    op.drop_column('lrs', 'transport_type')
