"""Add PAN card fields to users table

Revision ID: r001_add_pan_fields
Revises: q001_add_dl_fields
Create Date: 2026-04-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "r001_add_pan_fields"
down_revision = "q001_add_dl_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("pan_file_url", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("pan_file_name", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "pan_file_name")
    op.drop_column("users", "pan_file_url")
