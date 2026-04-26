"""Add manual payment proof and auditor review columns to invoices

Revision ID: v001_invoice_payment_proof
Revises: u001_add_transport_type_to_lrs
Create Date: 2026-04-22 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 'v001_invoice_payment_proof'
down_revision = 'u001_add_transport_type_to_lrs'
branch_labels = None
depends_on = None


def upgrade():
    # Manual payment proof columns
    op.add_column('invoices', sa.Column('payment_proof_url', sa.String(500), nullable=True))
    op.add_column('invoices', sa.Column('payment_proof_filename', sa.String(255), nullable=True))
    op.add_column('invoices', sa.Column('payment_proof_note', sa.Text, nullable=True))
    op.add_column('invoices', sa.Column('payment_method_manual', sa.String(50), nullable=True))
    op.add_column('invoices', sa.Column('marked_paid_by_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True))
    op.add_column('invoices', sa.Column('marked_paid_at', sa.DateTime, nullable=True))

    # Auditor review columns
    op.add_column('invoices', sa.Column('auditor_review_status', sa.String(20), nullable=True))
    op.add_column('invoices', sa.Column('auditor_reviewed_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True))
    op.add_column('invoices', sa.Column('auditor_reviewed_at', sa.DateTime, nullable=True))


def downgrade():
    op.drop_column('invoices', 'auditor_reviewed_at')
    op.drop_column('invoices', 'auditor_reviewed_by')
    op.drop_column('invoices', 'auditor_review_status')
    op.drop_column('invoices', 'marked_paid_at')
    op.drop_column('invoices', 'marked_paid_by_user_id')
    op.drop_column('invoices', 'payment_method_manual')
    op.drop_column('invoices', 'payment_proof_note')
    op.drop_column('invoices', 'payment_proof_filename')
    op.drop_column('invoices', 'payment_proof_url')
