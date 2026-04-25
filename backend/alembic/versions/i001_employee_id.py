"""add employee_id to users

Revision ID: i001_employee_id
Revises: h001_tms_automation_columns
Create Date: 2026-04-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'i001_employee_id'
down_revision = 'h001_tms_automation_columns'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('employee_id', sa.String(20), nullable=True))
    op.create_unique_constraint('uq_users_employee_id', 'users', ['employee_id'])
    op.create_index('ix_users_employee_id', 'users', ['employee_id'], unique=True)


def downgrade():
    op.drop_index('ix_users_employee_id', table_name='users')
    op.drop_constraint('uq_users_employee_id', 'users', type_='unique')
    op.drop_column('users', 'employee_id')
