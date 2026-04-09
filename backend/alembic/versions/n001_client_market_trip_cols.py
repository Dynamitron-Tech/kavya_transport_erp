"""Add missing columns to clients and market_trips tables

Revision ID: n001_client_market_trip_cols
Revises: m001_ifias_tables
Create Date: 2026-04-08

Clients: legal_name, trade_name, nature_of_business, designation, contact_person,
         alt_phone, industry, company_size, tan, reg_type, date_of_liability,
         assessment_year, tds_rate, tax_exempt, name_deductor, name_deductee,
         pan_deductor, pan_deductee, nature_payment, tds_amount,
         invoice_frequency, payment_method, bank_account, ifsc_code, created_by (already exists)

Market Trips: vehicle_type, fuel_type, vehicle_make, vehicle_model,
              year_of_manufacture, chassis_number, engine_number, rc_file_url,
              driver_alt_phone, driver_address, driver_license_issue,
              driver_license_valid, dl_file_url
"""

from alembic import op
import sqlalchemy as sa

revision = "n001_client_market_cols"
down_revision = "m001_ifias_tables"
branch_labels = None
depends_on = None


def upgrade():
    # ── clients ──────────────────────────────────────────────────────────────
    op.add_column("clients", sa.Column("legal_name", sa.String(250), nullable=True))
    op.add_column("clients", sa.Column("trade_name", sa.String(250), nullable=True))
    op.add_column("clients", sa.Column("nature_of_business", sa.String(200), nullable=True))
    op.add_column("clients", sa.Column("designation", sa.String(100), nullable=True))
    op.add_column("clients", sa.Column("contact_person", sa.String(200), nullable=True))
    op.add_column("clients", sa.Column("alt_phone", sa.String(20), nullable=True))
    op.add_column("clients", sa.Column("industry", sa.String(100), nullable=True))
    op.add_column("clients", sa.Column("company_size", sa.String(50), nullable=True))
    op.add_column("clients", sa.Column("tan", sa.String(15), nullable=True))
    op.add_column("clients", sa.Column("reg_type", sa.String(50), nullable=True))
    op.add_column("clients", sa.Column("date_of_liability", sa.String(20), nullable=True))
    op.add_column("clients", sa.Column("assessment_year", sa.String(10), nullable=True))
    op.add_column("clients", sa.Column("tds_rate", sa.String(10), nullable=True))
    op.add_column("clients", sa.Column("tax_exempt", sa.Boolean(), nullable=True, server_default="false"))
    op.add_column("clients", sa.Column("name_deductor", sa.String(200), nullable=True))
    op.add_column("clients", sa.Column("name_deductee", sa.String(200), nullable=True))
    op.add_column("clients", sa.Column("pan_deductor", sa.String(15), nullable=True))
    op.add_column("clients", sa.Column("pan_deductee", sa.String(15), nullable=True))
    op.add_column("clients", sa.Column("nature_payment", sa.String(200), nullable=True))
    op.add_column("clients", sa.Column("tds_amount", sa.String(30), nullable=True))
    op.add_column("clients", sa.Column("invoice_frequency", sa.String(30), nullable=True, server_default="'per_order'"))
    op.add_column("clients", sa.Column("payment_method", sa.String(30), nullable=True, server_default="'bank_transfer'"))
    op.add_column("clients", sa.Column("bank_account", sa.String(30), nullable=True))
    op.add_column("clients", sa.Column("ifsc_code", sa.String(15), nullable=True))

    # ── market_trips ─────────────────────────────────────────────────────────
    op.add_column("market_trips", sa.Column("vehicle_type", sa.String(50), nullable=True))
    op.add_column("market_trips", sa.Column("fuel_type", sa.String(20), nullable=True))
    op.add_column("market_trips", sa.Column("vehicle_make", sa.String(100), nullable=True))
    op.add_column("market_trips", sa.Column("vehicle_model", sa.String(100), nullable=True))
    op.add_column("market_trips", sa.Column("year_of_manufacture", sa.Integer(), nullable=True))
    op.add_column("market_trips", sa.Column("chassis_number", sa.String(50), nullable=True))
    op.add_column("market_trips", sa.Column("engine_number", sa.String(50), nullable=True))
    op.add_column("market_trips", sa.Column("rc_file_url", sa.String(500), nullable=True))
    op.add_column("market_trips", sa.Column("driver_alt_phone", sa.String(20), nullable=True))
    op.add_column("market_trips", sa.Column("driver_address", sa.Text(), nullable=True))
    op.add_column("market_trips", sa.Column("driver_license_issue", sa.String(20), nullable=True))
    op.add_column("market_trips", sa.Column("driver_license_valid", sa.String(20), nullable=True))
    op.add_column("market_trips", sa.Column("dl_file_url", sa.String(500), nullable=True))


def downgrade():
    # market_trips
    for col in ["dl_file_url", "driver_license_valid", "driver_license_issue",
                "driver_address", "driver_alt_phone", "rc_file_url",
                "engine_number", "chassis_number", "year_of_manufacture",
                "vehicle_model", "vehicle_make", "fuel_type", "vehicle_type"]:
        op.drop_column("market_trips", col)

    # clients
    for col in ["ifsc_code", "bank_account", "payment_method", "invoice_frequency",
                "tds_amount", "nature_payment", "pan_deductee", "pan_deductor",
                "name_deductee", "name_deductor", "tax_exempt", "tds_rate",
                "assessment_year", "date_of_liability", "reg_type", "tan",
                "company_size", "industry", "alt_phone", "contact_person",
                "designation", "nature_of_business", "trade_name", "legal_name"]:
        op.drop_column("clients", col)
