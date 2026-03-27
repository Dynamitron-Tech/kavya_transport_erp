"""Add retread columns to vehicle_tyres and tyre_lifecycle_events table

Revision ID: a009
Revises: a008
Create Date: 2026-03-22 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a009'
down_revision: Union[str, None] = 'a008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add retread tracking columns to vehicle_tyres
    op.add_column('vehicle_tyres', sa.Column('retread_count', sa.Integer(), server_default='0'))
    op.add_column('vehicle_tyres', sa.Column('max_retreads', sa.Integer(), server_default='2'))
    op.add_column('vehicle_tyres', sa.Column('last_retread_date', sa.Date(), nullable=True))
    op.add_column('vehicle_tyres', sa.Column('total_retread_cost', sa.Numeric(10, 2), server_default='0'))

    # Create tyre_lifecycle_events table
    op.create_table(
        'tyre_lifecycle_events',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('vehicle_tyre_id', sa.Integer(), sa.ForeignKey('vehicle_tyres.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_type', sa.String(30), nullable=False),
        sa.Column('odometer_km', sa.Numeric(12, 2), nullable=True),
        sa.Column('cost', sa.Numeric(10, 2), nullable=True),
        sa.Column('vendor_name', sa.String(200), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('performed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_tyre_lifecycle_events_tyre_id', 'tyre_lifecycle_events', ['vehicle_tyre_id'])
    op.create_index('ix_tyre_lifecycle_events_event_type', 'tyre_lifecycle_events', ['event_type'])


def downgrade() -> None:
    op.drop_table('tyre_lifecycle_events')
    op.drop_column('vehicle_tyres', 'total_retread_cost')
    op.drop_column('vehicle_tyres', 'last_retread_date')
    op.drop_column('vehicle_tyres', 'max_retreads')
    op.drop_column('vehicle_tyres', 'retread_count')
