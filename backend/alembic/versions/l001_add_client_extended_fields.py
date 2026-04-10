"""Add extended fields to clients table

Revision ID: l001_add_client_extended_fields
Revises: k001_add_bank_fields_to_users
Create Date: 2026-04-01 00:00:00.000000

Adds: contact_person, alt_phone, industry, company_size,
tds_rate, tax_exempt, invoice_frequency, payment_method,
bank_account, ifsc_code
"""

from alembic import op
import sqlalchemy as sa

revision = "l001_add_client_extended_fields"
down_revision = "k001_add_bank_fields_to_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = [
        ("contact_person", sa.String(200), True),
        ("alt_phone", sa.String(20), True),
        ("industry", sa.String(100), True),
        ("company_size", sa.String(50), True),
        ("tds_rate", sa.String(10), True),
        ("invoice_frequency", sa.String(30), True),
        ("payment_method", sa.String(30), True),
        ("bank_account", sa.String(30), True),
        ("ifsc_code", sa.String(15), True),
    ]
    for col_name, col_type, nullable in columns:
        op.add_column("clients", sa.Column(col_name, col_type, nullable=nullable))

    op.add_column("clients", sa.Column("tax_exempt", sa.Boolean(), server_default="false", nullable=True))


def downgrade() -> None:
    for col in [
        "contact_person", "alt_phone", "industry", "company_size",
        "tds_rate", "tax_exempt", "invoice_frequency", "payment_method",
        "bank_account", "ifsc_code",
    ]:
        op.drop_column("clients", col)
