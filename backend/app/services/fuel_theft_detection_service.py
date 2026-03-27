# I-04 — Fuel Theft Detection
# Validates dispensed quantity against expected consumption.

import logging
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.postgres.fuel_pump import FuelIssue, FuelTheftAlert, TheftAlertStatus
from app.models.postgres.vehicle import Vehicle
from app.services.config_service import get_config_bulk
from app.services.event_bus import event_bus, EventTypes

logger = logging.getLogger(__name__)


async def check_fuel_mismatch(
    db: AsyncSession,
    fuel_issue_id: int,
) -> dict:
    """After fuel fill entry, check for theft/anomaly."""

    cfg = await get_config_bulk(db, "fuel.")
    theft_litres = cfg.get("fuel.theft_variance_litres", 15)
    theft_pct = cfg.get("fuel.theft_variance_pct", 12)
    anomaly_litres = cfg.get("fuel.anomaly_variance_litres", 8)
    anomaly_pct = cfg.get("fuel.anomaly_variance_pct", 8)
    rolling_days = cfg.get("fuel.mileage_rolling_days", 30)
    min_fills = cfg.get("fuel.mileage_min_fills", 10)
    depot_radius = cfg.get("fuel.depot_radius_m", 500)

    # Load the fuel issue
    issue = await db.get(FuelIssue, fuel_issue_id)
    if not issue:
        return {"status": "error", "message": "Fuel issue not found"}

    vehicle = await db.get(Vehicle, issue.vehicle_id)
    if not vehicle:
        return {"status": "error", "message": "Vehicle not found"}

    dispensed = float(issue.quantity_litres)
    tank_capacity = float(vehicle.fuel_tank_capacity or 200)

    # Get vehicle mileage (rolling or manufacturer spec)
    mileage_kmpl = await _get_vehicle_mileage(
        db, issue.vehicle_id, rolling_days, min_fills,
        float(vehicle.mileage_per_litre or 4)
    )

    # Get previous fill for this vehicle
    prev_fill = await db.execute(
        select(FuelIssue)
        .where(
            FuelIssue.vehicle_id == issue.vehicle_id,
            FuelIssue.id < fuel_issue_id,
        )
        .order_by(FuelIssue.created_at.desc())
    )
    prev = prev_fill.scalar_one_or_none()

    if not prev or not prev.odometer_reading or not issue.odometer_reading:
        # Not enough data to compute variance
        return {"status": "normal", "message": "Insufficient data for mismatch check"}

    km_driven = float(issue.odometer_reading - prev.odometer_reading)
    if km_driven < 0:
        km_driven = 0

    expected_consumption = km_driven / mileage_kmpl if mileage_kmpl > 0 else 0
    last_fill_litres = float(prev.quantity_litres)
    expected_remaining = last_fill_litres - expected_consumption
    expected_remaining = max(0, expected_remaining)
    expected_fill_needed = tank_capacity - expected_remaining

    if expected_fill_needed <= 0:
        expected_fill_needed = 1  # avoid division by zero

    variance = dispensed - expected_fill_needed
    variance_pct = (variance / expected_fill_needed) * 100

    # Determine flag status
    flag_status = "normal"
    alert_type = None
    severity = "info"

    if variance > theft_litres and variance_pct > theft_pct:
        flag_status = "suspected_theft"
        alert_type = "excessive_dispensing"
        severity = "critical"
    elif variance > anomaly_litres and variance_pct > anomaly_pct:
        flag_status = "anomaly"
        alert_type = "fuel_anomaly"
        severity = "warning"

    result = {
        "status": flag_status,
        "dispensed_litres": dispensed,
        "expected_fill_litres": round(expected_fill_needed, 2),
        "variance_litres": round(variance, 2),
        "variance_pct": round(variance_pct, 1),
        "km_driven": round(km_driven, 1),
        "mileage_kmpl": round(mileage_kmpl, 2),
    }

    if flag_status != "normal":
        # Update fuel issue flag
        issue.is_flagged = True
        issue.flag_reason = f"{flag_status}: variance {round(variance, 1)}L ({round(variance_pct, 1)}%)"

        # Create theft alert
        alert = FuelTheftAlert(
            fuel_issue_id=fuel_issue_id,
            vehicle_id=issue.vehicle_id,
            driver_id=issue.driver_id,
            alert_type=alert_type,
            severity=severity,
            description=issue.flag_reason,
            expected_litres=Decimal(str(round(expected_fill_needed, 2))),
            actual_litres=Decimal(str(dispensed)),
            deviation_pct=Decimal(str(round(variance_pct, 2))),
            status=TheftAlertStatus.OPEN,
            branch_id=issue.branch_id,
            tenant_id=issue.tenant_id,
        )
        db.add(alert)
        await db.flush()

        # Publish event
        await event_bus.publish(
            EventTypes.FUEL_MISMATCH,
            entity_type="vehicle",
            entity_id=str(vehicle.registration_number),
            payload={
                "vehicle_id": issue.vehicle_id,
                "driver_id": issue.driver_id,
                "dispensed": dispensed,
                "expected": round(expected_fill_needed, 2),
                "variance_litres": round(variance, 2),
                "variance_pct": round(variance_pct, 1),
                "severity": severity,
            },
            db_session=db,
        )

    # Check off-site fuelling
    await _check_offsite_fuelling(db, issue, depot_radius, vehicle)

    return result


async def _get_vehicle_mileage(
    db: AsyncSession,
    vehicle_id: int,
    rolling_days: int,
    min_fills: int,
    manufacturer_spec: float,
) -> float:
    """Compute rolling mileage or fall back to manufacturer spec."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=rolling_days)

    result = await db.execute(
        select(
            func.sum(FuelIssue.quantity_litres),
            func.count(FuelIssue.id),
        )
        .where(
            FuelIssue.vehicle_id == vehicle_id,
            FuelIssue.created_at >= cutoff,
        )
    )
    row = result.one()
    total_litres = float(row[0]) if row[0] else 0
    fill_count = row[1]

    if fill_count < min_fills or total_litres <= 0:
        return manufacturer_spec

    # Get total km from odometer readings in this period
    odo_result = await db.execute(
        select(
            func.min(FuelIssue.odometer_reading),
            func.max(FuelIssue.odometer_reading),
        )
        .where(
            FuelIssue.vehicle_id == vehicle_id,
            FuelIssue.created_at >= cutoff,
            FuelIssue.odometer_reading.isnot(None),
        )
    )
    odo_row = odo_result.one()
    if odo_row[0] and odo_row[1]:
        total_km = float(odo_row[1] - odo_row[0])
        if total_km > 0:
            return total_km / total_litres

    return manufacturer_spec


async def _check_offsite_fuelling(db, issue, depot_radius, vehicle):
    """Check if vehicle GPS at fill time is within depot radius."""
    # If GPS location at fill time is available (from vehicle's current GPS)
    if vehicle.current_latitude and vehicle.current_longitude:
        # TODO: compare with depot locations from geofences table
        # For now, log as check_pending
        pass
