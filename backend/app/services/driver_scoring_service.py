# Driver Behavior Scoring Service
# Transport ERP — Phase C: Driver Scoring Engine

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from calendar import monthrange
from sqlalchemy import select, func, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.postgres.driver_event import DriverEvent, DriverEventType
from app.models.postgres.driver import Driver

logger = logging.getLogger(__name__)

# ── Scoring Rules ──────────────────────────────────────────────────
# Penalties (subtracted from base 100)
PENALTY_RULES: Dict[DriverEventType, float] = {
    DriverEventType.HARSH_BRAKE: 5.0,
    DriverEventType.HARSH_ACCEL: 3.0,
    DriverEventType.OVERSPEED: 8.0,
    DriverEventType.NIGHT_DRIVING: 2.0,
    DriverEventType.EXCESSIVE_IDLE: 1.0,
    DriverEventType.GEOFENCE_BREACH: 6.0,
    DriverEventType.UNAUTHORIZED_HALT: 4.0,
    DriverEventType.SOS: 10.0,
}

# Severity multipliers (severity 1-5)
SEVERITY_MULTIPLIER = {1: 0.5, 2: 0.75, 3: 1.0, 4: 1.5, 5: 2.0}

# Score tiers
SCORE_TIERS = [
    (90, 100, "EXCELLENT"),
    (75, 89, "GOOD"),
    (60, 74, "AVERAGE"),
    (40, 59, "POOR"),
    (0, 39, "UNSAFE"),
]

BASE_SCORE = 100.0


def get_tier(score: float) -> str:
    for low, high, label in SCORE_TIERS:
        if low <= score <= high:
            return label
    return "UNSAFE"


async def compute_monthly_score(
    db: AsyncSession,
    driver_id: int,
    month: int,
    year: int,
) -> Dict[str, Any]:
    """Compute the driver's behavior score for a given month (0-100)."""
    start_date = datetime(year, month, 1)
    _, last_day = monthrange(year, month)
    end_date = datetime(year, month, last_day, 23, 59, 59)

    result = await db.execute(
        select(
            DriverEvent.event_type,
            DriverEvent.severity,
            func.count(DriverEvent.id).label("cnt"),
        )
        .where(
            and_(
                DriverEvent.driver_id == driver_id,
                DriverEvent.created_at >= start_date,
                DriverEvent.created_at <= end_date,
            )
        )
        .group_by(DriverEvent.event_type, DriverEvent.severity)
    )
    rows = result.all()

    total_penalty = 0.0
    event_counts: Dict[str, int] = {}

    for event_type, severity, count in rows:
        base_penalty = PENALTY_RULES.get(event_type, 3.0)
        multiplier = SEVERITY_MULTIPLIER.get(severity, 1.0)
        penalty = base_penalty * multiplier * count
        total_penalty += penalty

        et_key = event_type.value
        event_counts[et_key] = event_counts.get(et_key, 0) + count

    score = max(0.0, min(BASE_SCORE, BASE_SCORE - total_penalty))
    score = round(score, 1)
    tier = get_tier(score)

    return {
        "driver_id": driver_id,
        "month": month,
        "year": year,
        "score": score,
        "tier": tier,
        "total_penalty": round(total_penalty, 1),
        "total_events": sum(event_counts.values()),
        "event_counts": event_counts,
    }


async def get_score_breakdown(
    db: AsyncSession,
    driver_id: int,
    month: int,
    year: int,
) -> Dict[str, Any]:
    """Get category-level score breakdown for a driver in a given month."""
    start_date = datetime(year, month, 1)
    _, last_day = monthrange(year, month)
    end_date = datetime(year, month, last_day, 23, 59, 59)

    result = await db.execute(
        select(
            DriverEvent.event_type,
            DriverEvent.severity,
            func.count(DriverEvent.id).label("cnt"),
        )
        .where(
            and_(
                DriverEvent.driver_id == driver_id,
                DriverEvent.created_at >= start_date,
                DriverEvent.created_at <= end_date,
            )
        )
        .group_by(DriverEvent.event_type, DriverEvent.severity)
    )
    rows = result.all()

    categories: Dict[str, Dict] = {}
    total_penalty = 0.0

    for event_type, severity, count in rows:
        et_key = event_type.value
        base_penalty = PENALTY_RULES.get(event_type, 3.0)
        multiplier = SEVERITY_MULTIPLIER.get(severity, 1.0)
        penalty = base_penalty * multiplier * count
        total_penalty += penalty

        if et_key not in categories:
            categories[et_key] = {"event_type": et_key, "count": 0, "penalty": 0.0, "base_rate": base_penalty}
        categories[et_key]["count"] += count
        categories[et_key]["penalty"] += penalty

    # Round penalties
    for cat in categories.values():
        cat["penalty"] = round(cat["penalty"], 1)

    score = max(0.0, min(BASE_SCORE, BASE_SCORE - total_penalty))

    return {
        "driver_id": driver_id,
        "month": month,
        "year": year,
        "score": round(score, 1),
        "tier": get_tier(score),
        "categories": list(categories.values()),
    }


async def get_leaderboard(
    db: AsyncSession,
    month: int,
    year: int,
    branch_id: Optional[int] = None,
    tenant_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """Get ranked leaderboard of all drivers for a given month."""
    # Get all active drivers
    driver_filters = [Driver.is_deleted == False]
    if branch_id:
        driver_filters.append(Driver.branch_id == branch_id)
    if tenant_id:
        driver_filters.append(Driver.tenant_id == tenant_id)

    driver_result = await db.execute(
        select(Driver.id, Driver.first_name, Driver.last_name, Driver.employee_code, Driver.phone)
        .where(and_(*driver_filters))
        .order_by(Driver.id)
    )
    drivers = driver_result.all()

    start_date = datetime(year, month, 1)
    _, last_day = monthrange(year, month)
    end_date = datetime(year, month, last_day, 23, 59, 59)

    # Get event counts per driver
    event_result = await db.execute(
        select(
            DriverEvent.driver_id,
            DriverEvent.event_type,
            DriverEvent.severity,
            func.count(DriverEvent.id).label("cnt"),
        )
        .where(
            and_(
                DriverEvent.created_at >= start_date,
                DriverEvent.created_at <= end_date,
            )
        )
        .group_by(DriverEvent.driver_id, DriverEvent.event_type, DriverEvent.severity)
    )
    event_rows = event_result.all()

    # Build penalty map per driver
    driver_penalties: Dict[int, float] = {}
    driver_event_totals: Dict[int, int] = {}
    for driver_id, event_type, severity, count in event_rows:
        base_penalty = PENALTY_RULES.get(event_type, 3.0)
        multiplier = SEVERITY_MULTIPLIER.get(severity, 1.0)
        penalty = base_penalty * multiplier * count
        driver_penalties[driver_id] = driver_penalties.get(driver_id, 0.0) + penalty
        driver_event_totals[driver_id] = driver_event_totals.get(driver_id, 0) + count

    # Build leaderboard
    entries = []
    for did, first_name, last_name, emp_code, phone in drivers:
        penalty = driver_penalties.get(did, 0.0)
        score = max(0.0, min(BASE_SCORE, BASE_SCORE - penalty))
        score = round(score, 1)
        name = f"{first_name or ''} {last_name or ''}".strip() or "Unknown"
        entries.append({
            "driver_id": did,
            "driver_name": name,
            "employee_code": emp_code,
            "phone": phone,
            "score": score,
            "tier": get_tier(score),
            "total_events": driver_event_totals.get(did, 0),
            "total_penalty": round(penalty, 1),
        })

    # Sort by score descending
    entries.sort(key=lambda x: (-x["score"], x["driver_name"]))

    # Add rank
    for i, entry in enumerate(entries):
        entry["rank"] = i + 1

    total = len(entries)
    return {
        "month": month,
        "year": year,
        "total_drivers": total,
        "entries": entries[skip : skip + limit],
    }


async def get_score_trend(
    db: AsyncSession,
    driver_id: int,
    months: int = 12,
) -> List[Dict[str, Any]]:
    """Get score trend for the last N months."""
    today = date.today()
    trend = []

    for i in range(months - 1, -1, -1):
        # Calculate month offset
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1

        score_data = await compute_monthly_score(db, driver_id, m, y)
        trend.append({
            "month": m,
            "year": y,
            "label": date(y, m, 1).strftime("%b %Y"),
            "score": score_data["score"],
            "tier": score_data["tier"],
            "total_events": score_data["total_events"],
        })

    return {"driver_id": driver_id, "trend": trend}


async def add_coaching_note(
    db: AsyncSession,
    driver_id: int,
    coach_id: int,
    note_text: str,
    category: Optional[str] = None,
    tenant_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Add a coaching note for a driver. Stored in audit_notes with resource_type='driver_coaching'."""
    from app.models.postgres.audit_note import AuditNote

    note = AuditNote(
        resource_type="driver_coaching",
        resource_id=driver_id,
        note_text=note_text,
        auditor_id=coach_id,
        tenant_id=tenant_id,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return {
        "id": note.id,
        "driver_id": driver_id,
        "coach_id": coach_id,
        "note_text": note.note_text,
        "category": category,
        "created_at": note.created_at.isoformat() if note.created_at else None,
        "status": note.status.value if hasattr(note.status, "value") else str(note.status),
    }


async def get_coaching_notes(
    db: AsyncSession,
    driver_id: int,
    skip: int = 0,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """Get coaching notes for a driver."""
    from app.models.postgres.audit_note import AuditNote

    result = await db.execute(
        select(AuditNote)
        .where(
            and_(
                AuditNote.resource_type == "driver_coaching",
                AuditNote.resource_id == driver_id,
            )
        )
        .order_by(AuditNote.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    notes = result.scalars().all()
    return [
        {
            "id": n.id,
            "driver_id": driver_id,
            "coach_id": n.auditor_id,
            "note_text": n.note_text,
            "status": n.status.value if hasattr(n.status, "value") else str(n.status),
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notes
    ]


async def get_fleet_score_distribution(
    db: AsyncSession,
    month: int,
    year: int,
    tenant_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Get score distribution across all drivers for fleet dashboard widget."""
    leaderboard = await get_leaderboard(db, month, year, tenant_id=tenant_id, limit=10000)
    entries = leaderboard["entries"]

    distribution = {"EXCELLENT": 0, "GOOD": 0, "AVERAGE": 0, "POOR": 0, "UNSAFE": 0}
    for entry in entries:
        distribution[entry["tier"]] = distribution.get(entry["tier"], 0) + 1

    # Top 5 and Bottom 5
    top5 = entries[:5] if len(entries) >= 5 else entries
    bottom5 = entries[-5:] if len(entries) >= 5 else entries

    return {
        "month": month,
        "year": year,
        "total_drivers": leaderboard["total_drivers"],
        "distribution": distribution,
        "average_score": round(sum(e["score"] for e in entries) / len(entries), 1) if entries else 0,
        "top5": top5,
        "bottom5": bottom5,
    }
