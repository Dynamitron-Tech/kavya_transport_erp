"""add TPMS sensor columns to vehicle_tyres and tyre_sensor_readings table

Revision ID: a004
Revises: a003
Create Date: 2026-03-18 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a004'
down_revision: Union[str, None] = 'a003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add TPMS sensor columns to vehicle_tyres
    op.add_column('vehicle_tyres', sa.Column('sensor_id', sa.String(50), nullable=True))
    op.add_column('vehicle_tyres', sa.Column('last_psi', sa.Numeric(5, 1), nullable=True))
    op.add_column('vehicle_tyres', sa.Column('last_temperature_c', sa.Numeric(5, 1), nullable=True))
    op.add_column('vehicle_tyres', sa.Column('tread_depth_mm', sa.Numeric(4, 1), nullable=True))
    op.add_column('vehicle_tyres', sa.Column('last_reading_at', sa.DateTime(), nullable=True))
    op.create_index('ix_vehicle_tyres_sensor_id', 'vehicle_tyres', ['sensor_id'])

    # Create tyre_sensor_readings table
    op.create_table(
        'tyre_sensor_readings',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('vehicle_tyre_id', sa.Integer(), sa.ForeignKey('vehicle_tyres.id', ondelete='CASCADE'), nullable=False),
        sa.Column('psi', sa.Numeric(5, 1), nullable=False),
        sa.Column('temperature_c', sa.Numeric(5, 1), nullable=True),
        sa.Column('tread_depth_mm', sa.Numeric(4, 1), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('alert_triggered', sa.Boolean(), server_default='false'),
        sa.Column('alert_type', sa.String(30), nullable=True),
    )
    op.create_index('ix_tyre_sensor_readings_vehicle_tyre_id', 'tyre_sensor_readings', ['vehicle_tyre_id'])
    op.create_index('ix_tyre_sensor_readings_timestamp', 'tyre_sensor_readings', ['timestamp'])


def downgrade() -> None:
    op.drop_table('tyre_sensor_readings')
    op.drop_index('ix_vehicle_tyres_sensor_id', table_name='vehicle_tyres')
    op.drop_column('vehicle_tyres', 'last_reading_at')
    op.drop_column('vehicle_tyres', 'tread_depth_mm')
    op.drop_column('vehicle_tyres', 'last_temperature_c')
    op.drop_column('vehicle_tyres', 'last_psi')
    op.drop_column('vehicle_tyres', 'sensor_id')
