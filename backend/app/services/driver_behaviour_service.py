# I-03 — Driver Behaviour Monitoring
# Analyses GPS data to detect events. Computes daily/monthly scores.

import logging
from datetime import datetime, timezone, timedelta, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.postgres.intelligence import DriverDailyScore, DriverMonthlyScore
from app.models.postgres.driver_event import DriverEvent, DriverEventType
from app.services.config_service import get_config_bulk
from app.services.event_bus import event_bus, EventTypes

logger = logging.getLogger(__name__)


async def compute_daily_score(
    db: AsyncSession,
    driver_id: int,
    score_date: date | None = None,
) -> dict:
    """Compute daily driver behaviour score from events."""

    if score_date is None:
        score_date = date.today()

    cfg = await get_config_bulk(db, "driver_score.")
    ded = {
        "overspeed": cfg.get("driver_score.deduct_overspeed", 3),
        "overspeed_cap": cfg.get("driver_score.deduct_overspeed_cap", 20),
        "harsh_brake": cfg.get("driver_score.deduct_harsh_brake", 4),
        "harsh_brake_cap": cfg.get("driver_score.deduct_harsh_brake_cap", 15),
        "harsh_accel": cfg.get("driver_score.deduct_harsh_accel", 2),
        "harsh_accel_cap": cfg.get("driver_score.deduct_harsh_accel_cap", 10),
        "idle_30min": cfg.get("driver_score.deduct_idle_30min", 5),
        "night_per_trip": cfg.get("driver_score.deduct_night_per_trip", 5),
        "critical_zone": cfg.get("driver_score.deduct_critical_zone", 15),
    }
    tiers = {
        "elite": cfg.get("driver_score.tier_elite_min", 90),
        "good": cfg.get("driver_score.tier_good_min", 75),
        "attention": cfg.get("driver_score.tier_attention_min", 60),
    }

    # Fetch events for this driver on this date
    day_start = datetime.combine(score_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    result = await db.execute(
        select(DriverEvent).where(
            DriverEvent.driver_id == driver_id,
            DriverEvent.created_at >= day_start,
            DriverEvent.created_at < day_end,
        )
    )
    events = result.scalars().all()

    # Count events by type
    counts = {}
    for e in events:
        et = e.event_type.value
        counts[et] = counts.get(et, 0) + 1

    # Calculate deductions
    overspeed_ded = min(
        counts.get("OVERSPEED", 0) * ded["overspeed"],
        ded["overspeed_cap"]
    )
    harsh_brake_ded = min(
        counts.get("HARSH_BRAKE", 0) * ded["harsh_brake"],
        ded["harsh_brake_cap"]
    )
    harsh_accel_ded = min(
        counts.get("HARSH_ACCEL", 0) * ded["harsh_accel"],
        ded["harsh_accel_cap"]
    )
    idle_ded = ded["idle_30min"] if counts.get("EXCESSIVE_IDLE", 0) > 0 else 0
    night_ded = counts.get("NIGHT_DRIVING", 0) * ded["night_per_trip"]

    # Critical zone overspeed — check details JSON for zone info
    critical_count = 0
    for e in events:
        if e.event_type == DriverEventType.OVERSPEED:
            details = e.details or {}
            if details.get("zone_type") == "critical":
                critical_count += 1
    critical_ded = critical_count * ded["critical_zone"]  # no cap

    total_deduction = (
        overspeed_ded + harsh_brake_ded + harsh_accel_ded
        + idle_ded + night_ded + critical_ded
    )
    final_score = max(0, 100 - total_deduction)

    # Determine tier
    if final_score >= tiers["elite"]:
        tier = "elite"
    elif final_score >= tiers["good"]:
        tier = "good"
    elif final_score >= tiers["attention"]:
        tier = "needs_attention"
    else:
        tier = "high_risk"

    # Upsert daily score
    existing = await db.execute(
        select(DriverDailyScore).where(
            DriverDailyScore.driver_id == driver_id,
            DriverDailyScore.score_date == day_start,
        )
    )
    record = existing.scalar_one_or_none()
    if record:
        record.overspeed_deduction = overspeed_ded
        record.harsh_brake_deduction = harsh_brake_ded
        record.harsh_accel_deduction = harsh_accel_ded
        record.idle_deduction = idle_ded
        record.night_driving_deduction = night_ded
        record.critical_zone_deduction = critical_ded
        record.final_score = final_score
        record.tier = tier
        record.event_details = counts
    else:
        record = DriverDailyScore(
            driver_id=driver_id,
            score_date=day_start,
            overspeed_deduction=overspeed_ded,
            harsh_brake_deduction=harsh_brake_ded,
            harsh_accel_deduction=harsh_accel_ded,
            idle_deduction=idle_ded,
            night_driving_deduction=night_ded,
            critical_zone_deduction=critical_ded,
            final_score=final_score,
            tier=tier,
            event_details=counts,
        )
        db.add(record)

    await db.flush()

    # Alert if critical
    if tier == "high_risk":
        await event_bus.publish(
            EventTypes.DRIVER_SCORE_CRITICAL,
            entity_type="driver",
            entity_id=str(driver_id),
            payload={"score": final_score, "tier": tier, "date": str(score_date)},
            db_session=db,
        )

    return {
        "driver_id": driver_id,
        "date": str(score_date),
        "final_score": final_score,
        "tier": tier,
        "deductions": {
            "overspeed": overspeed_ded,
            "harsh_brake": harsh_brake_ded,
            "harsh_accel": harsh_accel_ded,
            "idle": idle_ded,
            "night": night_ded,
            "critical_zone": critical_ded,
        },
        "event_counts": counts,
    }


async def compute_monthly_score(
    db: AsyncSession,
    driver_id: int,
    year: int,
    month: int,
) -> dict:
    """Aggregate daily scores into monthly score."""

    month_start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        month_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        month_end = datetime(year, month + 1, 1, tzinfo=timezone.utc)

    result = await db.execute(
        select(func.avg(DriverDailyScore.final_score), func.count(DriverDailyScore.id))
        .where(
            DriverDailyScore.driver_id == driver_id,
            DriverDailyScore.score_date >= month_start,
            DriverDailyScore.score_date < month_end,
        )
    )
    row = result.one()
    avg_score = float(row[0]) if row[0] else 100.0
    total_days = row[1]

    # Count total events for the month
    event_result = await db.execute(
        select(func.count(DriverEvent.id)).where(
            DriverEvent.driver_id == driver_id,
            DriverEvent.created_at >= month_start,
            DriverEvent.created_at < month_end,
        )
    )
    total_events = event_result.scalar() or 0

    cfg = await get_config_bulk(db, "driver_score.")
    tiers = {
        "elite": cfg.get("driver_score.tier_elite_min", 90),
        "good": cfg.get("driver_score.tier_good_min", 75),
        "attention": cfg.get("driver_score.tier_attention_min", 60),
    }

    if avg_score >= tiers["elite"]:
        tier = "elite"
    elif avg_score >= tiers["good"]:
        tier = "good"
    elif avg_score >= tiers["attention"]:
        tier = "needs_attention"
    else:
        tier = "high_risk"

    # Upsert
    existing = await db.execute(
        select(DriverMonthlyScore).where(
            DriverMonthlyScore.driver_id == driver_id,
            DriverMonthlyScore.year == year,
            DriverMonthlyScore.month == month,
        )
    )
    record = existing.scalar_one_or_none()
    if record:
        record.avg_score = round(avg_score, 1)
        record.tier = tier
        record.total_events = total_events
    else:
        db.add(DriverMonthlyScore(
            driver_id=driver_id,
            year=year,
            month=month,
            avg_score=round(avg_score, 1),
            tier=tier,
            total_events=total_events,
        ))

    await db.flush()
    return {
        "driver_id": driver_id,
        "year": year,
        "month": month,
        "avg_score": round(avg_score, 1),
        "tier": tier,
        "total_events": total_events,
        "days_scored": total_days,
    }


async def get_driver_score_summary(
    db: AsyncSession,
    driver_id: int,
    days: int = 7,
) -> dict:
    """Get driver's recent score trend."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(DriverDailyScore)
        .where(
            DriverDailyScore.driver_id == driver_id,
            DriverDailyScore.score_date >= cutoff,
        )
        .order_by(DriverDailyScore.score_date.desc())
    )
    scores = result.scalars().all()

    trend = [
        {"date": str(s.score_date.date()), "score": s.final_score, "tier": s.tier}
        for s in scores
    ]
    avg = sum(s.final_score for s in scores) / len(scores) if scores else 100
    current_tier = scores[0].tier if scores else "good"

    return {
        "driver_id": driver_id,
        "current_score": scores[0].final_score if scores else 100,
        "current_tier": current_tier,
        "avg_7d": round(avg, 1),
        "trend": trend,
    }


async def get_leaderboard(db: AsyncSession, year: int, month: int, limit: int = 10) -> dict:
    """Get top and bottom drivers by monthly score."""
    result = await db.execute(
        select(DriverMonthlyScore)
        .where(DriverMonthlyScore.year == year, DriverMonthlyScore.month == month)
        .order_by(DriverMonthlyScore.avg_score.desc())
    )
    all_scores = result.scalars().all()

    top = [{"driver_id": s.driver_id, "score": s.avg_score, "tier": s.tier} for s in all_scores[:5]]
    bottom = [{"driver_id": s.driver_id, "score": s.avg_score, "tier": s.tier} for s in all_scores[-5:]]

    return {"top_5": top, "bottom_5": bottom, "total_drivers": len(all_scores)}
