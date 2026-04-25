"""add intelligence layer tables

Revision ID: a006
Revises: a005
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "a006"
down_revision = "a005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Enums (idempotent) ──
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE tripworkflowstatus AS ENUM (
                'CREATED','ASSIGNED','INSPECTION_PENDING','INSPECTION_COMPLETE',
                'IN_TRANSIT','AT_DELIVERY','EPOD_PENDING','EPOD_COMPLETE',
                'COMPLETED','INVOICE_GENERATED','CLOSED','CANCELLED','SOS_ACTIVE'
            );
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE fuelworkflowstatus AS ENUM (
                'LOG_ENTERED','MISMATCH_CHECK_RUNNING','MATCHED','MISMATCH_FLAGGED',
                'UNDER_INVESTIGATION','EXPLAINED','CONFIRMED_THEFT','FALSE_POSITIVE'
            );
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE expenseworkflowstatus AS ENUM (
                'PHOTO_UPLOADED','OCR_PROCESSING','FRAUD_CHECK_RUNNING','CLEAN',
                'FLAGGED','AWAITING_APPROVAL','FLAGGED_AWAITING_REVIEW','APPROVED',
                'REJECTED','INCLUDED_IN_PAYROLL','PAID'
            );
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE expensefraudflagtype AS ENUM (
                'LOCATION_MISMATCH','UNUSUALLY_HIGH','POSSIBLE_DUPLICATE','DATE_MISMATCH'
            );
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE tripalerttype AS ENUM (
                'ROUTE_DEVIATION','LONG_STOP','DELAY','UNREGISTERED_NIGHT_HALT','ESCALATED_DELAY'
            );
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)

    # ── system_config ──
    op.create_table(
        "system_config",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("key", sa.String(100), nullable=False, unique=True),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("value_type", sa.String(20), nullable=False, server_default="string"),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("updated_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_system_config_key", "system_config", ["key"], unique=True)
    op.create_index("ix_system_config_category", "system_config", ["category"])

    # ── route_optimization_results ──
    op.create_table(
        "route_optimization_results",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id"), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=True),
        sa.Column("planned_route_polyline", sa.Text(), nullable=True),
        sa.Column("actual_route_polyline", sa.Text(), nullable=True),
        sa.Column("route_score", sa.Float(), nullable=True),
        sa.Column("candidate_routes", sa.JSON(), nullable=True),
        sa.Column("reroute_count", sa.Integer(), server_default="0"),
        sa.Column("override_count", sa.Integer(), server_default="0"),
        sa.Column("reroute_log", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_route_opt_trip", "route_optimization_results", ["trip_id"])

    # ── eta_correction_factors ──
    op.create_table(
        "eta_correction_factors",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("origin_district", sa.String(100), nullable=False),
        sa.Column("destination_district", sa.String(100), nullable=False),
        sa.Column("correction_factor", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("sample_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mode", sa.String(10), nullable=False, server_default="A"),
        sa.Column("last_computed", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_eta_corridor", "eta_correction_factors", ["origin_district", "destination_district"])

    # ── trip_eta_logs ──
    op.create_table(
        "trip_eta_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id"), nullable=False),
        sa.Column("predicted_arrival", sa.DateTime(timezone=True), nullable=False),
        sa.Column("committed_arrival", sa.DateTime(timezone=True), nullable=True),
        sa.Column("km_remaining", sa.Float(), nullable=True),
        sa.Column("avg_speed_20min", sa.Float(), nullable=True),
        sa.Column("correction_factor", sa.Float(), nullable=True),
        sa.Column("is_breach_projected", sa.Boolean(), server_default="false"),
        sa.Column("breach_minutes", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trip_eta_logs_trip_id", "trip_eta_logs", ["trip_id"])

    # ── driver_daily_scores ──
    op.create_table(
        "driver_daily_scores",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("driver_id", sa.Integer(), sa.ForeignKey("drivers.id"), nullable=False),
        sa.Column("score_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("base_score", sa.Integer(), server_default="100"),
        sa.Column("overspeed_deduction", sa.Integer(), server_default="0"),
        sa.Column("harsh_brake_deduction", sa.Integer(), server_default="0"),
        sa.Column("harsh_accel_deduction", sa.Integer(), server_default="0"),
        sa.Column("idle_deduction", sa.Integer(), server_default="0"),
        sa.Column("night_driving_deduction", sa.Integer(), server_default="0"),
        sa.Column("critical_zone_deduction", sa.Integer(), server_default="0"),
        sa.Column("final_score", sa.Integer(), nullable=False),
        sa.Column("tier", sa.String(20), nullable=False),
        sa.Column("event_details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_driver_daily_score", "driver_daily_scores", ["driver_id", "score_date"], unique=True)

    # ── driver_monthly_scores ──
    op.create_table(
        "driver_monthly_scores",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("driver_id", sa.Integer(), sa.ForeignKey("drivers.id"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("avg_score", sa.Float(), nullable=False),
        sa.Column("tier", sa.String(20), nullable=False),
        sa.Column("total_events", sa.Integer(), server_default="0"),
        sa.Column("on_time_rate", sa.Float(), nullable=True),
        sa.Column("expense_accuracy", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_driver_monthly", "driver_monthly_scores", ["driver_id", "year", "month"], unique=True)

    # ── expense_fraud_flags ──
    op.create_table(
        "expense_fraud_flags",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("expense_id", sa.Integer(), sa.ForeignKey("trip_expenses.id"), nullable=False),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id"), nullable=True),
        sa.Column("driver_id", sa.Integer(), sa.ForeignKey("drivers.id"), nullable=True),
        sa.Column("flag_type", sa.VARCHAR(50), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="warning"),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("acknowledged_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledgement_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_expense_fraud_flags_expense", "expense_fraud_flags", ["expense_id"])

    # ── vehicle_risk_scores ──
    op.create_table(
        "vehicle_risk_scores",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("score_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column("tier", sa.String(20), nullable=False),
        sa.Column("harsh_braking_component", sa.Float(), server_default="0"),
        sa.Column("overspeed_component", sa.Float(), server_default="0"),
        sa.Column("idle_component", sa.Float(), server_default="0"),
        sa.Column("service_overdue_component", sa.Float(), server_default="0"),
        sa.Column("age_component", sa.Float(), server_default="0"),
        sa.Column("km_to_next_service", sa.Float(), nullable=True),
        sa.Column("days_to_next_service", sa.Float(), nullable=True),
        sa.Column("last_service_km", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vehicle_risk", "vehicle_risk_scores", ["vehicle_id", "score_date"], unique=True)

    # ── trip_intelligence_alerts ──
    op.create_table(
        "trip_intelligence_alerts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id"), nullable=False),
        sa.Column("driver_id", sa.Integer(), sa.ForeignKey("drivers.id"), nullable=True),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=True),
        sa.Column("alert_type", sa.VARCHAR(50), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="warning"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("speed_kmph", sa.Float(), nullable=True),
        sa.Column("deviation_km", sa.Float(), nullable=True),
        sa.Column("stop_duration_min", sa.Integer(), nullable=True),
        sa.Column("delay_minutes", sa.Integer(), nullable=True),
        sa.Column("acknowledged_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trip_intel_alerts_trip", "trip_intelligence_alerts", ["trip_id"])
    op.create_index("ix_trip_intel_alerts_type", "trip_intelligence_alerts", ["alert_type"])

    # ── event_bus_events ──
    op.create_table(
        "event_bus_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.String(100), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("notified_roles", sa.JSON(), nullable=True),
        sa.Column("acknowledged_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_event_type_triggered", "event_bus_events", ["event_type", "triggered_at"])
    op.create_index("ix_event_bus_entity", "event_bus_events", ["entity_type", "entity_id"])

    # ── audit_logs_pg ──
    op.create_table(
        "audit_logs_pg",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("actor_role", sa.String(30), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.String(100), nullable=True),
        sa.Column("previous_state", sa.JSON(), nullable=True),
        sa.Column("new_state", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("device_id", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_actor_action", "audit_logs_pg", ["actor_id", "action"])
    op.create_index("ix_audit_entity", "audit_logs_pg", ["entity_type", "entity_id"])

    # ── daily_insights ──
    op.create_table(
        "daily_insights",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("insight_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("insight_type", sa.String(50), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("is_latest", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_insight_type_date", "daily_insights", ["insight_type", "insight_date"])

    # ── expense_category_stats ──
    op.create_table(
        "expense_category_stats",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("mean_amount_paise", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("stddev_amount_paise", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("sample_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_computed", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_expense_cat_stats", "expense_category_stats", ["category"], unique=True)


def downgrade() -> None:
    op.drop_table("expense_category_stats")
    op.drop_table("daily_insights")
    op.drop_table("audit_logs_pg")
    op.drop_table("event_bus_events")
    op.drop_table("trip_intelligence_alerts")
    op.drop_table("vehicle_risk_scores")
    op.drop_table("expense_fraud_flags")
    op.drop_table("driver_monthly_scores")
    op.drop_table("driver_daily_scores")
    op.drop_table("trip_eta_logs")
    op.drop_table("eta_correction_factors")
    op.drop_table("route_optimization_results")
    op.drop_table("system_config")
    op.execute("DROP TYPE IF EXISTS tripalerttype")
    op.execute("DROP TYPE IF EXISTS expensefraudflagtype")
    op.execute("DROP TYPE IF EXISTS expenseworkflowstatus")
    op.execute("DROP TYPE IF EXISTS fuelworkflowstatus")
    op.execute("DROP TYPE IF EXISTS tripworkflowstatus")
