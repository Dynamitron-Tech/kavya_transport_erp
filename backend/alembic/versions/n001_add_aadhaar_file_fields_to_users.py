"""Add Aadhaar file metadata fields to users table

Revision ID: n001_aadhaar_users
Revises: m001_add_client_tds_gst_fields
Create Date: 2026-04-01 18:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "n001_aadhaar_users"
down_revision = "m001_add_client_tds_gst_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("aadhaar_file_url", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("aadhaar_file_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "aadhaar_file_name")
    op.drop_column("users", "aadhaar_file_url")
