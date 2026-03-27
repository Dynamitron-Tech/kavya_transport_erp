"""add_supplier_and_market_trip_tables

Revision ID: a002_supplier_mkt
Revises: a001_job_type
Create Date: 2026-03-18 10:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a002_supplier_mkt'
down_revision: Union[str, None] = 'a001_job_type'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Supplier type enum
    supplier_type_enum = sa.Enum('broker', 'fleet_owner', 'individual', name='suppliertype')
    supplier_type_enum.create(op.get_bind(), checkfirst=True)

    # Market trip status enum
    market_trip_status_enum = sa.Enum('pending', 'assigned', 'in_transit', 'delivered', 'settled', 'cancelled', name='markettripstatus')
    market_trip_status_enum.create(op.get_bind(), checkfirst=True)

    # Create suppliers table
    op.create_table(
        'suppliers',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('code', sa.String(30), nullable=False, unique=True),
        sa.Column('supplier_type', sa.Enum('broker', 'fleet_owner', 'individual', name='suppliertype', create_type=False), nullable=False, server_default='broker'),
        sa.Column('contact_person', sa.String(200), nullable=True),
        sa.Column('phone', sa.String(20), nullable=False),
        sa.Column('email', sa.String(200), nullable=True),
        sa.Column('pan', sa.String(10), nullable=True),
        sa.Column('gstin', sa.String(15), nullable=True),
        sa.Column('aadhaar', sa.String(12), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state', sa.String(100), nullable=True),
        sa.Column('pincode', sa.String(10), nullable=True),
        sa.Column('bank_account_number', sa.String(30), nullable=True),
        sa.Column('bank_ifsc', sa.String(11), nullable=True),
        sa.Column('bank_name', sa.String(100), nullable=True),
        sa.Column('rate_card', sa.JSON(), nullable=True),
        sa.Column('tds_applicable', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('tds_rate', sa.Numeric(5, 2), nullable=True, server_default='1.0'),
        sa.Column('credit_limit', sa.Numeric(15, 2), nullable=True),
        sa.Column('credit_days', sa.Integer(), nullable=True, server_default='30'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=True),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_by', sa.Integer(), nullable=True),
    )
    op.create_index('ix_suppliers_code', 'suppliers', ['code'], unique=True)

    # Create supplier_vehicles table
    op.create_table(
        'supplier_vehicles',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('supplier_id', sa.Integer(), sa.ForeignKey('suppliers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('vehicle_id', sa.Integer(), sa.ForeignKey('vehicles.id', ondelete='CASCADE'), nullable=True),
        sa.Column('vehicle_registration', sa.String(20), nullable=True),
        sa.Column('vehicle_type', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Create market_trips table
    op.create_table(
        'market_trips',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('job_id', sa.Integer(), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', sa.Integer(), sa.ForeignKey('suppliers.id'), nullable=False),
        sa.Column('vehicle_registration', sa.String(20), nullable=True),
        sa.Column('driver_name', sa.String(200), nullable=True),
        sa.Column('driver_phone', sa.String(20), nullable=True),
        sa.Column('driver_license', sa.String(30), nullable=True),
        sa.Column('client_rate', sa.Numeric(15, 2), nullable=False),
        sa.Column('contractor_rate', sa.Numeric(15, 2), nullable=False),
        sa.Column('advance_amount', sa.Numeric(15, 2), nullable=True, server_default='0'),
        sa.Column('loading_charges', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('unloading_charges', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('other_charges', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('purchase_invoice_id', sa.Integer(), sa.ForeignKey('invoices.id'), nullable=True),
        sa.Column('tds_rate', sa.Numeric(5, 2), nullable=True, server_default='1.0'),
        sa.Column('tds_amount', sa.Numeric(15, 2), nullable=True, server_default='0'),
        sa.Column('net_payable', sa.Numeric(15, 2), nullable=True, server_default='0'),
        sa.Column('status', sa.Enum('pending', 'assigned', 'in_transit', 'delivered', 'settled', 'cancelled', name='markettripstatus', create_type=False), nullable=False, server_default='pending'),
        sa.Column('assigned_at', sa.DateTime(), nullable=True),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.Column('settled_at', sa.DateTime(), nullable=True),
        sa.Column('settlement_reference', sa.String(100), nullable=True),
        sa.Column('settlement_remarks', sa.Text(), nullable=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=True),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id'), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_by', sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('market_trips')
    op.drop_table('supplier_vehicles')
    op.drop_index('ix_suppliers_code', 'suppliers')
    op.drop_table('suppliers')
    sa.Enum('pending', 'assigned', 'in_transit', 'delivered', 'settled', 'cancelled', name='markettripstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum('broker', 'fleet_owner', 'individual', name='suppliertype').drop(op.get_bind(), checkfirst=True)
