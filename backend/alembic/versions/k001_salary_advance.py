"""create driver_salary_advance_requests table

Revision ID: k001_salary_advance
Revises: j001_driver_leaves_advances
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa

revision = 'k001_salary_advance'
down_revision = 'j001_driver_leaves_advances'
branch_labels = None
depends_on = None


def upgrade():
    # advancestatusenum already exists from j001 — create table with raw SQL to avoid re-creating enum
    op.execute("""
        CREATE TABLE driver_salary_advance_requests (
            id SERIAL PRIMARY KEY,
            driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
            amount NUMERIC(10, 2) NOT NULL,
            status advancestatusenum NOT NULL DEFAULT 'PENDING',
            reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            reviewed_at TIMESTAMP,
            review_note TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX ix_driver_salary_advance_requests_driver_id ON driver_salary_advance_requests (driver_id)")


def downgrade():
    op.drop_index('ix_driver_salary_advance_requests_driver_id', 'driver_salary_advance_requests')
    op.drop_table('driver_salary_advance_requests')
