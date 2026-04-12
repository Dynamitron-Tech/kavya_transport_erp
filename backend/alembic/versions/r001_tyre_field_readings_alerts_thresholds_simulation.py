"""Add tyre field readings, structured alerts, thresholds, and simulation sessions

Revision ID: r001_tyre_field_tables
Revises: q001_add_dl_fields
Create Date: 2026-04-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "r001_tyre_field_tables"
down_revision = "q001_add_dl_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── tyre_readings ────────────────────────────────────────
    op.create_table(
        "tyre_readings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("vehicle_tyre_id", sa.Integer(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.String(length=20), nullable=False),
        sa.Column("psi", sa.Numeric(5, 1), nullable=False),
        sa.Column("tread_depth_mm", sa.Numeric(4, 1), nullable=True),
        sa.Column(
            "condition",
            sa.Enum("GOOD", "AVERAGE", "WORN", "DAMAGED", name="tyrereadingcondition"),
            nullable=False,
        ),
        sa.Column("temperature_c", sa.Numeric(5, 1), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("photo_url", sa.String(length=500), nullable=True),
        sa.Column("driver_id", sa.Integer(), nullable=True),
        sa.Column("odometer_at_reading", sa.Numeric(12, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vehicle_tyre_id"], ["vehicle_tyres.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["driver_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tyre_readings_vehicle_id", "tyre_readings", ["vehicle_id"])
    op.create_index("ix_tyre_readings_vehicle_tyre_id", "tyre_readings", ["vehicle_tyre_id"])
    op.create_index("ix_tyre_readings_driver_id", "tyre_readings", ["driver_id"])

    # ── tyre_alerts ──────────────────────────────────────────
    op.create_table(
        "tyre_alerts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("vehicle_tyre_id", sa.Integer(), nullable=True),
        sa.Column("vehicle_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.String(length=20), nullable=False),
        sa.Column(
            "alert_type",
            sa.Enum(
                "LOW_PSI", "CRITICAL_PSI", "HIGH_TEMP", "LOW_TREAD",
                "WORN", "DAMAGED", "OVERDUE_INSPECTION", "ROTATION_DUE",
                name="tyrealerttype",
            ),
            nullable=False,
        ),
        sa.Column(
            "severity",
            sa.Enum("WARNING", "CRITICAL", name="tyrealertseverity"),
            nullable=False,
        ),
        sa.Column("current_value", sa.Numeric(8, 2), nullable=True),
        sa.Column("threshold_value", sa.Numeric(8, 2), nullable=True),
        sa.Column(
            "status",
            sa.Enum("OPEN", "ACKNOWLEDGED", "RESOLVED", name="tyrealertstatus"),
            nullable=False,
        ),
        sa.Column("acknowledged_by", sa.Integer(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vehicle_tyre_id"], ["vehicle_tyres.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["acknowledged_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tyre_alerts_vehicle_id", "tyre_alerts", ["vehicle_id"])
    op.create_index("ix_tyre_alerts_vehicle_tyre_id", "tyre_alerts", ["vehicle_tyre_id"])

    # ── tyre_thresholds ──────────────────────────────────────
    op.create_table(
        "tyre_thresholds",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=True),
        sa.Column("min_psi", sa.Numeric(5, 1), nullable=True),
        sa.Column("critical_psi", sa.Numeric(5, 1), nullable=True),
        sa.Column("min_tread_mm", sa.Numeric(4, 1), nullable=True),
        sa.Column("worn_tread_mm", sa.Numeric(4, 1), nullable=True),
        sa.Column("inspection_interval_days", sa.Integer(), nullable=True),
        sa.Column("rotation_interval_km", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tyre_thresholds_vehicle_id", "tyre_thresholds", ["vehicle_id"])

    # ── tyre_simulation_sessions ─────────────────────────────
    op.create_table(
        "tyre_simulation_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=False),
        sa.Column("simulated_km", sa.Integer(), nullable=False),
        sa.Column("simulated_load_kg", sa.Integer(), nullable=True),
        sa.Column(
            "road_type",
            sa.Enum("HIGHWAY", "CITY", "OFFROAD", "MIXED", name="roadtype"),
            nullable=False,
        ),
        sa.Column("climate", sa.String(length=20), nullable=True),
        sa.Column("result_json", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tyre_simulation_sessions_vehicle_id", "tyre_simulation_sessions", ["vehicle_id"])


def downgrade() -> None:
    op.drop_index("ix_tyre_simulation_sessions_vehicle_id", table_name="tyre_simulation_sessions")
    op.drop_table("tyre_simulation_sessions")

    op.drop_index("ix_tyre_thresholds_vehicle_id", table_name="tyre_thresholds")
    op.drop_table("tyre_thresholds")

    op.drop_index("ix_tyre_alerts_vehicle_tyre_id", table_name="tyre_alerts")
    op.drop_index("ix_tyre_alerts_vehicle_id", table_name="tyre_alerts")
    op.drop_table("tyre_alerts")

    op.drop_index("ix_tyre_readings_driver_id", table_name="tyre_readings")
    op.drop_index("ix_tyre_readings_vehicle_tyre_id", table_name="tyre_readings")
    op.drop_index("ix_tyre_readings_vehicle_id", table_name="tyre_readings")
    op.drop_table("tyre_readings")

    op.execute("DROP TYPE IF EXISTS tyrealertstatus")
    op.execute("DROP TYPE IF EXISTS tyrealertseverity")
    op.execute("DROP TYPE IF EXISTS tyrealerttype")
    op.execute("DROP TYPE IF EXISTS tyrereadingcondition")
    op.execute("DROP TYPE IF EXISTS roadtype")
