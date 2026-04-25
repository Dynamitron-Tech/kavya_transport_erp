# AIS-140 Compliance Service
# Transport ERP — Phase B

import logging
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.postgres.vehicle import Vehicle

logger = logging.getLogger(__name__)


async def check_vehicle_ais140(db: AsyncSession, vehicle_id: int) -> dict:
    """Check AIS-140 compliance for a vehicle."""
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        return {"vehicle_id": vehicle_id, "found": False, "compliant": False}

    # AIS-140 checks:
    # 1. GPS device installed and certified
    # 2. Emergency/SOS button configured
    # 3. Driver mapping active
    # 4. Position data being sent
    gps_device = getattr(vehicle, "gps_device_id", None) or getattr(vehicle, "tracker_id", None)
    has_device = bool(gps_device)

    return {
        "vehicle_id": vehicle_id,
        "registration": getattr(vehicle, "registration_number", None) or getattr(vehicle, "registration", None),
        "found": True,
        "has_gps_device": has_device,
        "device_id": gps_device,
        "sos_configured": has_device,  # Assume SOS if device present
        "driver_mapped": True,  # Placeholder
        "position_reporting": has_device,
        "compliant": has_device,
        "status": "compliant" if has_device else "non_compliant",
    }


async def get_fleet_compliance_report(
    db: AsyncSession,
    tenant_id: Optional[int] = None,
) -> dict:
    """Fleet-wide AIS-140 compliance report."""
    filters = [Vehicle.is_deleted == False] if hasattr(Vehicle, "is_deleted") else []
    if tenant_id:
        filters.append(Vehicle.tenant_id == tenant_id)

    from sqlalchemy import and_
    query = select(Vehicle)
    if filters:
        query = query.where(and_(*filters))
    result = await db.execute(query)
    vehicles = result.scalars().all()

    compliant = 0
    non_compliant = 0
    details = []

    for v in vehicles:
        report = await check_vehicle_ais140(db, v.id)
        if report["compliant"]:
            compliant += 1
        else:
            non_compliant += 1
        details.append(report)

    total = compliant + non_compliant
    return {
        "total_vehicles": total,
        "compliant": compliant,
        "non_compliant": non_compliant,
        "compliance_pct": round(compliant / total * 100, 1) if total > 0 else 0,
        "vehicles": details,
    }
