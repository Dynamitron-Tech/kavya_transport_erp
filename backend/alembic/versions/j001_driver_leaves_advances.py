"""create driver_leaves and driver_advance_requests tables

Revision ID: j001_driver_leaves_advances
Revises: i001_employee_id
Create Date: 2026-04-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'j001_driver_leaves_advances'
down_revision = 'i001_employee_id'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'driver_leaves',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('driver_id', sa.Integer, sa.ForeignKey('drivers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('start_date', sa.Date, nullable=False),
        sa.Column('end_date', sa.Date, nullable=False),
        sa.Column('reason', sa.Text, nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', name='leavestatusenum'), nullable=False, server_default='PENDING'),
        sa.Column('reviewed_by', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime, nullable=True),
        sa.Column('review_note', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_driver_leaves_driver_id', 'driver_leaves', ['driver_id'])
    op.create_index('ix_driver_leaves_status', 'driver_leaves', ['status'])

    op.create_table(
        'driver_advance_requests',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('driver_id', sa.Integer, sa.ForeignKey('drivers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('trip_id', sa.Integer, sa.ForeignKey('trips.id', ondelete='SET NULL'), nullable=True),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False, server_default='1500'),
        sa.Column('status', sa.Enum('PENDING', 'APPROVED', 'REJECTED', name='advancestatusenum'), nullable=False, server_default='PENDING'),
        sa.Column('reviewed_by', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime, nullable=True),
        sa.Column('review_note', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_driver_advance_requests_driver_id', 'driver_advance_requests', ['driver_id'])
    op.create_index('ix_driver_advance_requests_trip_id', 'driver_advance_requests', ['trip_id'])


def downgrade():
    op.drop_index('ix_driver_advance_requests_trip_id', table_name='driver_advance_requests')
    op.drop_index('ix_driver_advance_requests_driver_id', table_name='driver_advance_requests')
    op.drop_table('driver_advance_requests')
    op.drop_index('ix_driver_leaves_status', table_name='driver_leaves')
    op.drop_index('ix_driver_leaves_driver_id', table_name='driver_leaves')
    op.drop_table('driver_leaves')
    op.execute("DROP TYPE IF EXISTS leavestatusenum")
    op.execute("DROP TYPE IF EXISTS advancestatusenum")
