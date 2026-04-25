# Compliance Alert Service
# Transport ERP — Phase B

import logging
from typing import Optional
from datetime import datetime
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.postgres.compliance_alert import ComplianceAlert, AlertType, AlertSeverity

logger = logging.getLogger(__name__)


async def list_alerts(
    db: AsyncSession,
    tenant_id: Optional[int] = None,
    severity: Optional[str] = None,
    resolved: Optional[bool] = None,
    vehicle_id: Optional[int] = None,
    driver_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
) -> list:
    filters = []
    if tenant_id:
        filters.append(ComplianceAlert.tenant_id == tenant_id)
    if severity:
        try:
            filters.append(ComplianceAlert.severity == AlertSeverity(severity))
        except ValueError:
            pass
    if resolved is not None:
        filters.append(ComplianceAlert.resolved == resolved)
    if vehicle_id:
        filters.append(ComplianceAlert.vehicle_id == vehicle_id)
    if driver_id:
        filters.append(ComplianceAlert.driver_id == driver_id)

    result = await db.execute(
        select(ComplianceAlert)
        .where(and_(*filters) if filters else True)
        .order_by(ComplianceAlert.created_at.desc())
        .offset(skip).limit(limit)
    )
    return result.scalars().all()


async def get_alert(db: AsyncSession, alert_id: int) -> Optional[ComplianceAlert]:
    result = await db.execute(
        select(ComplianceAlert).where(ComplianceAlert.id == alert_id)
    )
    return result.scalar_one_or_none()


async def create_alert(
    db: AsyncSession,
    title: str,
    alert_type: str = "warning",
    severity: str = "medium",
    message: Optional[str] = None,
    vehicle_id: Optional[int] = None,
    driver_id: Optional[int] = None,
    document_id: Optional[int] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    due_date: Optional[datetime] = None,
    tenant_id: Optional[int] = None,
    branch_id: Optional[int] = None,
) -> ComplianceAlert:
    try:
        at = AlertType(alert_type)
    except ValueError:
        at = AlertType.WARNING
    try:
        sv = AlertSeverity(severity)
    except ValueError:
        sv = AlertSeverity.MEDIUM

    alert = ComplianceAlert(
        title=title,
        alert_type=at,
        severity=sv,
        message=message,
        vehicle_id=vehicle_id,
        driver_id=driver_id,
        document_id=document_id,
        entity_type=entity_type,
        entity_id=entity_id,
        due_date=due_date,
        tenant_id=tenant_id,
        branch_id=branch_id,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert


async def resolve_alert(db: AsyncSession, alert_id: int, user_id: int) -> Optional[ComplianceAlert]:
    alert = await get_alert(db, alert_id)
    if not alert:
        return None
    alert.resolved = True
    alert.resolved_by = user_id
    alert.resolved_at = datetime.utcnow()
    await db.commit()
    await db.refresh(alert)
    return alert


async def get_alert_summary(
    db: AsyncSession,
    tenant_id: Optional[int] = None,
) -> dict:
    """Get counts by severity for unresolved alerts."""
    from sqlalchemy import func
    filters = [ComplianceAlert.resolved == False]
    if tenant_id:
        filters.append(ComplianceAlert.tenant_id == tenant_id)

    result = await db.execute(
        select(ComplianceAlert.severity, func.count(ComplianceAlert.id))
        .where(and_(*filters))
        .group_by(ComplianceAlert.severity)
    )
    rows = result.all()
    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0, "total": 0}
    for sev, cnt in rows:
        summary[sev.value] = cnt
        summary["total"] += cnt
    return summary
