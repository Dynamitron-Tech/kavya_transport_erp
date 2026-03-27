# Intelligence Layer Models
# Transport ERP — I-01 through I-07, Event Bus, Workflows, Daily Insights

import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey,
    DateTime, Text, Numeric, Float, Enum as SQLEnum, JSON, Index
)
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin


# ═══════════════════════════════════════════════════════════════
# System Configuration — All configurable thresholds (Section 8 note)
# ═══════════════════════════════════════════════════════════════

class SystemConfig(Base, TimestampMixin):
    """Key-value store for all configurable thresholds.
    Admin can adjust from dashboard. Never hardcode thresholds."""

    __tablename__ = "system_config"

    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)  # JSON-encoded value
    value_type = Column(String(20), nullable=False, default="string")  # string, int, float, json, bool
    category = Column(String(50), nullable=False, index=True)  # route, eta, driver_score, fuel, expense, maintenance, trip_intel
    description = Column(Text, nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)


# ═══════════════════════════════════════════════════════════════
# I-01 — Route Optimisation
# ═══════════════════════════════════════════════════════════════

class RouteOptimizationResult(Base, TimestampMixin):
    """Stores candidate routes and selected optimal route per trip."""

    __tablename__ = "route_optimization_results"

    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)

    # Selected route
    planned_route_polyline = Column(Text, nullable=True)
    actual_route_polyline = Column(Text, nullable=True)
    route_score = Column(Float, nullable=True)

    # All candidates (JSON array of {polyline, distance_km, duration_min, fuel_cost_estimate, score})
    candidate_routes = Column(JSON, nullable=True)

    # Rerouting
    reroute_count = Column(Integer, default=0)
    override_count = Column(Integer, default=0)
    reroute_log = Column(JSON, nullable=True)  # [{old_route, new_route, reason, timestamp}]

    trip = relationship("Trip", foreign_keys=[trip_id])


# ═══════════════════════════════════════════════════════════════
# I-02 — ETA Prediction
# ═══════════════════════════════════════════════════════════════

class ETACorrectionFactor(Base, TimestampMixin):
    """Rolling correction factor per route corridor (origin_district → destination_district)."""

    __tablename__ = "eta_correction_factors"

    origin_district = Column(String(100), nullable=False, index=True)
    destination_district = Column(String(100), nullable=False, index=True)
    correction_factor = Column(Float, nullable=False, default=1.0)
    sample_count = Column(Integer, nullable=False, default=0)
    mode = Column(String(10), nullable=False, default="A")  # A=baseline, B=historical
    last_computed = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_eta_corridor", "origin_district", "destination_district"),
    )


class TripETALog(Base, TimestampMixin):
    """Real-time ETA predictions logged every 10 minutes per active trip."""

    __tablename__ = "trip_eta_logs"

    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False, index=True)
    predicted_arrival = Column(DateTime, nullable=False)
    committed_arrival = Column(DateTime, nullable=True)
    km_remaining = Column(Float, nullable=True)
    avg_speed_20min = Column(Float, nullable=True)
    correction_factor = Column(Float, nullable=True)
    is_breach_projected = Column(Boolean, default=False)
    breach_minutes = Column(Integer, nullable=True)

    trip = relationship("Trip", foreign_keys=[trip_id])


# ═══════════════════════════════════════════════════════════════
# I-03 — Driver Behaviour / Daily Score
# ═══════════════════════════════════════════════════════════════

class DriverDailyScore(Base, TimestampMixin):
    """Computed daily driver score. Read-only — never editable."""

    __tablename__ = "driver_daily_scores"

    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False, index=True)
    score_date = Column(DateTime, nullable=False, index=True)
    base_score = Column(Integer, default=100)
    overspeed_deduction = Column(Integer, default=0)
    harsh_brake_deduction = Column(Integer, default=0)
    harsh_accel_deduction = Column(Integer, default=0)
    idle_deduction = Column(Integer, default=0)
    night_driving_deduction = Column(Integer, default=0)
    critical_zone_deduction = Column(Integer, default=0)
    final_score = Column(Integer, nullable=False)
    tier = Column(String(20), nullable=False)  # elite, good, needs_attention, high_risk
    event_details = Column(JSON, nullable=True)  # breakdown of each deduction

    driver = relationship("Driver", foreign_keys=[driver_id])

    __table_args__ = (
        Index("ix_driver_daily_score", "driver_id", "score_date", unique=True),
    )


class DriverMonthlyScore(Base, TimestampMixin):
    """Aggregated monthly driver score."""

    __tablename__ = "driver_monthly_scores"

    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    avg_score = Column(Float, nullable=False)
    tier = Column(String(20), nullable=False)
    total_events = Column(Integer, default=0)
    on_time_rate = Column(Float, nullable=True)
    expense_accuracy = Column(Float, nullable=True)

    driver = relationship("Driver", foreign_keys=[driver_id])

    __table_args__ = (
        Index("ix_driver_monthly", "driver_id", "year", "month", unique=True),
    )


# ═══════════════════════════════════════════════════════════════
# I-05 — Expense Fraud Detection
# ═══════════════════════════════════════════════════════════════

class ExpenseFraudFlagType(enum.Enum):
    LOCATION_MISMATCH = "LOCATION_MISMATCH"
    UNUSUALLY_HIGH = "UNUSUALLY_HIGH"
    POSSIBLE_DUPLICATE = "POSSIBLE_DUPLICATE"
    DATE_MISMATCH = "DATE_MISMATCH"


class ExpenseFraudFlag(Base, TimestampMixin):
    """Fraud flags attached to expense entries. Flags are additive."""

    __tablename__ = "expense_fraud_flags"

    expense_id = Column(Integer, ForeignKey("trip_expenses.id"), nullable=False, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)

    flag_type = Column(SQLEnum(ExpenseFraudFlagType), nullable=False)
    severity = Column(String(20), nullable=False, default="warning")  # warning, high, critical
    description = Column(Text, nullable=False)
    details = Column(JSON, nullable=True)  # z_score, distance_km, duplicate_expense_id, etc.

    # Accountant review
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledgement_note = Column(Text, nullable=True)

    expense = relationship("TripExpense", foreign_keys=[expense_id])


# ═══════════════════════════════════════════════════════════════
# I-06 — Predictive Maintenance / Vehicle Risk Score
# ═══════════════════════════════════════════════════════════════

class VehicleRiskScore(Base, TimestampMixin):
    """Breakdown risk score per vehicle. Recomputed daily. Read-only."""

    __tablename__ = "vehicle_risk_scores"

    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False, index=True)
    score_date = Column(DateTime, nullable=False, index=True)
    risk_score = Column(Float, nullable=False)
    tier = Column(String(20), nullable=False)  # healthy, monitor, high_risk

    # Components
    harsh_braking_component = Column(Float, default=0)
    overspeed_component = Column(Float, default=0)
    idle_component = Column(Float, default=0)
    service_overdue_component = Column(Float, default=0)
    age_component = Column(Float, default=0)

    # Maintenance predictions
    km_to_next_service = Column(Float, nullable=True)
    days_to_next_service = Column(Float, nullable=True)
    last_service_km = Column(Float, nullable=True)

    vehicle = relationship("Vehicle", foreign_keys=[vehicle_id])

    __table_args__ = (
        Index("ix_vehicle_risk", "vehicle_id", "score_date", unique=True),
    )


# ═══════════════════════════════════════════════════════════════
# I-07 — Trip Intelligence Alerts
# ═══════════════════════════════════════════════════════════════

class TripAlertType(enum.Enum):
    ROUTE_DEVIATION = "ROUTE_DEVIATION"
    LONG_STOP = "LONG_STOP"
    DELAY = "DELAY"
    UNREGISTERED_NIGHT_HALT = "UNREGISTERED_NIGHT_HALT"
    ESCALATED_DELAY = "ESCALATED_DELAY"


class TripIntelligenceAlert(Base, TimestampMixin):
    """Real-time trip intelligence alerts from I-07."""

    __tablename__ = "trip_intelligence_alerts"

    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)

    alert_type = Column(SQLEnum(TripAlertType), nullable=False, index=True)
    severity = Column(String(20), nullable=False, default="warning")
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    speed_kmph = Column(Float, nullable=True)

    # Deviation specific
    deviation_km = Column(Float, nullable=True)
    stop_duration_min = Column(Integer, nullable=True)
    delay_minutes = Column(Integer, nullable=True)

    # Resolution
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolution = Column(Text, nullable=True)

    trip = relationship("Trip", foreign_keys=[trip_id])


# ═══════════════════════════════════════════════════════════════
# Section 2 — Event Bus Events
# ═══════════════════════════════════════════════════════════════

class EventBusEvent(Base, TimestampMixin):
    """Persistent record of every event published to the event bus.
    Extended with priority, deduplication, escalation, and suppression fields."""

    __tablename__ = "event_bus_events"

    event_type = Column(String(50), nullable=False, index=True)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(String(100), nullable=True)
    payload = Column(JSON, nullable=True)
    triggered_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    notified_roles = Column(JSON, nullable=True)  # ["admin", "manager"]

    # ── Priority & Escalation (Event Priority Upgrade) ──
    priority = Column(String(2), nullable=False, default="P2")  # P0, P1, P2, P3
    escalation_level = Column(Integer, nullable=False, default=0)  # 0, 1, 2
    occurrence_count = Column(Integer, nullable=False, default=1)
    last_seen_at = Column(DateTime, nullable=True)
    dedup_key = Column(String(64), nullable=True)  # sha256(event_type:entity_id)

    # ── Acknowledgement ──
    is_acknowledged = Column(Boolean, nullable=False, default=False)
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledgement_note = Column(Text, nullable=True)

    # ── Suppression ──
    suppressed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_event_type_triggered", "event_type", "triggered_at"),
        Index("ix_events_dedup", "dedup_key", "triggered_at"),
        Index("ix_events_active", "priority", "is_acknowledged", "suppressed_at",
              postgresql_where=Column("suppressed_at").is_(None)),
    )


class EventEscalation(Base, TimestampMixin):
    """Records each escalation step for an event."""

    __tablename__ = "event_escalations"

    event_id = Column(Integer, ForeignKey("event_bus_events.id"), nullable=False, index=True)
    from_level = Column(Integer, nullable=False)
    to_level = Column(Integer, nullable=False)
    escalated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    notified_role = Column(String(32), nullable=False)
    notification_channel = Column(String(16), nullable=False)  # fcm, whatsapp, in_app


class NotificationQueue(Base, TimestampMixin):
    """Queued notifications (for quiet hours and deferred delivery)."""

    __tablename__ = "notification_queue"

    event_id = Column(Integer, ForeignKey("event_bus_events.id"), nullable=False, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    channel = Column(String(16), nullable=False)  # fcm, whatsapp
    scheduled_for = Column(DateTime, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    status = Column(String(16), nullable=False, default="pending")  # pending, sent, failed

    __table_args__ = (
        Index("ix_notif_queue_pending", "scheduled_for",
              postgresql_where=Column("status") == "pending"),
    )


class EventPriorityConfig(Base, TimestampMixin):
    """Admin-configurable priority mapping per event type."""

    __tablename__ = "event_priority_config"

    event_type = Column(String(80), nullable=False, unique=True, index=True)
    priority = Column(String(2), nullable=False, default="P2")
    cooldown_minutes = Column(Integer, nullable=False, default=10)
    description = Column(Text, nullable=True)


class UserNotificationPreference(Base, TimestampMixin):
    """Per-user notification preferences (quiet hours, channels)."""

    __tablename__ = "user_notification_preferences"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    quiet_hours_enabled = Column(Boolean, nullable=False, default=True)
    quiet_start = Column(String(5), nullable=False, default="22:00")  # HH:MM
    quiet_end = Column(String(5), nullable=False, default="07:00")    # HH:MM


# ═══════════════════════════════════════════════════════════════
# Section 3 — Audit Log (PostgreSQL, read-only)
# ═══════════════════════════════════════════════════════════════

class AuditLog(Base, TimestampMixin):
    """Immutable audit trail for every state-changing action."""

    __tablename__ = "audit_logs_pg"

    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_role = Column(String(30), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(String(100), nullable=True)
    previous_state = Column(JSON, nullable=True)
    new_state = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    device_id = Column(String(100), nullable=True)

    __table_args__ = (
        Index("ix_audit_actor_action", "actor_id", "action"),
        Index("ix_audit_entity", "entity_type", "entity_id"),
    )


# ═══════════════════════════════════════════════════════════════
# Section 5 — Workflow State Machine Definitions
# ═══════════════════════════════════════════════════════════════

class TripWorkflowStatus(enum.Enum):
    CREATED = "CREATED"
    ASSIGNED = "ASSIGNED"
    INSPECTION_PENDING = "INSPECTION_PENDING"
    INSPECTION_COMPLETE = "INSPECTION_COMPLETE"
    IN_TRANSIT = "IN_TRANSIT"
    AT_DELIVERY = "AT_DELIVERY"
    EPOD_PENDING = "EPOD_PENDING"
    EPOD_COMPLETE = "EPOD_COMPLETE"
    COMPLETED = "COMPLETED"
    INVOICE_GENERATED = "INVOICE_GENERATED"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"
    SOS_ACTIVE = "SOS_ACTIVE"


class FuelWorkflowStatus(enum.Enum):
    LOG_ENTERED = "LOG_ENTERED"
    MISMATCH_CHECK_RUNNING = "MISMATCH_CHECK_RUNNING"
    MATCHED = "MATCHED"
    MISMATCH_FLAGGED = "MISMATCH_FLAGGED"
    UNDER_INVESTIGATION = "UNDER_INVESTIGATION"
    EXPLAINED = "EXPLAINED"
    CONFIRMED_THEFT = "CONFIRMED_THEFT"
    FALSE_POSITIVE = "FALSE_POSITIVE"


class ExpenseWorkflowStatus(enum.Enum):
    PHOTO_UPLOADED = "PHOTO_UPLOADED"
    OCR_PROCESSING = "OCR_PROCESSING"
    FRAUD_CHECK_RUNNING = "FRAUD_CHECK_RUNNING"
    CLEAN = "CLEAN"
    FLAGGED = "FLAGGED"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    FLAGGED_AWAITING_REVIEW = "FLAGGED_AWAITING_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    INCLUDED_IN_PAYROLL = "INCLUDED_IN_PAYROLL"
    PAID = "PAID"


# ═══════════════════════════════════════════════════════════════
# Section 6 — Central Intelligence Daily Insights
# ═══════════════════════════════════════════════════════════════

class DailyInsight(Base, TimestampMixin):
    """Pre-computed intelligence results. Dashboards read from here."""

    __tablename__ = "daily_insights"

    insight_date = Column(DateTime, nullable=False, index=True)
    insight_type = Column(String(50), nullable=False, index=True)
    # Types: best_drivers, inefficient_routes, high_cost_areas, fuel_efficiency_ranking
    data = Column(JSON, nullable=False)
    is_latest = Column(Boolean, default=True)

    __table_args__ = (
        Index("ix_insight_type_date", "insight_type", "insight_date"),
    )


# ═══════════════════════════════════════════════════════════════
# Expense stats cache for fraud detection (rolling averages)
# ═══════════════════════════════════════════════════════════════

class ExpenseCategoryStats(Base, TimestampMixin):
    """Rolling mean/stddev per expense category for z-score fraud detection."""

    __tablename__ = "expense_category_stats"

    category = Column(String(50), nullable=False, index=True)
    mean_amount_paise = Column(Integer, nullable=False, default=0)
    stddev_amount_paise = Column(Integer, nullable=False, default=1)
    sample_count = Column(Integer, nullable=False, default=0)
    last_computed = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_expense_cat_stats", "category", unique=True),
    )
