"""add geofence driver_event compliance_alert audit_note tables

Revision ID: a003
Revises: a002_add_supplier_and_market_trip
Create Date: 2026-03-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers
revision = "a003"
down_revision = "a002_supplier_mkt"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Geofence type enum
    geofencetype_enum = sa.Enum(
        "route", "zone", "loading", "unloading", "fuel_station", "restricted",
        name="geofencetype",
    )
    geofencetype_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "geofences",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("geofence_type", geofencetype_enum, nullable=False, server_default="zone"),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id"), nullable=True),
        sa.Column("route_id", sa.Integer(), sa.ForeignKey("routes.id"), nullable=True),
        sa.Column("polygon", JSON, nullable=True),
        sa.Column("center_lat", sa.Float(), nullable=True),
        sa.Column("center_lng", sa.Float(), nullable=True),
        sa.Column("radius_meters", sa.Float(), nullable=True),
        sa.Column("alert_threshold_meters", sa.Float(), server_default="500"),
        sa.Column("speed_limit_kmph", sa.Float(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("branch_id", sa.Integer(), sa.ForeignKey("branches.id"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_geofences_trip_id", "geofences", ["trip_id"])
    op.create_index("ix_geofences_route_id", "geofences", ["route_id"])

    # Alert type & severity enums
    alerttype_enum = sa.Enum("expired", "critical", "warning", "info", name="alerttype")
    alerttype_enum.create(op.get_bind(), checkfirst=True)
    alertseverity_enum = sa.Enum("critical", "high", "medium", "low", name="alertseverity")
    alertseverity_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "compliance_alerts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("documents.id"), nullable=True),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=True),
        sa.Column("driver_id", sa.Integer(), sa.ForeignKey("drivers.id"), nullable=True),
        sa.Column("alert_type", alerttype_enum, nullable=False, server_default="warning"),
        sa.Column("severity", alertseverity_enum, nullable=False, server_default="medium"),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("due_date", sa.DateTime(), nullable=True),
        sa.Column("resolved", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("resolved_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("branch_id", sa.Integer(), sa.ForeignKey("branches.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_compliance_alerts_vehicle_id", "compliance_alerts", ["vehicle_id"])
    op.create_index("ix_compliance_alerts_driver_id", "compliance_alerts", ["driver_id"])
    op.create_index("ix_compliance_alerts_entity", "compliance_alerts", ["entity_type", "entity_id"])

    # Driver event type enum
    drivereventtype_enum = sa.Enum(
        "harsh_brake", "harsh_accel", "overspeed", "night_driving",
        "excessive_idle", "geofence_breach", "unauthorized_halt", "sos",
        name="drivereventtype",
    )
    drivereventtype_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "driver_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("driver_id", sa.Integer(), sa.ForeignKey("drivers.id"), nullable=False),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id"), nullable=True),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=True),
        sa.Column("event_type", drivereventtype_enum, nullable=False),
        sa.Column("severity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("location_name", sa.String(300), nullable=True),
        sa.Column("speed_kmph", sa.Float(), nullable=True),
        sa.Column("details", JSON, nullable=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("branch_id", sa.Integer(), sa.ForeignKey("branches.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_driver_events_driver_id", "driver_events", ["driver_id"])
    op.create_index("ix_driver_events_trip_id", "driver_events", ["trip_id"])
    op.create_index("ix_driver_events_event_type", "driver_events", ["event_type"])

    # Audit note status enum
    auditnotestatus_enum = sa.Enum("open", "resolved", name="auditnotestatus")
    auditnotestatus_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "audit_notes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("resource_type", sa.String(50), nullable=False),
        sa.Column("resource_id", sa.Integer(), nullable=False),
        sa.Column("note_text", sa.Text(), nullable=False),
        sa.Column("status", auditnotestatus_enum, server_default="open", nullable=False),
        sa.Column("auditor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("resolved_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("branch_id", sa.Integer(), sa.ForeignKey("branches.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_notes_resource", "audit_notes", ["resource_type", "resource_id"])


def downgrade() -> None:
    op.drop_table("audit_notes")
    op.drop_table("driver_events")
    op.drop_table("compliance_alerts")
    op.drop_table("geofences")

    for enum_name in ["auditnotestatus", "drivereventtype", "alertseverity", "alerttype", "geofencetype"]:
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
