# I-06 — Predictive Maintenance
# Computes vehicle risk scores from driving behaviour + service history.

import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.postgres.vehicle import Vehicle, VehicleMaintenance
from app.models.postgres.driver_event import DriverEvent, DriverEventType
from app.models.postgres.intelligence import VehicleRiskScore
from app.services.config_service import get_config_bulk
from app.services.event_bus import event_bus, EventTypes

logger = logging.getLogger(__name__)


async def compute_vehicle_risk_score(
    db: AsyncSession,
    vehicle_id: int,
    score_date: datetime | None = None,
) -> dict:
    """Compute composite risk score for a vehicle."""

    cfg = await get_config_bulk(db, "maintenance.")
    w_brake = cfg.get("maintenance.risk_w_harsh_braking", 2.0)
    w_speed = cfg.get("maintenance.risk_w_overspeed", 1.5)
    w_idle = cfg.get("maintenance.risk_w_idle", 1.0)
    w_service = cfg.get("maintenance.risk_w_service_overdue", 30.0)
    w_age = cfg.get("maintenance.risk_w_age", 2.0)
    healthy_max = cfg.get("maintenance.tier_healthy_max", 30)
    monitor_max = cfg.get("maintenance.tier_monitor_max", 60)

    if score_date is None:
        score_date = datetime.now(timezone.utc)

    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle:
        return {"error": "Vehicle not found"}

    # 1) Driving event counts (last 7 days)
    week_ago = score_date - timedelta(days=7)
    events = await db.execute(
        select(DriverEvent.event_type, func.count(DriverEvent.id))
        .where(
            DriverEvent.vehicle_id == vehicle_id,
            DriverEvent.created_at >= week_ago,
            DriverEvent.created_at <= score_date,
        )
        .group_by(DriverEvent.event_type)
    )
    event_counts = {row[0]: row[1] for row in events}

    brake_count = event_counts.get(DriverEventType.HARSH_BRAKE, 0)
    speed_count = event_counts.get(DriverEventType.OVERSPEED, 0)
    idle_count = event_counts.get(DriverEventType.EXCESSIVE_IDLE, 0)

    brake_component = min(brake_count * w_brake, 20)
    speed_component = min(speed_count * w_speed, 20)
    idle_component = min(idle_count * w_idle, 10)

    # 2) Service overdue ratio
    last_service = await db.execute(
        select(VehicleMaintenance)
        .where(VehicleMaintenance.vehicle_id == vehicle_id)
        .order_by(VehicleMaintenance.service_date.desc())
    )
    last_svc = last_service.scalar_one_or_none()

    service_component = 0.0
    km_to_next = None
    days_to_next = None
    last_service_km = None

    if last_svc:
        last_service_km = float(last_svc.odometer_at_service or 0)
        current_odo = float(vehicle.odometer_reading or 0)

        if last_svc.next_service_km:
            km_to_next = float(last_svc.next_service_km) - current_odo
        if last_svc.next_service_date:
            days_to_next = (last_svc.next_service_date - score_date.date()).days

        # Compute overdue ratio
        if km_to_next is not None and km_to_next < 0:
            # Overdue by km
            overdue_ratio = abs(km_to_next) / max(float(last_svc.next_service_km or 1), 1)
            service_component = min(overdue_ratio * w_service, 30)
        elif days_to_next is not None and days_to_next < 0:
            # Overdue by days
            overdue_ratio = abs(days_to_next) / 90  # normalize to quarter
            service_component = min(overdue_ratio * w_service, 30)
    else:
        # No maintenance record — moderate risk
        service_component = 15

    # 3) Age component
    current_year = score_date.year
    manufacture_year = vehicle.year_of_manufacture or current_year
    age_years = current_year - manufacture_year
    age_component = min(age_years * w_age, 20)

    # 4) Total risk score (cap 100)
    risk_score = min(
        brake_component + speed_component + idle_component +
        service_component + age_component,
        100
    )

    # Determine tier
    if risk_score <= healthy_max:
        tier = "healthy"
    elif risk_score <= monitor_max:
        tier = "monitor"
    else:
        tier = "high_risk"

    # Upsert
    today = score_date.date()
    existing = await db.execute(
        select(VehicleRiskScore).where(
            VehicleRiskScore.vehicle_id == vehicle_id,
            func.date(VehicleRiskScore.score_date) == today,
        )
    )
    record = existing.scalar_one_or_none()
    data = dict(
        risk_score=round(risk_score, 1),
        tier=tier,
        harsh_braking_component=round(brake_component, 1),
        overspeed_component=round(speed_component, 1),
        idle_component=round(idle_component, 1),
        service_overdue_component=round(service_component, 1),
        age_component=round(age_component, 1),
        km_to_next_service=round(km_to_next, 1) if km_to_next is not None else None,
        days_to_next_service=days_to_next,
        last_service_km=last_service_km,
    )

    if record:
        for k, v in data.items():
            setattr(record, k, v)
    else:
        record = VehicleRiskScore(
            vehicle_id=vehicle_id,
            score_date=score_date,
            **data,
        )
        db.add(record)

    await db.flush()

    if tier == "high_risk":
        await event_bus.publish(
            EventTypes.VEHICLE_RISK_HIGH,
            entity_type="vehicle",
            entity_id=str(vehicle.registration_number),
            payload={
                "vehicle_id": vehicle_id,
                "risk_score": round(risk_score, 1),
                "tier": tier,
                "top_factor": _top_factor(data),
            },
            db_session=db,
        )

    return {
        "vehicle_id": vehicle_id,
        "registration": vehicle.registration_number,
        **data,
    }


async def compute_all_vehicle_scores(db: AsyncSession):
    """Batch compute risk scores for all active vehicles (daily job)."""
    vehicles = await db.execute(
        select(Vehicle.id).where(Vehicle.is_active == True)
    )
    results = []
    for (vid,) in vehicles:
        try:
            r = await compute_vehicle_risk_score(db, vid)
            results.append(r)
        except Exception as e:
            logger.error(f"Risk score failed for vehicle {vid}: {e}")
    return results


async def get_fleet_maintenance_summary(db: AsyncSession) -> dict:
    """Summary for fleet manager dashboard."""
    today = datetime.now(timezone.utc).date()

    scores = await db.execute(
        select(VehicleRiskScore).where(
            func.date(VehicleRiskScore.score_date) == today
        )
    )
    all_scores = scores.scalars().all()

    healthy = [s for s in all_scores if s.tier == "healthy"]
    monitor = [s for s in all_scores if s.tier == "monitor"]
    high_risk = [s for s in all_scores if s.tier == "high_risk"]

    return {
        "total_vehicles": len(all_scores),
        "healthy_count": len(healthy),
        "monitor_count": len(monitor),
        "high_risk_count": len(high_risk),
        "high_risk_vehicles": [
            {
                "vehicle_id": s.vehicle_id,
                "risk_score": s.risk_score,
                "km_to_next_service": s.km_to_next_service,
                "days_to_next_service": s.days_to_next_service,
            }
            for s in high_risk
        ],
    }


def _top_factor(data: dict) -> str:
    components = {
        "harsh_braking": data.get("harsh_braking_component", 0),
        "overspeed": data.get("overspeed_component", 0),
        "idle": data.get("idle_component", 0),
        "service_overdue": data.get("service_overdue_component", 0),
        "age": data.get("age_component", 0),
    }
    return max(components, key=components.get)
