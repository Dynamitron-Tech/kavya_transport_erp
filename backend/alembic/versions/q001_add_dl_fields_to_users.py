"""Add driving license fields to users table

Revision ID: q001_add_dl_fields
Revises: p001_mkt_nullable_supplier
Create Date: 2026-04-04 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "q001_add_dl_fields"
down_revision = "p001_mkt_nullable_supplier"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("dl_file_url", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("dl_file_name", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("dl_number", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("dl_issue_date", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("dl_expiry_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "dl_expiry_date")
    op.drop_column("users", "dl_issue_date")
    op.drop_column("users", "dl_number")
    op.drop_column("users", "dl_file_name")
    op.drop_column("users", "dl_file_url")
