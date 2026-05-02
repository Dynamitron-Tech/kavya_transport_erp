# Driver Event Service
# Transport ERP — Phase B

import logging
from typing import Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.postgres.driver_event import DriverEvent, DriverEventType

logger = logging.getLogger(__name__)


async def list_events(
    db: AsyncSession,
    driver_id: Optional[int] = None,
    trip_id: Optional[int] = None,
    vehicle_id: Optional[int] = None,
    event_type: Optional[str] = None,
    tenant_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
) -> list:
    filters = []
    if driver_id:
        filters.append(DriverEvent.driver_id == driver_id)
    if trip_id:
        filters.append(DriverEvent.trip_id == trip_id)
    if vehicle_id:
        filters.append(DriverEvent.vehicle_id == vehicle_id)
    if event_type:
        try:
            filters.append(DriverEvent.event_type == DriverEventType(event_type))
        except ValueError:
            pass
    if tenant_id:
        filters.append(DriverEvent.tenant_id == tenant_id)

    result = await db.execute(
        select(DriverEvent)
        .where(and_(*filters) if filters else True)
        .order_by(DriverEvent.created_at.desc())
        .offset(skip).limit(limit)
    )
    return result.scalars().all()


async def get_event(db: AsyncSession, event_id: int) -> Optional[DriverEvent]:
    result = await db.execute(
        select(DriverEvent).where(DriverEvent.id == event_id)
    )
    return result.scalar_one_or_none()


async def create_event(
    db: AsyncSession,
    driver_id: int,
    event_type: str,
    severity: int = 1,
    trip_id: Optional[int] = None,
    vehicle_id: Optional[int] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    location_name: Optional[str] = None,
    speed_kmph: Optional[float] = None,
    details: Optional[dict] = None,
    tenant_id: Optional[int] = None,
    branch_id: Optional[int] = None,
) -> DriverEvent:
    try:
        et = DriverEventType(event_type)
    except ValueError:
        et = DriverEventType.HARSH_BRAKE

    event = DriverEvent(
        driver_id=driver_id,
        trip_id=trip_id,
        vehicle_id=vehicle_id,
        event_type=et,
        severity=min(max(severity, 1), 5),
        latitude=latitude,
        longitude=longitude,
        location_name=location_name,
        speed_kmph=speed_kmph,
        details=details,
        tenant_id=tenant_id,
        branch_id=branch_id,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def get_driver_event_summary(
    db: AsyncSession,
    driver_id: int,
) -> dict:
    """Get event counts by type for a driver."""
    from sqlalchemy import func

    result = await db.execute(
        select(DriverEvent.event_type, func.count(DriverEvent.id))
        .where(DriverEvent.driver_id == driver_id)
        .group_by(DriverEvent.event_type)
    )
    rows = result.all()
    summary = {}
    total = 0
    for et, cnt in rows:
        summary[et.value] = cnt
        total += cnt
    summary["total"] = total
    return summary
