"""a012 — Add check_out_time to employee_attendance

Revision ID: a012
Revises: a011
"""
from alembic import op
import sqlalchemy as sa

revision = "a012"
down_revision = "a011"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("employee_attendance", sa.Column("check_out_time", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("employee_attendance", "check_out_time")
