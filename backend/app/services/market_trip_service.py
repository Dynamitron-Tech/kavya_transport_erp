# Market Trip Service
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.models.postgres.market_trip import MarketTrip, MarketTripStatus
from app.models.postgres.supplier import Supplier


async def list_market_trips(db: AsyncSession, page: int = 1, limit: int = 20, search: str = None, status: str = None, supplier_id: int = None):
    query = select(MarketTrip).where(MarketTrip.is_deleted == False)
    count_query = select(func.count(MarketTrip.id)).where(MarketTrip.is_deleted == False)

    if status:
        query = query.where(MarketTrip.status == MarketTripStatus(status))
        count_query = count_query.where(MarketTrip.status == MarketTripStatus(status))

    if supplier_id:
        query = query.where(MarketTrip.supplier_id == supplier_id)
        count_query = count_query.where(MarketTrip.supplier_id == supplier_id)

    if search:
        sf = or_(
            MarketTrip.vehicle_registration.ilike(f"%{search}%"),
            MarketTrip.driver_name.ilike(f"%{search}%"),
        )
        query = query.where(sf)
        count_query = count_query.where(sf)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(MarketTrip.id.desc()))
    return result.scalars().all(), total


async def get_market_trip(db: AsyncSession, trip_id: int):
    result = await db.execute(
        select(MarketTrip).where(MarketTrip.id == trip_id, MarketTrip.is_deleted == False)
    )
    return result.scalar_one_or_none()


async def create_market_trip(db: AsyncSession, data: dict) -> MarketTrip:
    # Calculate TDS and net payable
    contractor_rate = Decimal(str(data.get("contractor_rate", 0)))
    tds_rate = Decimal(str(data.get("tds_rate", 1.0)))
    tds_amount = (contractor_rate * tds_rate) / Decimal("100")
    net_payable = contractor_rate - tds_amount

    data["tds_amount"] = float(tds_amount)
    data["net_payable"] = float(net_payable)
    data["status"] = MarketTripStatus.PENDING

    trip = MarketTrip(**data)
    db.add(trip)
    await db.flush()
    return trip


async def update_market_trip(db: AsyncSession, trip_id: int, data: dict):
    trip = await get_market_trip(db, trip_id)
    if not trip:
        return None

    for k, v in data.items():
        if v is not None:
            setattr(trip, k, v)

    # Recalculate if rate changed
    if "contractor_rate" in data or "tds_rate" in data:
        contractor_rate = Decimal(str(trip.contractor_rate))
        tds_rate = Decimal(str(trip.tds_rate))
        trip.tds_amount = (contractor_rate * tds_rate) / Decimal("100")
        trip.net_payable = contractor_rate - trip.tds_amount

    return trip


async def assign_vehicle(db: AsyncSession, trip_id: int, data: dict):
    """Assign vehicle and driver to a market trip."""
    trip = await get_market_trip(db, trip_id)
    if not trip:
        return None
    if trip.status != MarketTripStatus.PENDING:
        raise ValueError("Can only assign vehicle to pending market trips")

    trip.vehicle_registration = data["vehicle_registration"]
    trip.driver_name = data["driver_name"]
    trip.driver_phone = data["driver_phone"]
    trip.driver_license = data.get("driver_license")
    trip.status = MarketTripStatus.ASSIGNED
    trip.assigned_at = datetime.utcnow()
    return trip


async def start_transit(db: AsyncSession, trip_id: int):
    """Mark market trip as in transit."""
    trip = await get_market_trip(db, trip_id)
    if not trip:
        return None
    if trip.status != MarketTripStatus.ASSIGNED:
        raise ValueError("Can only start transit for assigned market trips")
    trip.status = MarketTripStatus.IN_TRANSIT
    return trip


async def complete_delivery(db: AsyncSession, trip_id: int):
    """Mark market trip as delivered."""
    trip = await get_market_trip(db, trip_id)
    if not trip:
        return None
    if trip.status != MarketTripStatus.IN_TRANSIT:
        raise ValueError("Can only mark delivered for in-transit market trips")
    trip.status = MarketTripStatus.DELIVERED
    trip.delivered_at = datetime.utcnow()
    return trip


async def settle(db: AsyncSession, trip_id: int, settlement_reference: str, settlement_remarks: str = None):
    """Settle supplier payment for a market trip."""
    trip = await get_market_trip(db, trip_id)
    if not trip:
        return None
    if trip.status != MarketTripStatus.DELIVERED:
        raise ValueError("Can only settle delivered market trips")
    trip.status = MarketTripStatus.SETTLED
    trip.settled_at = datetime.utcnow()
    trip.settlement_reference = settlement_reference
    trip.settlement_remarks = settlement_remarks
    return trip


async def cancel_market_trip(db: AsyncSession, trip_id: int):
    """Cancel a market trip."""
    trip = await get_market_trip(db, trip_id)
    if not trip:
        return None
    if trip.status in (MarketTripStatus.SETTLED, MarketTripStatus.CANCELLED):
        raise ValueError("Cannot cancel settled or already cancelled trips")
    trip.status = MarketTripStatus.CANCELLED
    return trip


async def get_pnl(db: AsyncSession, trip_id: int):
    """Get P&L breakdown for a market trip."""
    trip = await get_market_trip(db, trip_id)
    if not trip:
        return None

    client_rate = float(trip.client_rate or 0)
    contractor_rate = float(trip.contractor_rate or 0)
    loading = float(trip.loading_charges or 0)
    unloading = float(trip.unloading_charges or 0)
    other = float(trip.other_charges or 0)
    tds_amount = float(trip.tds_amount or 0)
    advance = float(trip.advance_amount or 0)

    total_cost = contractor_rate + loading + unloading + other
    gross_margin = client_rate - total_cost
    gross_margin_pct = (gross_margin / client_rate * 100) if client_rate > 0 else 0

    return {
        "market_trip_id": trip.id,
        "job_id": trip.job_id,
        "client_rate": client_rate,
        "contractor_rate": contractor_rate,
        "loading_charges": loading,
        "unloading_charges": unloading,
        "other_charges": other,
        "total_cost": total_cost,
        "gross_margin": gross_margin,
        "gross_margin_pct": round(gross_margin_pct, 2),
        "tds_deducted": tds_amount,
        "advance_paid": advance,
        "net_payable": float(trip.net_payable or 0),
        "status": trip.status.value,
    }
