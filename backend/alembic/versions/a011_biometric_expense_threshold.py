"""a011 — Add biometric_verified to trip_expenses

Revision ID: a011
Revises: a010
"""
from alembic import op
import sqlalchemy as sa

revision = "a011"
down_revision = "a010"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("trip_expenses", sa.Column("biometric_verified", sa.Boolean(), server_default="false", nullable=False))


def downgrade():
    op.drop_column("trip_expenses", "biometric_verified")
