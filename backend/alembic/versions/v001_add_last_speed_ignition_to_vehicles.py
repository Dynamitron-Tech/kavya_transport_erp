"""Add last_speed and last_ignition_on to vehicles table

Revision ID: v001_add_last_speed_ignition_to_vehicles
Revises: u001_add_transport_type_to_lrs
Create Date: 2026-04-26 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "v001_add_last_speed_ignition_to_vehicles"
down_revision = "v001_invoice_payment_proof"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("vehicles", sa.Column("last_speed", sa.Float(), nullable=True))
    op.add_column("vehicles", sa.Column("last_ignition_on", sa.Boolean(), nullable=True))


def downgrade():
    op.drop_column("vehicles", "last_speed")
    op.drop_column("vehicles", "last_ignition_on")
