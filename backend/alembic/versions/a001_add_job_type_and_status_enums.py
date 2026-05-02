"""add_job_type_and_extended_status_enums

Revision ID: a001_job_type
Revises: 5ace12fa5334
Create Date: 2026-03-18 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a001_job_type'
down_revision: Union[str, None] = '5ace12fa5334'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create jobtype enum (checkfirst in case it already exists) and add job_type column
    jobtype_enum = sa.Enum('OWN', 'MARKET', name='jobtype')
    jobtype_enum.create(op.get_bind(), checkfirst=True)
    op.add_column('jobs', sa.Column('job_type', sa.Enum('OWN', 'MARKET', name='jobtype', create_type=False), nullable=False, server_default='OWN'))

    # 2. Extend jobstatusenum with new values
    op.execute("ALTER TYPE jobstatusenum ADD VALUE IF NOT EXISTS 'DOCUMENTATION'")
    op.execute("ALTER TYPE jobstatusenum ADD VALUE IF NOT EXISTS 'TRIP_CREATED'")
    op.execute("ALTER TYPE jobstatusenum ADD VALUE IF NOT EXISTS 'IN_TRANSIT'")
    op.execute("ALTER TYPE jobstatusenum ADD VALUE IF NOT EXISTS 'DELIVERED'")
    op.execute("ALTER TYPE jobstatusenum ADD VALUE IF NOT EXISTS 'CLOSURE_PENDING'")
    op.execute("ALTER TYPE jobstatusenum ADD VALUE IF NOT EXISTS 'CLOSED'")


def downgrade() -> None:
    op.drop_column('jobs', 'job_type')
    sa.Enum('own', 'market', name='jobtype').drop(op.get_bind(), checkfirst=True)
    # Note: PostgreSQL doesn't support removing enum values
