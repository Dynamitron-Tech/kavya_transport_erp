"""Add payment_contacts, payouts, payment_schedules, expense_submissions tables

Revision ID: p001
Revises: o001
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa

revision = 'p001'
down_revision = 'o001'
branch_labels = None
depends_on = None


def upgrade():
    # payment_contacts
    op.create_table(
        'payment_contacts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('contact_type', sa.String(20), nullable=False, index=True),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('entity_name', sa.String(200), nullable=False),
        sa.Column('razorpay_contact_id', sa.String(100), nullable=True),
        sa.Column('razorpay_fund_account_id', sa.String(100), nullable=True),
        sa.Column('bank_account_number', sa.String(50), nullable=True),
        sa.Column('bank_ifsc', sa.String(20), nullable=True),
        sa.Column('bank_name', sa.String(100), nullable=True),
        sa.Column('account_holder_name', sa.String(200), nullable=True),
        sa.Column('upi_id', sa.String(100), nullable=True),
        sa.Column('preferred_method', sa.String(20), server_default='imps'),
        sa.Column('is_verified', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
    )

    # payouts
    op.create_table(
        'payouts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('payout_type', sa.String(30), nullable=False, index=True),
        sa.Column('contact_id', sa.Integer(), sa.ForeignKey('payment_contacts.id'), nullable=True),
        sa.Column('amount_paise', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(3), server_default='INR'),
        sa.Column('payment_method', sa.String(10), nullable=True),
        sa.Column('purpose', sa.String(50), nullable=True),
        sa.Column('narration', sa.String(200), nullable=True),
        sa.Column('reference_type', sa.String(30), nullable=True),
        sa.Column('reference_id', sa.String(100), nullable=True),
        sa.Column('razorpay_payout_id', sa.String(100), nullable=True, index=True),
        sa.Column('razorpay_fund_account_id', sa.String(100), nullable=True),
        sa.Column('utr', sa.String(100), nullable=True),
        sa.Column('razorpay_fees_paise', sa.Integer(), nullable=True),
        sa.Column('razorpay_tax_paise', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(20), server_default='pending', index=True),
        sa.Column('failure_reason', sa.String(500), nullable=True),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.Column('initiated_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('recipient_name', sa.String(200), nullable=True),
        sa.Column('recipient_bank_last4', sa.String(4), nullable=True),
    )

    # payment_schedules
    op.create_table(
        'payment_schedules',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('schedule_type', sa.String(30), nullable=False, index=True),
        sa.Column('contact_id', sa.Integer(), sa.ForeignKey('payment_contacts.id'), nullable=True),
        sa.Column('amount_paise', sa.Integer(), nullable=False),
        sa.Column('frequency', sa.String(20), nullable=False),
        sa.Column('due_day', sa.Integer(), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('description', sa.String(200), nullable=True),
        sa.Column('vehicle_id', sa.Integer(), sa.ForeignKey('vehicles.id'), nullable=True),
        sa.Column('driver_id', sa.Integer(), sa.ForeignKey('drivers.id'), nullable=True),
        sa.Column('employee_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('last_paid_at', sa.DateTime(), nullable=True),
        sa.Column('next_due_date', sa.Date(), nullable=True),
        sa.Column('payee_name', sa.String(200), nullable=True),
    )

    # expense_submissions
    op.create_table(
        'expense_submissions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('submitted_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('trip_id', sa.Integer(), sa.ForeignKey('trips.id'), nullable=True),
        sa.Column('vehicle_id', sa.Integer(), sa.ForeignKey('vehicles.id'), nullable=True),
        sa.Column('category', sa.String(30), nullable=False),
        sa.Column('amount_paise', sa.Integer(), nullable=False),
        sa.Column('payment_method', sa.String(10), server_default='gpay'),
        sa.Column('upi_ref_number', sa.String(100), nullable=True),
        sa.Column('receipt_image_s3', sa.String(500), nullable=True),
        sa.Column('description', sa.String(300), nullable=True),
        sa.Column('status', sa.String(20), server_default='pending', index=True),
        sa.Column('rejection_reason', sa.String(300), nullable=True),
        sa.Column('approved_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('payout_id', sa.Integer(), sa.ForeignKey('payouts.id'), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), server_default=sa.text('NOW()')),
    )

    # Add FINANCE_MANAGER to the role enum
    op.execute("ALTER TYPE roletype ADD VALUE IF NOT EXISTS 'FINANCE_MANAGER'")


def downgrade():
    op.drop_table('expense_submissions')
    op.drop_table('payment_schedules')
    op.drop_table('payouts')
    op.drop_table('payment_contacts')
