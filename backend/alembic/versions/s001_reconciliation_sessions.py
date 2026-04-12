"""Add reconciliation_sessions and reconciliation_lines tables for bank statement auto-match

Revision ID: s001_reconciliation_sessions
Revises: r001_vehicle_fuel_log
Create Date: 2026-04-11 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 's001_reconciliation_sessions'
down_revision = 'r001_vehicle_fuel_log'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'reconciliation_sessions',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('bank_account_id', sa.Integer(), sa.ForeignKey('bank_accounts.id'), nullable=False, index=True),
        sa.Column('statement_from', sa.Date(), nullable=True),
        sa.Column('statement_to', sa.Date(), nullable=True),
        sa.Column('source_file_name', sa.String(300), nullable=False),
        sa.Column('source_file_s3', sa.String(500), nullable=True),
        sa.Column('bank_name', sa.String(50), nullable=True),
        sa.Column('account_number_hint', sa.String(10), nullable=True),
        sa.Column('status', sa.String(20), nullable=True, default='pending_review'),
        sa.Column('total_transactions', sa.Integer(), nullable=True, default=0),
        sa.Column('confirmed_count', sa.Integer(), nullable=True, default=0),
        sa.Column('skipped_count', sa.Integer(), nullable=True, default=0),
        sa.Column('unmatched_count', sa.Integer(), nullable=True, default=0),
        sa.Column('high_confidence_count', sa.Integer(), nullable=True, default=0),
        sa.Column('medium_confidence_count', sa.Integer(), nullable=True, default=0),
        sa.Column('opening_balance_paise', sa.BigInteger(), nullable=True),
        sa.Column('closing_balance_paise', sa.BigInteger(), nullable=True),
        sa.Column('total_credits_paise', sa.BigInteger(), nullable=True, default=0),
        sa.Column('total_debits_paise', sa.BigInteger(), nullable=True, default=0),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('parse_warnings_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    op.create_table(
        'reconciliation_lines',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('reconciliation_sessions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('row_number', sa.Integer(), nullable=False),
        sa.Column('txn_date', sa.Date(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('description_normalized', sa.Text(), nullable=True),
        sa.Column('reference_number', sa.String(100), nullable=True),
        sa.Column('debit_paise', sa.BigInteger(), nullable=True, default=0),
        sa.Column('credit_paise', sa.BigInteger(), nullable=True, default=0),
        sa.Column('balance_paise', sa.BigInteger(), nullable=True),
        sa.Column('transaction_type', sa.String(10), nullable=False),
        sa.Column('matched_entity_type', sa.String(20), nullable=True),
        sa.Column('matched_entity_id', sa.Integer(), nullable=True),
        sa.Column('matched_entity_ref', sa.String(100), nullable=True),
        sa.Column('matched_amount_paise', sa.BigInteger(), nullable=True),
        sa.Column('confidence', sa.String(10), nullable=True),
        sa.Column('match_reason', sa.Text(), nullable=True),
        sa.Column('suggested_category', sa.String(50), nullable=True),
        sa.Column('alternative_matches_json', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=True, default='pending'),
        sa.Column('override_entity_type', sa.String(20), nullable=True),
        sa.Column('override_entity_id', sa.Integer(), nullable=True),
        sa.Column('expense_category', sa.String(50), nullable=True),
        sa.Column('action_taken', sa.String(20), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('confirmed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('created_banking_entry_id', sa.Integer(), sa.ForeignKey('banking_entries.id'), nullable=True),
        sa.Column('created_expense_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    op.create_index('ix_reconciliation_lines_session_status', 'reconciliation_lines', ['session_id', 'status'])


def downgrade():
    op.drop_index('ix_reconciliation_lines_session_status', table_name='reconciliation_lines')
    op.drop_table('reconciliation_lines')
    op.drop_table('reconciliation_sessions')
