"""Add passbook fields to users table

Revision ID: s001_add_passbook_fields
Revises: r001_add_pan_fields
Create Date: 2026-04-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "s001_add_passbook_fields"
down_revision = "r001_add_pan_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("passbook_file_url", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("passbook_file_name", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "passbook_file_name")
    op.drop_column("users", "passbook_file_url")
