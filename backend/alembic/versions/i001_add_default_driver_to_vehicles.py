"""Add default_driver_id to vehicles

Revision ID: i001_add_default_driver_to_vehicles
Revises: h001_tms_automation_columns
Create Date: 2026-03-31 00:00:00.000000

Adds a nullable FK column default_driver_id to the vehicles table so that
a fleet manager can explicitly assign a default driver to each vehicle.
"""

from alembic import op
import sqlalchemy as sa

revision = "i001_default_driver"
down_revision = "h001_tms_automation_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "vehicles",
        sa.Column("default_driver_id", sa.Integer(), sa.ForeignKey("drivers.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("vehicles", "default_driver_id")
