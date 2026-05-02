# I-05 — Expense Fraud Detection
# 4-layer validation: location, amount anomaly, duplicate, date mismatch.

import hashlib
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.postgres.trip import Trip, TripExpense
from app.models.postgres.intelligence import ExpenseFraudFlag, ExpenseCategoryStats
from app.services.config_service import get_config_bulk
from app.services.event_bus import event_bus, EventTypes

logger = logging.getLogger(__name__)


async def validate_expense(
    db: AsyncSession,
    expense_id: int,
) -> list[dict]:
    """Run all 4 fraud checks on a single expense. Returns list of flags raised."""

    cfg = await get_config_bulk(db, "expense.")
    location_max_km = cfg.get("expense.location_mismatch_km", 50)
    zscore_threshold = cfg.get("expense.zscore_threshold", 2.5)
    duplicate_window_days = cfg.get("expense.duplicate_window_days", 60)

    expense = await db.get(TripExpense, expense_id)
    if not expense:
        return []

    trip = await db.get(Trip, expense.trip_id) if expense.trip_id else None
    flags = []

    # Layer 1 — Location mismatch
    loc_flag = await _check_location_mismatch(db, expense, trip, location_max_km)
    if loc_flag:
        flags.append(loc_flag)

    # Layer 2 — Amount anomaly (z-score)
    amt_flag = await _check_amount_anomaly(db, expense, zscore_threshold)
    if amt_flag:
        flags.append(amt_flag)

    # Layer 3 — Duplicate detection
    dup_flag = await _check_duplicate(db, expense, duplicate_window_days)
    if dup_flag:
        flags.append(dup_flag)

    # Layer 4 — Date mismatch
    date_flag = _check_date_mismatch(expense, trip)
    if date_flag:
        flags.append(date_flag)

    # Persist flags
    for f in flags:
        fraud_flag = ExpenseFraudFlag(
            expense_id=expense_id,
            trip_id=expense.trip_id,
            driver_id=trip.driver_id if trip else None,
            flag_type=f["type"],
            severity=f["severity"],
            description=f["description"],
            details=f.get("details"),
        )
        db.add(fraud_flag)

    if flags:
        await db.flush()
        await event_bus.publish(
            EventTypes.EXPENSE_FRAUD_FLAGGED,
            entity_type="expense",
            entity_id=str(expense_id),
            payload={
                "expense_id": expense_id,
                "trip_id": expense.trip_id,
                "flags": [f["type"] for f in flags],
                "max_severity": max(f["severity"] for f in flags),
            },
            db_session=db,
        )

    return flags


async def _check_location_mismatch(db, expense, trip, max_km):
    """Check if expense location is >max_km from trip route."""
    if not expense.latitude or not expense.longitude:
        return None
    if not trip:
        return None

    # Simple check: compare with trip start/end coordinates
    trip_lat, trip_lng = None, None
    if trip.start_latitude and trip.start_longitude:
        trip_lat = float(trip.start_latitude)
        trip_lng = float(trip.start_longitude)
    elif trip.end_latitude and trip.end_longitude:
        trip_lat = float(trip.end_latitude)
        trip_lng = float(trip.end_longitude)

    if trip_lat is None:
        return None

    distance_km = _haversine(
        float(expense.latitude), float(expense.longitude),
        trip_lat, trip_lng,
    )

    if distance_km > max_km:
        return {
            "type": "LOCATION_MISMATCH",
            "severity": "high",
            "description": (
                f"Expense location is {round(distance_km, 1)}km "
                f"from trip route (threshold: {max_km}km)"
            ),
            "details": {
                "expense_lat": float(expense.latitude),
                "expense_lng": float(expense.longitude),
                "trip_lat": trip_lat,
                "trip_lng": trip_lng,
                "distance_km": round(distance_km, 1),
            },
        }
    return None


async def _check_amount_anomaly(db, expense, threshold):
    """Z-score anomaly: flag if expense amount >> category average."""
    category = str(expense.category.value) if expense.category else "MISC"
    amount_paise = int(float(expense.amount) * 100) if expense.amount else 0

    stats = await db.execute(
        select(ExpenseCategoryStats).where(
            ExpenseCategoryStats.category == category
        )
    )
    cat_stats = stats.scalar_one_or_none()

    if not cat_stats or cat_stats.sample_count < 10 or cat_stats.stddev_amount_paise == 0:
        return None

    z_score = (amount_paise - cat_stats.mean_amount_paise) / cat_stats.stddev_amount_paise

    if z_score > threshold:
        return {
            "type": "UNUSUALLY_HIGH",
            "severity": "warning" if z_score < 4 else "critical",
            "description": (
                f"Amount ₹{float(expense.amount):,.2f} is {round(z_score, 1)}σ "
                f"above category '{category}' mean ₹{cat_stats.mean_amount_paise / 100:,.2f}"
            ),
            "details": {
                "z_score": round(z_score, 2),
                "amount_paise": amount_paise,
                "mean_paise": cat_stats.mean_amount_paise,
                "stddev_paise": cat_stats.stddev_amount_paise,
            },
        }
    return None


async def _check_duplicate(db, expense, window_days):
    """Hash match: same amount+category+driver within window."""
    if not expense.trip_id:
        return None

    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)

    # Build hash: amount + category + rough location
    expense_hash = _expense_hash(expense)

    # Find other expenses with same hash in window
    results = await db.execute(
        select(TripExpense).where(
            TripExpense.id != expense.id,
            TripExpense.category == expense.category,
            TripExpense.amount == expense.amount,
            TripExpense.created_at >= cutoff,
        ).limit(5)
    )
    candidates = results.scalars().all()

    for c in candidates:
        if _expense_hash(c) == expense_hash:
            return {
                "type": "POSSIBLE_DUPLICATE",
                "severity": "warning",
                "description": (
                    f"Possible duplicate of expense #{c.id} — "
                    f"same amount ₹{float(expense.amount):,.2f}, "
                    f"category {expense.category.value if expense.category else 'N/A'}"
                ),
                "details": {
                    "duplicate_expense_id": c.id,
                    "matching_fields": ["amount", "category"],
                },
            }
    return None


def _check_date_mismatch(expense, trip):
    """Receipt date outside trip date range."""
    if not trip or not expense.expense_date:
        return None

    start = trip.actual_start_time or trip.planned_start_time
    end = trip.actual_end_time or trip.planned_end_time

    if not start:
        return None

    exp_date = expense.expense_date
    # Allow 1-day buffer
    buffer = timedelta(days=1)
    if start - buffer <= exp_date:
        if end is None or exp_date <= end + buffer:
            return None

    return {
        "type": "DATE_MISMATCH",
        "severity": "high",
        "description": (
            f"Expense date {exp_date.strftime('%Y-%m-%d')} is outside "
            f"trip dates ({start.strftime('%Y-%m-%d')} to "
            f"{end.strftime('%Y-%m-%d') if end else 'ongoing'})"
        ),
        "details": {
            "expense_date": exp_date.isoformat(),
            "trip_start": start.isoformat() if start else None,
            "trip_end": end.isoformat() if end else None,
        },
    }


async def recompute_category_stats(db: AsyncSession):
    """Recompute rolling mean/stddev for each expense category (daily job)."""
    categories = await db.execute(
        select(TripExpense.category).distinct()
    )
    for (cat,) in categories:
        if cat is None:
            continue
        cat_val = cat.value if hasattr(cat, "value") else str(cat)

        result = await db.execute(
            select(
                func.avg(TripExpense.amount),
                func.stddev(TripExpense.amount),
                func.count(TripExpense.id),
            ).where(TripExpense.category == cat)
        )
        row = result.one()
        mean_val = float(row[0]) if row[0] else 0
        stddev_val = float(row[1]) if row[1] else 0
        count_val = row[2]

        # Upsert
        existing = await db.execute(
            select(ExpenseCategoryStats).where(
                ExpenseCategoryStats.category == cat_val
            )
        )
        stats = existing.scalar_one_or_none()
        if stats:
            stats.mean_amount_paise = int(mean_val * 100)
            stats.stddev_amount_paise = int(stddev_val * 100)
            stats.sample_count = count_val
            stats.last_computed = datetime.now(timezone.utc)
        else:
            db.add(ExpenseCategoryStats(
                category=cat_val,
                mean_amount_paise=int(mean_val * 100),
                stddev_amount_paise=int(stddev_val * 100),
                sample_count=count_val,
                last_computed=datetime.now(timezone.utc),
            ))

    await db.flush()


def _expense_hash(expense) -> str:
    raw = f"{expense.amount}|{expense.category}|{expense.expense_date}"
    if expense.receipt_number:
        raw += f"|{expense.receipt_number}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _haversine(lat1, lon1, lat2, lon2) -> float:
    """Haversine distance in km."""
    import math
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
