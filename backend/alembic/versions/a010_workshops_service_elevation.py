"""Add workshops table and enhance vehicle_maintenance

Revision ID: a010
Revises: a009
Create Date: 2026-03-22 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a010'
down_revision: Union[str, None] = 'a009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create workshops table
    op.create_table(
        'workshops',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('code', sa.String(30), unique=True, nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state', sa.String(100), nullable=True),
        sa.Column('pincode', sa.String(10), nullable=True),
        sa.Column('contact_person', sa.String(200), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('email', sa.String(200), nullable=True),
        sa.Column('specialization', sa.String(100), nullable=True),
        sa.Column('rating', sa.Numeric(2, 1), nullable=True),
        sa.Column('is_empanelled', sa.Boolean(), server_default='true'),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Add new columns to vehicle_maintenance
    op.add_column('vehicle_maintenance', sa.Column('workshop_id', sa.Integer(), sa.ForeignKey('workshops.id'), nullable=True))
    op.add_column('vehicle_maintenance', sa.Column('work_order_number', sa.String(50), nullable=True))
    op.add_column('vehicle_maintenance', sa.Column('parts_description', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('vehicle_maintenance', 'parts_description')
    op.drop_column('vehicle_maintenance', 'work_order_number')
    op.drop_column('vehicle_maintenance', 'workshop_id')
    op.drop_table('workshops')
