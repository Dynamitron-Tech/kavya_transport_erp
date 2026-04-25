# Compliance API Endpoints
# Transport ERP — Phase B: AIS-140, Alerts, Driver Events, Audit Notes

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.postgres.connection import get_db
from app.core.security import get_current_user, TokenData
from app.services import compliance_alert_service, ais140_service, driver_event_service, audit_note_service
from app.schemas.geofence import DriverEventCreate, AuditNoteCreate
from app.middleware.permissions import require_permission, require_any_permission, Permissions

router = APIRouter()

# ── Compliance Alerts ──────────────────────────────────────────────

@router.get("/alerts")
async def list_alerts(
    severity: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None),
    vehicle_id: Optional[int] = Query(None),
    driver_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.COMPLIANCE_READ)),
):
    alerts = await compliance_alert_service.list_alerts(
        db, tenant_id=current_user.tenant_id,
        severity=severity, resolved=resolved,
        vehicle_id=vehicle_id, driver_id=driver_id,
        skip=skip, limit=limit,
    )
    return {"success": True, "data": alerts}


@router.get("/alerts/summary")
async def alert_summary(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.COMPLIANCE_READ)),
):
    summary = await compliance_alert_service.get_alert_summary(db, tenant_id=current_user.tenant_id)
    return {"success": True, "data": summary}


@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.COMPLIANCE_MANAGE)),
):
    alert = await compliance_alert_service.resolve_alert(db, alert_id, current_user.id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "data": alert, "message": "Alert resolved"}


# ── AIS-140 ────────────────────────────────────────────────────────

@router.get("/ais140/{vehicle_id}")
async def check_ais140(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.COMPLIANCE_READ)),
):
    report = await ais140_service.check_vehicle_ais140(db, vehicle_id)
    if not report.get("found"):
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"success": True, "data": report}


@router.get("/ais140/report")
async def ais140_fleet_report(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.COMPLIANCE_READ)),
):
    report = await ais140_service.get_fleet_compliance_report(db, tenant_id=current_user.tenant_id)
    return {"success": True, "data": report}


# ── Driver Events ──────────────────────────────────────────────────

@router.get("/events")
async def list_driver_events(
    driver_id: Optional[int] = Query(None),
    trip_id: Optional[int] = Query(None),
    vehicle_id: Optional[int] = Query(None),
    event_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.COMPLIANCE_READ)),
):
    events = await driver_event_service.list_events(
        db, driver_id=driver_id, trip_id=trip_id,
        vehicle_id=vehicle_id, event_type=event_type,
        tenant_id=current_user.tenant_id,
        skip=skip, limit=limit,
    )
    return {"success": True, "data": events}


@router.get("/events/driver/{driver_id}/summary")
async def driver_event_summary(
    driver_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.COMPLIANCE_READ)),
):
    summary = await driver_event_service.get_driver_event_summary(db, driver_id)
    return {"success": True, "data": summary}


@router.post("/events")
async def create_driver_event(
    payload: DriverEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.COMPLIANCE_MANAGE)),
):
    event = await driver_event_service.create_event(
        db,
        driver_id=payload.driver_id,
        event_type=payload.event_type,
        severity=payload.severity,
        trip_id=payload.trip_id,
        vehicle_id=payload.vehicle_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        location_name=payload.location_name,
        speed_kmph=payload.speed_kmph,
        details=payload.details,
        tenant_id=current_user.tenant_id,
        branch_id=getattr(current_user, "branch_id", None),
    )
    return {"success": True, "data": event, "message": "Event recorded"}


# ── Audit Notes ────────────────────────────────────────────────────

@router.get("/audit-notes")
async def list_audit_notes(
    resource_type: Optional[str] = Query(None),
    resource_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.COMPLIANCE_READ)),
):
    notes = await audit_note_service.list_notes(
        db, resource_type=resource_type, resource_id=resource_id,
        status=status, tenant_id=current_user.tenant_id,
        skip=skip, limit=limit,
    )
    return {"success": True, "data": notes}


@router.post("/audit-notes")
async def create_audit_note(
    payload: AuditNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.COMPLIANCE_MANAGE)),
):
    note = await audit_note_service.create_note(
        db,
        resource_type=payload.resource_type,
        resource_id=payload.resource_id,
        note_text=payload.note_text,
        auditor_id=current_user.id,
        tenant_id=current_user.tenant_id,
        branch_id=getattr(current_user, "branch_id", None),
    )
    return {"success": True, "data": note, "message": "Audit note created"}


@router.put("/audit-notes/{note_id}/resolve")
async def resolve_audit_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.COMPLIANCE_MANAGE)),
):
    note = await audit_note_service.resolve_note(db, note_id, current_user.id)
    if not note:
        raise HTTPException(status_code=404, detail="Audit note not found")
    return {"success": True, "data": note, "message": "Audit note resolved"}
