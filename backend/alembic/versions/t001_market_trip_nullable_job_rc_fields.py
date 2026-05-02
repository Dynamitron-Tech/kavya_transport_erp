"""Make market_trips.job_id nullable; add owner_name, rc_issue_date, rc_validity_date columns

Revision ID: t001_market_trip_nullable_job_rc_fields
Revises: s001_reconciliation_sessions
Create Date: 2026-04-11 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 't001_market_trip_nullable_job_rc_fields'
down_revision = 's001_reconciliation_sessions'
branch_labels = None
depends_on = None


def upgrade():
    # Make job_id nullable (market trips created from mobile may not have a job)
    op.alter_column(
        'market_trips', 'job_id',
        existing_type=sa.Integer(),
        nullable=True,
    )

    # Add new RC/owner fields
    op.add_column('market_trips', sa.Column('owner_name', sa.String(200), nullable=True))
    op.add_column('market_trips', sa.Column('rc_issue_date', sa.String(20), nullable=True))
    op.add_column('market_trips', sa.Column('rc_validity_date', sa.String(20), nullable=True))

    # Set default values for existing rows so NOT NULL constraint can be dropped
    op.execute("UPDATE market_trips SET client_rate = 0 WHERE client_rate IS NULL")
    op.execute("UPDATE market_trips SET contractor_rate = 0 WHERE contractor_rate IS NULL")


def downgrade():
    op.drop_column('market_trips', 'rc_validity_date')
    op.drop_column('market_trips', 'rc_issue_date')
    op.drop_column('market_trips', 'owner_name')

    op.alter_column(
        'market_trips', 'job_id',
        existing_type=sa.Integer(),
        nullable=False,
    )
