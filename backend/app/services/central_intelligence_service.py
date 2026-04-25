# Central Intelligence Layer — daily batch job (Section 6)
# Runs at 02:00 IST (configurable). Idempotent per day.

import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case

from app.models.postgres.trip import Trip
from app.models.postgres.vehicle import Vehicle
from app.models.postgres.driver import Driver
from app.models.postgres.intelligence import (
    DailyInsight, DriverMonthlyScore, VehicleRiskScore,
)
from app.services.driver_behaviour_service import compute_daily_score, compute_monthly_score
from app.services.predictive_maintenance_service import compute_all_vehicle_scores
from app.services.expense_fraud_service import recompute_category_stats
from app.services.eta_prediction_service import recompute_corridor_factors
from app.services.config_service import get_config_bulk

logger = logging.getLogger(__name__)


async def run_daily_intelligence(db: AsyncSession, run_date: datetime | None = None):
    """
    Central intelligence job. Must be idempotent per date.
    Analyses:
      1. Best drivers (by monthly score)
      2. Inefficient routes (actual > 1.4× estimated)
      3. High-cost areas (top origin/dest by avg expense)
      4. Fuel efficiency ranking (fleet-wide)
      5. Vehicle risk scores (batch)
      6. Expense category stats (rolling)
      7. ETA corridor correction factors
    """
    if run_date is None:
        run_date = datetime.now(timezone.utc)
    today = run_date.date()

    cfg = await get_config_bulk(db, "intelligence.")
    inefficient_ratio = cfg.get("intelligence.inefficient_route_ratio", 1.4)
    high_cost_multiplier = cfg.get("intelligence.high_cost_route_multiplier", 1.5)

    logger.info(f"[Intelligence] Starting daily job for {today}")

    # Check idempotency
    existing = await db.execute(
        select(func.count(DailyInsight.id)).where(
            func.date(DailyInsight.insight_date) == today,
            DailyInsight.insight_type == "daily_summary",
        )
    )
    if existing.scalar() > 0:
        logger.info(f"[Intelligence] Daily job already ran for {today}, skipping.")
        return {"status": "skipped", "reason": "already_ran"}

    results = {}

    # 1) Compute all driver daily scores
    try:
        drivers = await db.execute(select(Driver.id).where(Driver.is_active == True))
        driver_count = 0
        for (did,) in drivers:
            try:
                await compute_daily_score(db, did, run_date)
                driver_count += 1
            except Exception as e:
                logger.error(f"[Intelligence] Driver {did} daily score failed: {e}")
        results["driver_daily_scores"] = driver_count
    except Exception as e:
        logger.error(f"[Intelligence] Driver scoring batch failed: {e}")

    # 2) Compute monthly scores (for drivers active this month)
    try:
        first_of_month = today.replace(day=1)
        if today.day >= 28 or today == first_of_month:
            active_drivers = await db.execute(
                select(Driver.id).where(Driver.is_active == True)
            )
            for (did,) in active_drivers:
                try:
                    await compute_monthly_score(db, did, today.year, today.month)
                except Exception as e:
                    logger.error(f"[Intelligence] Monthly score failed for driver {did}: {e}")
    except Exception as e:
        logger.error(f"[Intelligence] Monthly scoring batch failed: {e}")

    # 3) Vehicle risk scores — batch
    try:
        vehicle_results = await compute_all_vehicle_scores(db)
        results["vehicle_risk_scores"] = len(vehicle_results)
    except Exception as e:
        logger.error(f"[Intelligence] Vehicle risk scoring failed: {e}")

    # 4) Expense category stats
    try:
        await recompute_category_stats(db)
        results["expense_stats"] = "updated"
    except Exception as e:
        logger.error(f"[Intelligence] Expense stats failed: {e}")

    # 5) ETA corridor factors
    try:
        await recompute_corridor_factors(db)
        results["eta_corridors"] = "updated"
    except Exception as e:
        logger.error(f"[Intelligence] ETA corridor recompute failed: {e}")

    # 6) Best drivers analysis
    try:
        best_drivers = await _analyse_best_drivers(db)
        results["best_drivers"] = best_drivers
    except Exception as e:
        logger.error(f"[Intelligence] Best drivers analysis failed: {e}")

    # 7) Inefficient routes
    try:
        inefficient = await _analyse_inefficient_routes(db, inefficient_ratio)
        results["inefficient_routes"] = inefficient
    except Exception as e:
        logger.error(f"[Intelligence] Inefficient routes analysis failed: {e}")

    # 8) High-cost areas
    try:
        high_cost = await _analyse_high_cost_areas(db, high_cost_multiplier)
        results["high_cost_areas"] = high_cost
    except Exception as e:
        logger.error(f"[Intelligence] High-cost area analysis failed: {e}")

    # 9) Fuel efficiency ranking
    try:
        fuel_ranking = await _analyse_fuel_efficiency(db)
        results["fuel_efficiency"] = fuel_ranking
    except Exception as e:
        logger.error(f"[Intelligence] Fuel efficiency ranking failed: {e}")

    # Persist daily summary insight
    db.add(DailyInsight(
        insight_type="daily_summary",
        data=results,
        insight_date=run_date,
    ))
    await db.flush()

    logger.info(f"[Intelligence] Daily job completed: {results}")
    return {"status": "completed", **results}


async def _analyse_best_drivers(db: AsyncSession) -> list[dict]:
    """Top 5 drivers by current month score."""
    now = datetime.now(timezone.utc)
    scores = await db.execute(
        select(DriverMonthlyScore)
        .where(
            DriverMonthlyScore.year == now.year,
            DriverMonthlyScore.month == now.month,
        )
        .order_by(DriverMonthlyScore.avg_score.desc())
        .limit(5)
    )
    return [
        {
            "driver_id": s.driver_id,
            "avg_score": round(s.avg_score, 1),
            "tier": s.tier,
            "on_time_rate": round(s.on_time_rate, 1) if s.on_time_rate else None,
        }
        for s in scores.scalars()
    ]


async def _analyse_inefficient_routes(db: AsyncSession, ratio_threshold: float) -> list[dict]:
    """Routes where actual distance > ratio × estimated distance."""
    last_30 = datetime.now(timezone.utc) - timedelta(days=30)
    trips = await db.execute(
        select(Trip).where(
            Trip.actual_end_time.isnot(None),
            Trip.start_odometer.isnot(None),
            Trip.end_odometer.isnot(None),
            Trip.created_at >= last_30,
        ).limit(500)
    )
    inefficient = []
    for t in trips.scalars():
        actual_km = float(t.end_odometer - t.start_odometer)
        planned_km = float(t.planned_distance_km or 0)
        if planned_km <= 0:
            continue
        ratio = actual_km / planned_km
        if ratio > ratio_threshold:
            inefficient.append({
                "trip_id": t.id,
                "planned_km": round(planned_km, 1),
                "actual_km": round(actual_km, 1),
                "ratio": round(ratio, 2),
            })
    return sorted(inefficient, key=lambda x: x["ratio"], reverse=True)[:10]


async def _analyse_high_cost_areas(db: AsyncSession, multiplier: float) -> list[dict]:
    """Origin/destination pairs with highest average trip expenses."""
    from app.models.postgres.trip import TripExpense
    last_90 = datetime.now(timezone.utc) - timedelta(days=90)

    result = await db.execute(
        select(
            Trip.origin,
            Trip.destination,
            func.avg(TripExpense.amount).label("avg_expense"),
            func.count(Trip.id).label("trip_count"),
        )
        .join(TripExpense, TripExpense.trip_id == Trip.id)
        .where(Trip.created_at >= last_90)
        .group_by(Trip.origin, Trip.destination)
        .having(func.count(Trip.id) >= 3)
        .order_by(func.avg(TripExpense.amount).desc())
        .limit(10)
    )
    return [
        {
            "origin": row.origin,
            "destination": row.destination,
            "avg_expense": round(float(row.avg_expense), 2),
            "trip_count": row.trip_count,
        }
        for row in result
    ]


async def _analyse_fuel_efficiency(db: AsyncSession) -> list[dict]:
    """Fleet-wide fuel efficiency ranking by actual km/litre."""
    from app.models.postgres.fuel_pump import FuelIssue
    last_30 = datetime.now(timezone.utc) - timedelta(days=30)

    result = await db.execute(
        select(
            Vehicle.id,
            Vehicle.registration_number,
            func.sum(FuelIssue.quantity_litres).label("total_litres"),
        )
        .join(FuelIssue, FuelIssue.vehicle_id == Vehicle.id)
        .where(FuelIssue.created_at >= last_30)
        .group_by(Vehicle.id, Vehicle.registration_number)
        .having(func.sum(FuelIssue.quantity_litres) > 0)
    )

    rankings = []
    for row in result:
        vehicle = await db.get(Vehicle, row.id)
        if not vehicle or not vehicle.odometer_reading:
            continue
        # Approximate: use total fuel vs manufacturer spec
        spec_mileage = float(vehicle.mileage_per_litre or 4)
        total_litres = float(row.total_litres)
        if total_litres > 0:
            rankings.append({
                "vehicle_id": row.id,
                "registration": row.registration_number,
                "total_litres_30d": round(total_litres, 1),
                "spec_mileage_kmpl": spec_mileage,
            })

    return sorted(rankings, key=lambda x: x["total_litres_30d"])[:10]
