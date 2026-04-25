"""event priority and alert fatigue prevention system

Revision ID: a007
Revises: a006
Create Date: 2026-03-19 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "a007"
down_revision = "a006"
branch_labels = None
depends_on = None


def upgrade():
    # ── Extend event_bus_events with priority/dedup/escalation/suppression ──
    op.add_column("event_bus_events", sa.Column("priority", sa.String(2), nullable=False, server_default="P2"))
    op.add_column("event_bus_events", sa.Column("escalation_level", sa.SmallInteger(), nullable=False, server_default="0"))
    op.add_column("event_bus_events", sa.Column("occurrence_count", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("event_bus_events", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("event_bus_events", sa.Column("dedup_key", sa.String(64), nullable=True))
    op.add_column("event_bus_events", sa.Column("is_acknowledged", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("event_bus_events", sa.Column("acknowledgement_note", sa.Text(), nullable=True))
    op.add_column("event_bus_events", sa.Column("suppressed_at", sa.DateTime(timezone=True), nullable=True))

    op.create_index("ix_events_dedup", "event_bus_events", ["dedup_key", "triggered_at"])
    op.create_index(
        "ix_events_active", "event_bus_events",
        ["priority", "is_acknowledged", "suppressed_at"],
        postgresql_where=sa.text("suppressed_at IS NULL"),
    )

    # ── event_escalations ──
    op.create_table(
        "event_escalations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("event_bus_events.id"), nullable=False),
        sa.Column("from_level", sa.SmallInteger(), nullable=False),
        sa.Column("to_level", sa.SmallInteger(), nullable=False),
        sa.Column("escalated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("notified_role", sa.String(32), nullable=False),
        sa.Column("notification_channel", sa.String(16), nullable=False),
    )
    op.create_index("ix_event_escalations_event_id", "event_escalations", ["event_id"])

    # ── notification_queue ──
    op.create_table(
        "notification_queue",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("event_bus_events.id"), nullable=False),
        sa.Column("target_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("channel", sa.String(16), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
    )
    op.create_index(
        "ix_notif_queue_pending", "notification_queue", ["scheduled_for"],
        postgresql_where=sa.text("status = 'pending'"),
    )

    # ── event_priority_config (admin-editable priority mapping) ──
    op.create_table(
        "event_priority_config",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("event_type", sa.String(80), nullable=False, unique=True),
        sa.Column("priority", sa.String(2), nullable=False, server_default="P2"),
        sa.Column("cooldown_minutes", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.create_index("ix_event_priority_config_event_type", "event_priority_config", ["event_type"])

    # ── user_notification_preferences ──
    op.create_table(
        "user_notification_preferences",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("quiet_hours_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("quiet_start", sa.String(5), nullable=False, server_default="22:00"),
        sa.Column("quiet_end", sa.String(5), nullable=False, server_default="07:00"),
    )
    op.create_index("ix_user_notif_prefs_user_id", "user_notification_preferences", ["user_id"])


def downgrade():
    op.drop_table("user_notification_preferences")
    op.drop_table("event_priority_config")
    op.drop_table("notification_queue")
    op.drop_table("event_escalations")

    op.drop_index("ix_events_active", table_name="event_bus_events")
    op.drop_index("ix_events_dedup", table_name="event_bus_events")

    op.drop_column("event_bus_events", "suppressed_at")
    op.drop_column("event_bus_events", "acknowledgement_note")
    op.drop_column("event_bus_events", "is_acknowledged")
    op.drop_column("event_bus_events", "dedup_key")
    op.drop_column("event_bus_events", "last_seen_at")
    op.drop_column("event_bus_events", "occurrence_count")
    op.drop_column("event_bus_events", "escalation_level")
    op.drop_column("event_bus_events", "priority")
