"""Add aadhaar and DL document fields to users table

Revision ID: l001_add_document_fields_to_users
Revises: k001_add_bank_fields_to_users
Create Date: 2026-04-08 00:00:00.000000

Adds the missing document columns to users:
aadhaar_file_url, aadhaar_file_name,
dl_file_url, dl_file_name, dl_number, dl_issue_date, dl_expiry_date
"""

from alembic import op
import sqlalchemy as sa

revision = "l001_user_doc_fields"
down_revision = "k001_add_bank_fields_to_users"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("aadhaar_file_url", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("aadhaar_file_name", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("dl_file_url", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("dl_file_name", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("dl_number", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("dl_issue_date", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("dl_expiry_date", sa.Date(), nullable=True))


def downgrade():
    op.drop_column("users", "dl_expiry_date")
    op.drop_column("users", "dl_issue_date")
    op.drop_column("users", "dl_number")
    op.drop_column("users", "dl_file_name")
    op.drop_column("users", "dl_file_url")
    op.drop_column("users", "aadhaar_file_name")
    op.drop_column("users", "aadhaar_file_url")
