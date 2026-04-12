"""Add vehicle_fuel_logs table for driver mileage tracking

Revision ID: r001_vehicle_fuel_log
Revises: q001_add_dl_fields
Create Date: 2026-04-11 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 'r001_vehicle_fuel_log'
down_revision = 'q001_add_dl_fields'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'vehicle_fuel_logs',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('vehicle_id', sa.Integer(), sa.ForeignKey('vehicles.id'), nullable=False, index=True),
        sa.Column('driver_id', sa.Integer(), sa.ForeignKey('drivers.id'), nullable=False, index=True),
        sa.Column('fill_date', sa.DateTime(), nullable=False),
        sa.Column('odometer_km', sa.Numeric(10, 1), nullable=False),
        sa.Column('litres_filled', sa.Numeric(8, 2), nullable=False),
        sa.Column('fuel_type', sa.String(20), nullable=True, default='diesel'),
        sa.Column('pump_name', sa.String(120), nullable=True),
        sa.Column('pump_location', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('prev_log_id', sa.Integer(), sa.ForeignKey('vehicle_fuel_logs.id'), nullable=True),
        sa.Column('km_since_last_fill', sa.Numeric(10, 1), nullable=True),
        sa.Column('km_per_litre', sa.Numeric(6, 2), nullable=True),
        sa.Column('expected_km_per_litre', sa.Numeric(6, 2), nullable=True),
        sa.Column('mileage_rating', sa.Enum('good', 'medium', 'bad', name='mileagerating'), nullable=True),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id'), nullable=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table('vehicle_fuel_logs')
    op.execute("DROP TYPE IF EXISTS mileagerating")
