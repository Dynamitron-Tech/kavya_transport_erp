"""add missing soft-delete columns to banking_entries

Revision ID: b007
Revises: b006
Create Date: 2026-03-19 00:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "b007"
down_revision = "b006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("banking_entries", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("banking_entries", sa.Column("deleted_by", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("banking_entries", "deleted_by")
    op.drop_column("banking_entries", "deleted_at")
