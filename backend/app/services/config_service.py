# System Config Seeder — All configurable thresholds
# Run once at startup or via management command

import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

logger = logging.getLogger(__name__)

DEFAULT_CONFIG = [
    # ── I-01 Route Optimisation ──
    ("route.score_weight_distance", "1.0", "float", "route", "Weight for distance_km in route scoring"),
    ("route.score_weight_duration", "0.8", "float", "route", "Weight for duration_min in route scoring"),
    ("route.score_weight_fuel_cost", "1.2", "float", "route", "Weight for fuel_cost_estimate in route scoring"),
    ("route.deviation_threshold_km", "2.0", "float", "route", "GPS deviation distance (km) to trigger rerouting"),
    ("route.traffic_delay_threshold_min", "20", "int", "route", "Traffic delay (min) to trigger rerouting"),
    ("route.override_pause_min", "30", "int", "route", "Minutes to pause deviation check after driver override"),
    ("route.candidate_count", "3", "int", "route", "Number of candidate routes to compute"),

    # ── I-02 ETA Prediction ──
    ("eta.buffer_highway_pct", "8", "int", "eta", "Baseline buffer % for NH routes"),
    ("eta.buffer_state_highway_pct", "15", "int", "eta", "Baseline buffer % for state highway routes"),
    ("eta.buffer_urban_pct", "25", "int", "eta", "Baseline buffer % for mixed/urban last mile"),
    ("eta.historical_mode_days", "60", "int", "eta", "Days of data required to switch to Mode B"),
    ("eta.historical_min_trips", "10", "int", "eta", "Minimum trips per corridor for Mode B"),
    ("eta.recalc_interval_min", "10", "int", "eta", "ETA recalculation interval (minutes)"),
    ("eta.breach_alert_min", "30", "int", "eta", "Alert if ETA breach projected > X min ahead"),
    ("eta.ignore_stop_under_min", "3", "int", "eta", "Ignore 0 km/h pings for stops < X min"),

    # ── I-03 Driver Behaviour ──
    ("driver_score.overspeed_highway_kmph", "80", "int", "driver_score", "Overspeed threshold on highways"),
    ("driver_score.overspeed_city_kmph", "50", "int", "driver_score", "Overspeed threshold in city zones"),
    ("driver_score.harsh_brake_delta_kmph", "25", "int", "driver_score", "Speed drop (km/h) in 60s for harsh braking"),
    ("driver_score.harsh_accel_delta_kmph", "25", "int", "driver_score", "Speed gain (km/h) in 60s for harsh acceleration"),
    ("driver_score.idle_threshold_min", "15", "int", "driver_score", "Continuous idle minutes to flag"),
    ("driver_score.night_start_hour", "23", "int", "driver_score", "Night driving start hour (IST)"),
    ("driver_score.night_end_hour", "5", "int", "driver_score", "Night driving end hour (IST)"),
    ("driver_score.school_zone_speed_kmph", "25", "int", "driver_score", "Speed limit near schools/hospitals"),
    ("driver_score.school_zone_radius_m", "200", "int", "driver_score", "Radius (m) around flagged zones"),
    ("driver_score.deduct_overspeed", "3", "int", "driver_score", "Deduction per overspeed event"),
    ("driver_score.deduct_overspeed_cap", "20", "int", "driver_score", "Max daily overspeed deduction"),
    ("driver_score.deduct_harsh_brake", "4", "int", "driver_score", "Deduction per harsh braking event"),
    ("driver_score.deduct_harsh_brake_cap", "15", "int", "driver_score", "Max daily harsh braking deduction"),
    ("driver_score.deduct_harsh_accel", "2", "int", "driver_score", "Deduction per harsh acceleration event"),
    ("driver_score.deduct_harsh_accel_cap", "10", "int", "driver_score", "Max daily harsh acceleration deduction"),
    ("driver_score.deduct_idle_30min", "5", "int", "driver_score", "Deduction if idle > 30 min total"),
    ("driver_score.deduct_night_per_trip", "5", "int", "driver_score", "Deduction per night trip"),
    ("driver_score.deduct_critical_zone", "15", "int", "driver_score", "Deduction per critical zone overspeed"),
    ("driver_score.tier_elite_min", "90", "int", "driver_score", "Minimum score for Elite tier"),
    ("driver_score.tier_good_min", "75", "int", "driver_score", "Minimum score for Good tier"),
    ("driver_score.tier_attention_min", "60", "int", "driver_score", "Minimum score for Needs Attention tier"),

    # ── I-04 Fuel Theft Detection ──
    ("fuel.theft_variance_litres", "15", "int", "fuel", "Litres variance threshold for Suspected Theft"),
    ("fuel.theft_variance_pct", "12", "int", "fuel", "% variance threshold for Suspected Theft"),
    ("fuel.anomaly_variance_litres", "8", "int", "fuel", "Litres variance threshold for Anomaly"),
    ("fuel.anomaly_variance_pct", "8", "int", "fuel", "% variance threshold for Anomaly"),
    ("fuel.mileage_rolling_days", "30", "int", "fuel", "Days to compute rolling mileage"),
    ("fuel.mileage_min_fills", "10", "int", "fuel", "Minimum fills before using rolling mileage"),
    ("fuel.depot_radius_m", "500", "int", "fuel", "Radius (m) for depot location check"),

    # ── I-05 Expense Fraud Detection ──
    ("expense.location_mismatch_km", "50", "int", "expense", "Distance (km) for location mismatch flag"),
    ("expense.zscore_threshold", "2.5", "float", "expense", "Z-score threshold for unusually high amount"),
    ("expense.duplicate_window_days", "60", "int", "expense", "Days to look back for duplicate detection"),
    ("expense.stats_rolling_days", "90", "int", "expense", "Days to compute rolling mean/stddev"),
    ("expense.biometric_threshold_amount", "500", "int", "expense", "Biometric verification required for expenses >= ₹X"),

    # ── I-06 Predictive Maintenance ──
    ("maintenance.service_alert_days", "7", "int", "maintenance", "Alert when days to next service < X"),
    ("maintenance.risk_harsh_brake_weight", "2.0", "float", "maintenance", "Risk score weight: harsh braking events"),
    ("maintenance.risk_overspeed_weight", "1.5", "float", "maintenance", "Risk score weight: overspeed events"),
    ("maintenance.risk_idle_weight", "1.0", "float", "maintenance", "Risk score weight: idle hours"),
    ("maintenance.risk_service_overdue_weight", "30", "float", "maintenance", "Risk score weight: service overdue ratio"),
    ("maintenance.risk_age_weight", "2.0", "float", "maintenance", "Risk score weight: vehicle age in years"),
    ("maintenance.risk_monitor_threshold", "31", "int", "maintenance", "Risk score threshold for Monitor tier"),
    ("maintenance.risk_high_threshold", "61", "int", "maintenance", "Risk score threshold for High Risk tier"),
    ("maintenance.fuel_efficiency_pct", "85", "int", "maintenance", "Flag vehicle if kmpl < X% of spec"),

    # ── I-07 Trip Intelligence ──
    ("trip_intel.deviation_km", "2.0", "float", "trip_intel", "Route deviation threshold (km)"),
    ("trip_intel.deviation_consecutive_pings", "2", "int", "trip_intel", "Consecutive pings over threshold to alert"),
    ("trip_intel.stop_alert_min", "20", "int", "trip_intel", "Unauthorised stop threshold (minutes)"),
    ("trip_intel.stop_escalate_min", "45", "int", "trip_intel", "Long stop escalation threshold (minutes)"),
    ("trip_intel.delay_alert_min", "30", "int", "trip_intel", "Delay alert threshold (minutes)"),
    ("trip_intel.delay_escalate_min", "60", "int", "trip_intel", "Delay escalation threshold (minutes)"),
    ("trip_intel.night_halt_start_hour", "22", "int", "trip_intel", "Night halt detection start hour"),
    ("trip_intel.night_halt_end_hour", "5", "int", "trip_intel", "Night halt detection end hour"),
    ("trip_intel.night_halt_threshold_min", "45", "int", "trip_intel", "Unregistered night halt threshold (min)"),

    # ── Section 6 Central Intelligence ──
    ("intelligence.daily_job_hour_utc", "20", "int", "intelligence", "Daily job hour (UTC, 20:30 = 02:00 IST)"),
    ("intelligence.inefficient_route_ratio", "1.3", "float", "intelligence", "Flag corridor if avg ratio > X"),
    ("intelligence.high_cost_multiplier", "1.5", "float", "intelligence", "Flag zone if expense > X × avg"),

    # ── Section 8 Redis Caching TTLs ──
    ("cache.admin_pulse_ttl_sec", "30", "int", "cache", "Admin pulse bar cache TTL"),
    ("cache.fleet_status_ttl_sec", "60", "int", "cache", "Fleet status grid cache TTL"),
    ("cache.driver_scores_ttl_sec", "300", "int", "cache", "Driver scores cache TTL"),
    ("cache.doc_expiry_ttl_sec", "3600", "int", "cache", "Document expiry list cache TTL"),
]


async def seed_system_config(db: AsyncSession):
    """Insert default config values. Skip existing keys."""
    from app.models.postgres.intelligence import SystemConfig

    for key, value, vtype, category, desc in DEFAULT_CONFIG:
        exists = await db.execute(
            select(SystemConfig).where(SystemConfig.key == key)
        )
        if exists.scalar_one_or_none() is None:
            db.add(SystemConfig(
                key=key, value=value, value_type=vtype,
                category=category, description=desc,
            ))
    await db.commit()
    logger.info(f"System config seeded: {len(DEFAULT_CONFIG)} keys checked")


async def get_config(db: AsyncSession, key: str, default=None):
    """Fetch a config value, parsed to its declared type."""
    from app.models.postgres.intelligence import SystemConfig
    try:
        result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
        row = result.scalar_one_or_none()
        if row is None:
            return default
        return _parse_value(row.value, row.value_type)
    except Exception:
        return default


async def get_config_bulk(db: AsyncSession, prefix: str) -> dict:
    """Fetch all config values with a given prefix (e.g., 'driver_score.')."""
    from app.models.postgres.intelligence import SystemConfig
    try:
        result = await db.execute(
            select(SystemConfig).where(SystemConfig.key.like(f"{prefix}%"))
        )
        rows = result.scalars().all()
        return {row.key: _parse_value(row.value, row.value_type) for row in rows}
    except Exception:
        return {}


async def seed_event_priority_config(db: AsyncSession):
    """Insert default event priority config rows. Skip existing event_types."""
    from app.models.postgres.intelligence import EventPriorityConfig
    from app.services.event_pipeline import DEFAULT_PRIORITY_MAP, DEFAULT_COOLDOWN

    for event_type, priority in DEFAULT_PRIORITY_MAP.items():
        exists = await db.execute(
            select(EventPriorityConfig).where(EventPriorityConfig.event_type == event_type)
        )
        if exists.scalar_one_or_none() is None:
            cooldown = DEFAULT_COOLDOWN.get(priority, 10)
            db.add(EventPriorityConfig(
                event_type=event_type,
                priority=priority,
                cooldown_minutes=cooldown,
                description=f"Auto-seeded: {event_type}",
            ))
    await db.commit()
    logger.info(f"Event priority config seeded: {len(DEFAULT_PRIORITY_MAP)} types checked")


def _parse_value(value: str, value_type: str):
    if value_type == "int":
        return int(value)
    elif value_type == "float":
        return float(value)
    elif value_type == "bool":
        return value.lower() in ("true", "1", "yes")
    elif value_type == "json":
        return json.loads(value)
    return value
