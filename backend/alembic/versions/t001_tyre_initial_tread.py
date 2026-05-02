"""Add initial_tread_depth_mm to vehicle_tyres

Revision ID: t001_tyre_initial_tread
Revises: 
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 't001_tyre_initial_tread'
down_revision = None
branch_labels = None
depends_on = 'r001_tyre_field_tables'


def upgrade() -> None:
    op.add_column(
        'vehicle_tyres',
        sa.Column('initial_tread_depth_mm', sa.Numeric(4, 1), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('vehicle_tyres', 'initial_tread_depth_mm')
