"""create notifications table and add fcm_token to users

Revision ID: f001
Revises: e001_add_upi_id_to_drivers
Create Date: 2026-03-21 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'f001'
down_revision = 'e001'
branch_labels = None
depends_on = None


def upgrade():
    # Add fcm_token to users
    op.add_column('users', sa.Column('fcm_token', sa.String(512), nullable=True))

    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), primary_key=True, index=True, autoincrement=True),
        sa.Column('event_type', sa.String(60), nullable=False, index=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('target_role', sa.String(30), nullable=True, index=True),
        sa.Column('target_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('data', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}'),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('urgency', sa.String(20), nullable=False, server_default='normal'),
        sa.Column('triggered_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_notifications_target_user_is_read', 'notifications', ['target_user_id', 'is_read'])
    op.create_index('ix_notifications_target_role_is_read', 'notifications', ['target_role', 'is_read'])
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])


def downgrade():
    op.drop_index('ix_notifications_created_at', 'notifications')
    op.drop_index('ix_notifications_target_role_is_read', 'notifications')
    op.drop_index('ix_notifications_target_user_is_read', 'notifications')
    op.drop_table('notifications')
    op.drop_column('users', 'fcm_token')
