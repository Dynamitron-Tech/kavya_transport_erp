# Intelligence API endpoints — /intelligence/*
# Covers: driver scores, vehicle risk, trip alerts, fuel checks,
#          expense fraud, system config, audit logs, daily insights.

from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse
from app.services.cache_service import cache_get, cache_set

router = APIRouter()


# ────────────────────── Driver Scores ──────────────────────

@router.get(
    "/driver-scores/{driver_id}",
    response_model=APIResponse,
    summary="Get driver score summary",
    description="Returns last 7 days trend, current tier, and score breakdown.",
)
async def get_driver_score(
    driver_id: int = Path(..., description="Driver ID"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.DRIVER_SCORE_READ)),
):
    from app.services.driver_behaviour_service import get_driver_score_summary
    data = await get_driver_score_summary(db, driver_id)
    return APIResponse(success=True, data=data)


@router.get(
    "/driver-leaderboard",
    response_model=APIResponse,
    summary="Get driver leaderboard",
    description="Top 5 and bottom 5 drivers by monthly score.",
)
async def get_leaderboard(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.DRIVER_SCORE_READ)),
):
    cached = await cache_get("intel:leaderboard")
    if cached:
        return APIResponse(success=True, data=cached)
    from app.services.driver_behaviour_service import get_leaderboard
    data = await get_leaderboard(db)
    await cache_set("intel:leaderboard", data, ttl=120)
    return APIResponse(success=True, data=data)


# ────────────────────── Vehicle Risk ──────────────────────

@router.get(
    "/vehicle-risk/{vehicle_id}",
    response_model=APIResponse,
    summary="Get vehicle risk score",
    description="Returns the latest risk score with component breakdown.",
)
async def get_vehicle_risk(
    vehicle_id: int = Path(..., description="Vehicle ID"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INTELLIGENCE_VIEW)),
):
    from app.services.predictive_maintenance_service import compute_vehicle_risk_score
    data = await compute_vehicle_risk_score(db, vehicle_id)
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])
    return APIResponse(success=True, data=data)


@router.get(
    "/fleet-maintenance",
    response_model=APIResponse,
    summary="Fleet maintenance summary",
    description="Healthy/monitor/high-risk counts and high-risk vehicle list.",
)
async def fleet_maintenance_summary(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INTELLIGENCE_VIEW)),
):
    cached = await cache_get("intel:fleet_maintenance")
    if cached:
        return APIResponse(success=True, data=cached)
    from app.services.predictive_maintenance_service import get_fleet_maintenance_summary
    data = await get_fleet_maintenance_summary(db)
    await cache_set("intel:fleet_maintenance", data, ttl=120)
    return APIResponse(success=True, data=data)


# ────────────────────── Trip Intelligence ──────────────────────

@router.get(
    "/trip-alerts/{trip_id}",
    response_model=APIResponse,
    summary="Get trip intelligence alerts",
    description="All anomaly detections for a trip (deviation, stops, delays, night halts).",
)
async def get_trip_alerts(
    trip_id: int = Path(..., description="Trip ID"),
    unacknowledged_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INTELLIGENCE_VIEW)),
):
    from app.services.trip_intelligence_service import get_trip_alerts
    data = await get_trip_alerts(db, trip_id, unacknowledged_only)
    return APIResponse(success=True, data=data)


@router.post(
    "/trip-alerts/{alert_id}/acknowledge",
    response_model=APIResponse,
    summary="Acknowledge a trip alert",
    description="Mark a trip intelligence alert as acknowledged with optional resolution.",
)
async def acknowledge_trip_alert(
    alert_id: int = Path(..., description="Alert ID"),
    resolution: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INTELLIGENCE_VIEW)),
):
    from app.services.trip_intelligence_service import acknowledge_alert
    result = await acknowledge_alert(db, alert_id, current_user.user_id, resolution)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return APIResponse(success=True, data=result)


# ────────────────────── ETA ──────────────────────

@router.get(
    "/eta/{trip_id}",
    response_model=APIResponse,
    summary="Predict ETA for a trip",
    description="Returns predicted arrival time using historical corridor data or baseline buffer.",
)
async def predict_eta(
    trip_id: int = Path(..., description="Trip ID"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.GPS_DATA_READ)),
):
    from app.services.eta_prediction_service import predict_eta
    data = await predict_eta(db, trip_id)
    return APIResponse(success=True, data=data)


# ────────────────────── Route Optimization ──────────────────────

@router.get(
    "/route/{trip_id}",
    response_model=APIResponse,
    summary="Get optimal route for trip",
    description="Returns scored route candidates with fuel cost estimates.",
)
async def get_optimal_route(
    trip_id: int = Path(..., description="Trip ID"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.GPS_DATA_READ)),
):
    from app.services.route_optimization_service import compute_optimal_route
    data = await compute_optimal_route(db, trip_id)
    return APIResponse(success=True, data=data)


# ────────────────────── Fuel Theft ──────────────────────

@router.post(
    "/fuel-check/{fuel_issue_id}",
    response_model=APIResponse,
    summary="Check fuel fill for theft/anomaly",
    description="Validates dispensed quantity against expected consumption.",
)
async def check_fuel_mismatch(
    fuel_issue_id: int = Path(..., description="Fuel Issue ID"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INTELLIGENCE_VIEW)),
):
    from app.services.fuel_theft_detection_service import check_fuel_mismatch
    data = await check_fuel_mismatch(db, fuel_issue_id)
    return APIResponse(success=True, data=data)


# ────────────────────── Expense Fraud ──────────────────────

@router.post(
    "/expense-validate/{expense_id}",
    response_model=APIResponse,
    summary="Validate expense for fraud",
    description="Runs 4-layer fraud detection: location, amount, duplicate, date.",
)
async def validate_expense(
    expense_id: int = Path(..., description="Trip Expense ID"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INTELLIGENCE_VIEW)),
):
    from app.services.expense_fraud_service import validate_expense
    data = await validate_expense(db, expense_id)
    return APIResponse(success=True, data=data)


# ────────────────────── Daily Insights ──────────────────────

@router.get(
    "/insights",
    response_model=APIResponse,
    summary="Get latest daily intelligence insights",
    description="Returns pre-computed intelligence results from the daily batch job.",
)
async def get_insights(
    limit: int = Query(7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INTELLIGENCE_VIEW)),
):
    cache_key = f"intel:insights:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return APIResponse(success=True, data=cached)

    from sqlalchemy import select
    from app.models.postgres.intelligence import DailyInsight

    result = await db.execute(
        select(DailyInsight)
        .order_by(DailyInsight.insight_date.desc())
        .limit(limit)
    )
    insights = result.scalars().all()
    data = [
        {
            "id": i.id,
            "type": i.insight_type,
            "data": i.data,
            "insight_date": i.insight_date.isoformat() if i.insight_date else None,
            "is_latest": i.is_latest,
        }
        for i in insights
    ]
    await cache_set(cache_key, data, ttl=300)
    return APIResponse(success=True, data=data)


# ────────────────────── System Config (Admin) ──────────────────────

@router.get(
    "/config",
    response_model=APIResponse,
    summary="Get all system configuration",
    description="Returns all configurable thresholds grouped by category.",
)
async def get_all_config(
    prefix: Optional[str] = Query(None, description="Filter by prefix, e.g. 'fuel.'"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.SYSTEM_CONFIG_READ)),
):
    from sqlalchemy import select
    from app.models.postgres.intelligence import SystemConfig

    query = select(SystemConfig).order_by(SystemConfig.category, SystemConfig.key)
    if prefix:
        query = query.where(SystemConfig.key.startswith(prefix))
    result = await db.execute(query)
    configs = result.scalars().all()
    return APIResponse(success=True, data=[
        {
            "key": c.key,
            "value": c.value,
            "value_type": c.value_type,
            "category": c.category,
            "description": c.description,
        }
        for c in configs
    ])


@router.put(
    "/config/{key:path}",
    response_model=APIResponse,
    summary="Update a system configuration value",
    description="Updates a single configurable threshold. Admin only.",
)
async def update_config(
    key: str = Path(..., description="Config key, e.g. 'fuel.theft_variance_litres'"),
    value: str = Query(..., description="New value"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.SYSTEM_CONFIG_UPDATE)),
):
    from sqlalchemy import select
    from app.models.postgres.intelligence import SystemConfig
    from app.services.audit_logger import log_audit

    result = await db.execute(
        select(SystemConfig).where(SystemConfig.key == key)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail=f"Config key '{key}' not found")

    old_value = config.value
    config.value = value

    await log_audit(
        db,
        actor_id=current_user.user_id,
        actor_role=current_user.roles[0] if current_user.roles else "unknown",
        action="config_update",
        entity_type="system_config",
        entity_id=key,
        previous_state={"value": old_value},
        new_state={"value": value},
    )

    return APIResponse(success=True, data={"key": key, "old_value": old_value, "new_value": value})


# ────────────────────── Audit Logs (Read-Only) ──────────────────────

@router.get(
    "/audit-logs",
    response_model=APIResponse,
    summary="Query audit logs",
    description="Read-only access to immutable audit trail. No update/delete.",
)
async def get_audit_logs(
    actor_id: Optional[int] = Query(None),
    entity_type: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.AUDIT_LOG_READ)),
):
    from sqlalchemy import select, func
    from app.models.postgres.intelligence import AuditLog

    query = select(AuditLog).order_by(AuditLog.created_at.desc())
    count_query = select(func.count(AuditLog.id))

    if actor_id:
        query = query.where(AuditLog.actor_id == actor_id)
        count_query = count_query.where(AuditLog.actor_id == actor_id)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
        count_query = count_query.where(AuditLog.entity_type == entity_type)
    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return APIResponse(
        success=True,
        data=[
            {
                "id": log.id,
                "actor_id": log.actor_id,
                "actor_role": log.actor_role,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "previous_state": log.previous_state,
                "new_state": log.new_state,
                "timestamp": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
        pagination={"page": page, "limit": limit, "total": total},
    )


# ────────────────────── Event Bus (Priority-Aware) ──────────────────────

@router.get(
    "/events",
    response_model=APIResponse,
    summary="List recent events (role-filtered, suppression-aware)",
    description="Returns active events filtered by the caller's role visibility rules.",
)
async def list_events(
    event_type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None, description="Filter by priority: P0, P1, P2, P3"),
    include_suppressed: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EVENT_BUS_READ)),
):
    from sqlalchemy import select, and_
    from app.models.postgres.intelligence import EventBusEvent
    from app.services.event_pipeline import ROLE_PRIORITY_MAP

    # Determine visible priorities for this role
    role = current_user.roles[0] if current_user.roles else "driver"
    visible = ROLE_PRIORITY_MAP.get(role, ["P0", "P1", "P2"])

    query = select(EventBusEvent).order_by(EventBusEvent.triggered_at.desc()).limit(limit)
    query = query.where(EventBusEvent.priority.in_(visible))

    if not include_suppressed:
        query = query.where(EventBusEvent.suppressed_at.is_(None))
    if event_type:
        query = query.where(EventBusEvent.event_type == event_type)
    if priority and priority in visible:
        query = query.where(EventBusEvent.priority == priority)

    # Driver scoping: only their own entity events
    if role == "driver":
        query = query.where(EventBusEvent.entity_id == str(current_user.user_id))

    result = await db.execute(query)
    events = result.scalars().all()
    data = [_serialize_event(e) for e in events]
    return APIResponse(success=True, data=data)


@router.get(
    "/events/grouped",
    response_model=APIResponse,
    summary="Grouped event feed",
    description="Returns events grouped by entity+type within 30-min windows. Server-side grouping.",
)
async def list_events_grouped(
    priority: Optional[str] = Query(None),
    status: str = Query("active", description="active or all"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EVENT_BUS_READ)),
):
    from sqlalchemy import select, func
    from app.models.postgres.intelligence import EventBusEvent
    from app.services.event_pipeline import ROLE_PRIORITY_MAP

    role = current_user.roles[0] if current_user.roles else "driver"
    visible = ROLE_PRIORITY_MAP.get(role, ["P0", "P1", "P2"])

    query = select(EventBusEvent).where(
        EventBusEvent.priority.in_(visible)
    ).order_by(EventBusEvent.triggered_at.desc()).limit(limit * 2)

    if status == "active":
        query = query.where(EventBusEvent.suppressed_at.is_(None))
    if priority and priority in visible:
        query = query.where(EventBusEvent.priority == priority)
    if role == "driver":
        query = query.where(EventBusEvent.entity_id == str(current_user.user_id))

    result = await db.execute(query)
    events = result.scalars().all()

    # Group by (entity_id, event_type) within 30-min windows
    groups: dict[str, dict] = {}
    for e in events:
        group_key = f"{e.entity_id or ''}:{e.event_type}"
        if group_key in groups:
            existing = groups[group_key]
            # Check if within 30-min window of existing group
            last_seen = existing.get("_last_triggered")
            if last_seen and e.triggered_at and abs((last_seen - e.triggered_at).total_seconds()) <= 1800:
                existing["total_occurrences"] += e.occurrence_count or 1
                if e.triggered_at and (not existing.get("last_seen_at") or e.triggered_at > existing["_last_triggered"]):
                    existing["last_seen_at"] = e.triggered_at.isoformat()
                    existing["latest_payload"] = e.payload
                    existing["_last_triggered"] = e.triggered_at
                continue
        # New group
        groups[group_key] = {
            "group_key": group_key,
            "event_type": e.event_type,
            "entity_id": e.entity_id,
            "entity_type": e.entity_type,
            "priority": e.priority,
            "total_occurrences": e.occurrence_count or 1,
            "first_seen_at": e.triggered_at.isoformat() if e.triggered_at else None,
            "last_seen_at": (e.last_seen_at or e.triggered_at).isoformat() if (e.last_seen_at or e.triggered_at) else None,
            "is_acknowledged": e.is_acknowledged,
            "escalation_level": e.escalation_level,
            "representative_event_id": e.id,
            "latest_payload": e.payload,
            "_last_triggered": e.triggered_at,
        }

    # Remove internal fields and limit
    grouped_list = []
    for g in list(groups.values())[:limit]:
        g.pop("_last_triggered", None)
        grouped_list.append(g)

    return APIResponse(success=True, data=grouped_list)


@router.get(
    "/events/history",
    response_model=APIResponse,
    summary="Event history (includes suppressed)",
    description="Full event history for an entity, including suppressed events.",
)
async def event_history(
    entity_id: str = Query(..., description="Entity ID to query"),
    include_suppressed: bool = Query(True),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EVENT_BUS_READ)),
):
    from sqlalchemy import select
    from app.models.postgres.intelligence import EventBusEvent

    query = select(EventBusEvent).where(
        EventBusEvent.entity_id == entity_id
    ).order_by(EventBusEvent.triggered_at.desc()).limit(limit)

    if not include_suppressed:
        query = query.where(EventBusEvent.suppressed_at.is_(None))

    result = await db.execute(query)
    events = result.scalars().all()
    return APIResponse(success=True, data=[_serialize_event(e) for e in events])


@router.post(
    "/events/{event_id}/acknowledge",
    response_model=APIResponse,
    summary="Acknowledge an event",
    description="Mark an event as acknowledged. P0 requires a note (min 5 chars).",
)
async def acknowledge_event(
    event_id: int = Path(..., description="Event ID"),
    note: Optional[str] = Query(None, description="Acknowledgement note (required for P0)"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EVENT_BUS_ACK)),
):
    from app.models.postgres.intelligence import EventBusEvent
    from app.services.cache_service import cache_delete_pattern
    from app.services.audit_logger import log_audit

    event = await db.get(EventBusEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # P0 requires note with min 5 chars
    if event.priority == "P0" and (not note or len(note.strip()) < 5):
        raise HTTPException(status_code=400, detail="P0 events require an acknowledgement note (min 5 characters)")

    now = datetime.now(timezone.utc)
    event.is_acknowledged = True
    event.acknowledged_by = current_user.user_id
    event.acknowledged_at = now
    event.acknowledgement_note = note

    # Audit log
    role = current_user.roles[0] if current_user.roles else "unknown"
    audit_payload = {"note": note, "priority": event.priority}
    if event.priority == "P0" and role != "admin":
        audit_payload["non_admin_p0_ack"] = True

    await log_audit(
        db,
        actor_id=current_user.user_id,
        actor_role=role,
        action="event.acknowledged",
        entity_type="event",
        entity_id=str(event_id),
        new_state=audit_payload,
    )

    await cache_delete_pattern("intel:events:*")
    return APIResponse(success=True, data={
        "id": event_id,
        "is_acknowledged": True,
        "acknowledged_by": current_user.user_id,
        "acknowledged_at": now.isoformat(),
        "acknowledgement_note": note,
    })


@router.post(
    "/events/acknowledge-bulk",
    response_model=APIResponse,
    summary="Bulk acknowledge events",
    description="Acknowledge multiple events at once. For grouped events, pass all event IDs in the group.",
)
async def acknowledge_events_bulk(
    event_ids: list[int] = Query(..., description="List of event IDs"),
    note: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EVENT_BUS_ACK)),
):
    from sqlalchemy import select, and_
    from app.models.postgres.intelligence import EventBusEvent
    from app.services.cache_service import cache_delete_pattern
    from app.services.audit_logger import log_audit

    now = datetime.now(timezone.utc)
    role = current_user.roles[0] if current_user.roles else "unknown"

    result = await db.execute(
        select(EventBusEvent).where(EventBusEvent.id.in_(event_ids))
    )
    events = result.scalars().all()

    # Check P0 note requirement
    has_p0 = any(e.priority == "P0" for e in events)
    if has_p0 and (not note or len(note.strip()) < 5):
        raise HTTPException(status_code=400, detail="Bulk includes P0 events — note required (min 5 chars)")

    acked_ids = []
    for event in events:
        event.is_acknowledged = True
        event.acknowledged_by = current_user.user_id
        event.acknowledged_at = now
        event.acknowledgement_note = note
        acked_ids.append(event.id)

    await log_audit(
        db,
        actor_id=current_user.user_id,
        actor_role=role,
        action="event.acknowledged_bulk",
        entity_type="event",
        entity_id=",".join(str(i) for i in acked_ids),
        new_state={"note": note, "count": len(acked_ids)},
    )

    await cache_delete_pattern("intel:events:*")
    return APIResponse(success=True, data={
        "acknowledged_count": len(acked_ids),
        "event_ids": acked_ids,
    })


@router.get(
    "/events/priority-config",
    response_model=APIResponse,
    summary="Get all event priority configs",
    description="Admin-editable priority mappings for all event types.",
)
async def get_priority_config(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.SYSTEM_CONFIG_READ)),
):
    from sqlalchemy import select
    from app.models.postgres.intelligence import EventPriorityConfig

    result = await db.execute(
        select(EventPriorityConfig).order_by(EventPriorityConfig.priority, EventPriorityConfig.event_type)
    )
    configs = result.scalars().all()
    return APIResponse(success=True, data=[
        {
            "id": c.id,
            "event_type": c.event_type,
            "priority": c.priority,
            "cooldown_minutes": c.cooldown_minutes,
            "description": c.description,
        }
        for c in configs
    ])


@router.put(
    "/events/priority-config/{config_id}",
    response_model=APIResponse,
    summary="Update event priority config",
    description="Admin updates priority or cooldown for an event type.",
)
async def update_priority_config(
    config_id: int = Path(...),
    priority: Optional[str] = Query(None, description="P0, P1, P2, or P3"),
    cooldown_minutes: Optional[int] = Query(None, ge=0, le=120),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.SYSTEM_CONFIG_UPDATE)),
):
    from app.models.postgres.intelligence import EventPriorityConfig
    from app.services.audit_logger import log_audit

    config = await db.get(EventPriorityConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Priority config not found")

    old_state = {"priority": config.priority, "cooldown_minutes": config.cooldown_minutes}

    if priority and priority in ("P0", "P1", "P2", "P3"):
        config.priority = priority
    if cooldown_minutes is not None:
        config.cooldown_minutes = cooldown_minutes

    await log_audit(
        db,
        actor_id=current_user.user_id,
        actor_role=current_user.roles[0] if current_user.roles else "unknown",
        action="priority_config.updated",
        entity_type="event_priority_config",
        entity_id=str(config_id),
        previous_state=old_state,
        new_state={"priority": config.priority, "cooldown_minutes": config.cooldown_minutes},
    )

    return APIResponse(success=True, data={
        "id": config.id,
        "event_type": config.event_type,
        "priority": config.priority,
        "cooldown_minutes": config.cooldown_minutes,
    })


def _serialize_event(e) -> dict:
    """Serialize an EventBusEvent for API response.
    Never exposes suppressed_at or dedup_key (internal fields)."""
    return {
        "id": e.id,
        "event_type": e.event_type,
        "entity_type": e.entity_type,
        "entity_id": e.entity_id,
        "priority": e.priority,
        "escalation_level": e.escalation_level,
        "occurrence_count": e.occurrence_count,
        "payload": e.payload,
        "triggered_at": e.triggered_at.isoformat() if e.triggered_at else None,
        "last_seen_at": (e.last_seen_at or e.triggered_at).isoformat() if (e.last_seen_at or e.triggered_at) else None,
        "is_acknowledged": e.is_acknowledged,
        "acknowledged_by": e.acknowledged_by,
        "acknowledged_at": e.acknowledged_at.isoformat() if e.acknowledged_at else None,
        "acknowledgement_note": e.acknowledgement_note,
    }
