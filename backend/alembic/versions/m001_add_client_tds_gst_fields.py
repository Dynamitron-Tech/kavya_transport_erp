"""Add TDS, GST registration, and business fields to clients

Revision ID: m001_add_client_tds_gst_fields
Revises: l001_add_client_extended_fields
Create Date: 2026-04-01 12:00:00.000000

Adds: legal_name, trade_name, nature_of_business, designation,
tan, reg_type, date_of_liability, assessment_year,
name_deductor, name_deductee, pan_deductor, pan_deductee,
nature_payment, tds_amount
"""

from alembic import op
import sqlalchemy as sa

revision = "m001_add_client_tds_gst_fields"
down_revision = "l001_add_client_extended_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = [
        ("legal_name", sa.String(250)),
        ("trade_name", sa.String(250)),
        ("nature_of_business", sa.String(200)),
        ("designation", sa.String(100)),
        ("tan", sa.String(15)),
        ("reg_type", sa.String(50)),
        ("date_of_liability", sa.String(20)),
        ("assessment_year", sa.String(10)),
        ("name_deductor", sa.String(200)),
        ("name_deductee", sa.String(200)),
        ("pan_deductor", sa.String(15)),
        ("pan_deductee", sa.String(15)),
        ("nature_payment", sa.String(200)),
        ("tds_amount", sa.String(30)),
    ]
    for col_name, col_type in columns:
        op.add_column("clients", sa.Column(col_name, col_type, nullable=True))


def downgrade() -> None:
    for col in [
        "legal_name", "trade_name", "nature_of_business", "designation",
        "tan", "reg_type", "date_of_liability", "assessment_year",
        "name_deductor", "name_deductee", "pan_deductor", "pan_deductee",
        "nature_payment", "tds_amount",
    ]:
        op.drop_column("clients", col)
