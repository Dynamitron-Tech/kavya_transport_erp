"""add sync_queue table for offline batch sync

Revision ID: a008
Revises: a007
Create Date: 2026-03-20 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "a008"
down_revision = "a007"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("DO $$ BEGIN CREATE TYPE syncactionstatus AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CONFLICT'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.create_table(
        "sync_queue",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("device_id", sa.String(100), nullable=True),
        sa.Column("action_method", sa.String(10), nullable=False),
        sa.Column("action_path", sa.String(500), nullable=False),
        sa.Column("action_data", sa.JSON(), nullable=True),
        sa.Column("client_timestamp", sa.DateTime(), nullable=True),
        sa.Column("client_action_id", sa.String(100), nullable=True, index=True),
        sa.Column(
            "status",
            sa.Enum("PENDING", "PROCESSING", "COMPLETED", "FAILED", "CONFLICT", name="syncactionstatus", create_type=False),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("server_response", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
        sa.Column("retry_count", sa.Integer(), server_default="0"),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
    )
    op.create_index("ix_sync_queue_user_status", "sync_queue", ["user_id", "status"])


def downgrade():
    op.drop_index("ix_sync_queue_user_status")
    op.drop_table("sync_queue")
    op.execute("DROP TYPE IF EXISTS syncactionstatus")
