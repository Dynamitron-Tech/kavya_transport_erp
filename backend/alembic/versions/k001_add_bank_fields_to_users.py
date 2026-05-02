"""Add bank and salary fields to users table

Revision ID: k001_add_bank_fields_to_users
Revises: j001_add_employee_profile_fields
Create Date: 2026-03-31 00:00:00.000000

Adds bank/salary columns to the users table:
bank_account_holder, bank_name, account_number, ifsc_code,
account_type, upi_id, salary_amount, pay_type
"""

from alembic import op
import sqlalchemy as sa

revision = "k001_add_bank_fields_to_users"
down_revision = "j001_add_employee_profile_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("bank_account_holder", sa.String(150), nullable=True))
    op.add_column("users", sa.Column("bank_name", sa.String(150), nullable=True))
    op.add_column("users", sa.Column("account_number", sa.String(30), nullable=True))
    op.add_column("users", sa.Column("ifsc_code", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("account_type", sa.String(30), nullable=True))
    op.add_column("users", sa.Column("upi_id", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("salary_amount", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("pay_type", sa.String(20), nullable=True))


def downgrade():
    op.drop_column("users", "pay_type")
    op.drop_column("users", "salary_amount")
    op.drop_column("users", "upi_id")
    op.drop_column("users", "account_type")
    op.drop_column("users", "ifsc_code")
    op.drop_column("users", "account_number")
    op.drop_column("users", "bank_name")
    op.drop_column("users", "bank_account_holder")
