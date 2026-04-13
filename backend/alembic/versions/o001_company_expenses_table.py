"""Add company_expenses table for structured outgoing payment tracking

Revision ID: o001
Revises: n001_client_market_trip_cols
Create Date: 2026-04-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'o001'
down_revision = 'n001_client_market_trip_cols'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'company_expenses',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),

        # Category & method
        sa.Column('expense_category', sa.String(50), nullable=False),
        sa.Column('payment_method',   sa.String(30), nullable=False),

        # Amount in paise
        sa.Column('amount_paise', sa.Integer(), nullable=False),

        # Meta
        sa.Column('description',  sa.String(500), nullable=True),
        sa.Column('expense_date', sa.Date(), nullable=False),
        sa.Column('payee_name',   sa.String(200), nullable=True),
        sa.Column('period_from',  sa.Date(), nullable=True),
        sa.Column('period_to',    sa.Date(), nullable=True),

        # Foreign keys
        sa.Column('vehicle_id',       sa.Integer(), sa.ForeignKey('vehicles.id'),       nullable=True),
        sa.Column('driver_id',        sa.Integer(), sa.ForeignKey('drivers.id'),         nullable=True),
        sa.Column('trip_id',          sa.Integer(), sa.ForeignKey('trips.id'),           nullable=True),
        sa.Column('banking_entry_id', sa.Integer(), nullable=True),  # FK omitted: banking_entries not accessible by migration user
        sa.Column('branch_id',        sa.Integer(), sa.ForeignKey('branches.id'),        nullable=True),
        sa.Column('created_by',       sa.Integer(), sa.ForeignKey('users.id'),           nullable=False, server_default='1'),

        # Proof fields
        sa.Column('upi_ref_number',    sa.String(100), nullable=True),
        sa.Column('receipt_image_url', sa.String(500), nullable=True),
        sa.Column('netbanking_ref',    sa.String(100), nullable=True),
        sa.Column('bank_name',         sa.String(100), nullable=True),

        # Razorpay payout (driver advance)
        sa.Column('razorpay_payout_id', sa.String(100), nullable=True),

        # Approval
        sa.Column('approval_status',  sa.String(20), nullable=False, server_default='pending'),
        sa.Column('rejection_reason', sa.Text(),     nullable=True),
        sa.Column('approved_by',      sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at',      sa.DateTime(), nullable=True),
    )

    op.create_index('ix_company_expenses_expense_date',     'company_expenses', ['expense_date'])
    op.create_index('ix_company_expenses_expense_category', 'company_expenses', ['expense_category'])
    op.create_index('ix_company_expenses_approval_status',  'company_expenses', ['approval_status'])
    op.create_index('ix_company_expenses_driver_id',        'company_expenses', ['driver_id'])
    op.create_index('ix_company_expenses_trip_id',          'company_expenses', ['trip_id'])


def downgrade():
    op.drop_table('company_expenses')
