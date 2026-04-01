"""Add employee profile fields to users table

Revision ID: j001_add_employee_profile_fields
Revises: i001_default_driver
Create Date: 2026-03-31 00:00:00.000000

Adds employee profile columns to the users table:
date_of_birth, gender, address, joining_date,
emergency_contact_name, emergency_contact_phone
"""

from alembic import op
import sqlalchemy as sa

revision = "j001_add_employee_profile_fields"
down_revision = "i001_default_driver"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("date_of_birth", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("gender", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("address", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("joining_date", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("emergency_contact_name", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("emergency_contact_phone", sa.String(20), nullable=True))


def downgrade():
    op.drop_column("users", "emergency_contact_phone")
    op.drop_column("users", "emergency_contact_name")
    op.drop_column("users", "joining_date")
    op.drop_column("users", "address")
    op.drop_column("users", "gender")
    op.drop_column("users", "date_of_birth")
