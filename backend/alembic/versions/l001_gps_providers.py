"""create gps_providers table and add GPS columns to vehicles

Revision ID: l001_gps_providers
Revises: k001_salary_advance
Create Date: 2026-04-04
"""
from alembic import op
import sqlalchemy as sa

revision = 'l001_gps_providers'
down_revision = 'k001_salary_advance'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # GPS Providers config table
    op.create_table(
        'gps_providers',
        sa.Column('id', sa.String(30), primary_key=True),
        sa.Column('name', sa.String(60), nullable=False),
        sa.Column('api_key_encrypted', sa.Text, nullable=True),
        sa.Column('api_endpoint', sa.Text, nullable=True),
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('poll_interval_seconds', sa.Integer, server_default='60', nullable=False),
        sa.Column('vehicle_count', sa.Integer, server_default='0', nullable=False),
        sa.Column('last_poll_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_poll_status', sa.String(20), nullable=True),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('enabled', sa.Boolean, server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
    )

    # Add provider status column to vehicles
    op.add_column('vehicles', sa.Column(
        'gps_provider_status', sa.String(20), server_default='pending', nullable=True,
    ))
    op.add_column('vehicles', sa.Column(
        'last_gps_at', sa.DateTime(timezone=True), nullable=True,
    ))

    # Seed the three providers
    op.execute("""
        INSERT INTO gps_providers (id, name, status, enabled, poll_interval_seconds)
        VALUES
            ('ialert',      'Ashok Leyland iALERT',  'active',  true,  60),
            ('tata_gps',    'Tata Motors GPS',        'pending', false, 60),
            ('third_party', 'Third-party GPS API',    'pending', false, 60)
        ON CONFLICT DO NOTHING;
    """)

    # Update existing iALERT vehicles to have correct provider status
    op.execute("""
        UPDATE vehicles SET gps_provider_status = 'active'
        WHERE LOWER(gps_provider) = 'ialert' AND is_deleted = false;
    """)


def downgrade() -> None:
    op.drop_column('vehicles', 'last_gps_at')
    op.drop_column('vehicles', 'gps_provider_status')
    op.drop_table('gps_providers')
