"""Add extended vehicle & driver fields to market_trips

Revision ID: o001_market_trip_fields
Revises: n001_aadhaar_users
Create Date: 2026-04-02 09:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "o001_market_trip_fields"
down_revision = "n001_aadhaar_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("market_trips", sa.Column("vehicle_type", sa.String(50), nullable=True))
    op.add_column("market_trips", sa.Column("fuel_type", sa.String(20), nullable=True))
    op.add_column("market_trips", sa.Column("vehicle_make", sa.String(100), nullable=True))
    op.add_column("market_trips", sa.Column("vehicle_model", sa.String(100), nullable=True))
    op.add_column("market_trips", sa.Column("year_of_manufacture", sa.Integer(), nullable=True))
    op.add_column("market_trips", sa.Column("chassis_number", sa.String(50), nullable=True))
    op.add_column("market_trips", sa.Column("engine_number", sa.String(50), nullable=True))
    op.add_column("market_trips", sa.Column("rc_file_url", sa.String(500), nullable=True))
    op.add_column("market_trips", sa.Column("driver_alt_phone", sa.String(20), nullable=True))
    op.add_column("market_trips", sa.Column("driver_address", sa.Text(), nullable=True))
    op.add_column("market_trips", sa.Column("driver_license_issue", sa.String(20), nullable=True))
    op.add_column("market_trips", sa.Column("driver_license_valid", sa.String(20), nullable=True))
    op.add_column("market_trips", sa.Column("dl_file_url", sa.String(500), nullable=True))


def downgrade() -> None:
    for col in [
        "vehicle_type", "fuel_type", "vehicle_make", "vehicle_model",
        "year_of_manufacture", "chassis_number", "engine_number", "rc_file_url",
        "driver_alt_phone", "driver_address", "driver_license_issue",
        "driver_license_valid", "dl_file_url",
    ]:
        op.drop_column("market_trips", col)
