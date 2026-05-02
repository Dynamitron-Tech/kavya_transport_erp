# Supplier Service - CRUD operations
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.models.postgres.supplier import Supplier, SupplierVehicle
from app.models.postgres.market_trip import MarketTrip
from app.utils.generators import generate_supplier_code


async def list_suppliers(db: AsyncSession, page: int = 1, limit: int = 20, search: str = None, status: str = None, supplier_type: str = None):
    query = select(Supplier).where(Supplier.is_deleted == False)
    count_query = select(func.count(Supplier.id)).where(Supplier.is_deleted == False)

    if search:
        sf = or_(
            Supplier.name.ilike(f"%{search}%"),
            Supplier.code.ilike(f"%{search}%"),
            Supplier.phone.ilike(f"%{search}%"),
            Supplier.gstin.ilike(f"%{search}%"),
            Supplier.city.ilike(f"%{search}%"),
        )
        query = query.where(sf)
        count_query = count_query.where(sf)

    if status:
        query = query.where(Supplier.is_active == (status == "active"))
        count_query = count_query.where(Supplier.is_active == (status == "active"))

    if supplier_type:
        query = query.where(Supplier.supplier_type == supplier_type)
        count_query = count_query.where(Supplier.supplier_type == supplier_type)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(Supplier.id.desc()))
    return result.scalars().all(), total


async def get_supplier(db: AsyncSession, supplier_id: int):
    result = await db.execute(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.is_deleted == False)
    )
    return result.scalar_one_or_none()


async def create_supplier(db: AsyncSession, data: dict) -> Supplier:
    if "code" not in data or not data["code"]:
        data["code"] = generate_supplier_code(data.get("name", "SUP"))
    supplier = Supplier(**data)
    db.add(supplier)
    await db.flush()
    return supplier


async def update_supplier(db: AsyncSession, supplier_id: int, data: dict):
    supplier = await get_supplier(db, supplier_id)
    if not supplier:
        return None
    for k, v in data.items():
        if v is not None:
            setattr(supplier, k, v)
    return supplier


async def delete_supplier(db: AsyncSession, supplier_id: int) -> bool:
    supplier = await get_supplier(db, supplier_id)
    if not supplier:
        return False
    supplier.is_deleted = True
    return True


# --- Supplier Vehicles ---
async def list_supplier_vehicles(db: AsyncSession, supplier_id: int):
    result = await db.execute(
        select(SupplierVehicle).where(
            SupplierVehicle.supplier_id == supplier_id,
            SupplierVehicle.is_active == True,
        )
    )
    return result.scalars().all()


async def add_supplier_vehicle(db: AsyncSession, supplier_id: int, data: dict) -> SupplierVehicle:
    sv = SupplierVehicle(supplier_id=supplier_id, **data)
    db.add(sv)
    await db.flush()
    return sv


async def remove_supplier_vehicle(db: AsyncSession, sv_id: int) -> bool:
    result = await db.execute(select(SupplierVehicle).where(SupplierVehicle.id == sv_id))
    sv = result.scalar_one_or_none()
    if not sv:
        return False
    sv.is_active = False
    return True


# --- Supplier Trips ---
async def list_supplier_trips(db: AsyncSession, supplier_id: int, page: int = 1, limit: int = 20):
    query = select(MarketTrip).where(
        MarketTrip.supplier_id == supplier_id,
        MarketTrip.is_deleted == False,
    )
    count_query = select(func.count(MarketTrip.id)).where(
        MarketTrip.supplier_id == supplier_id,
        MarketTrip.is_deleted == False,
    )
    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(MarketTrip.id.desc()))
    return result.scalars().all(), total


# --- Supplier Statement (Payables) ---
async def get_supplier_statement(db: AsyncSession, supplier_id: int):
    """Get supplier payables statement - all market trips and their settlement status."""
    result = await db.execute(
        select(MarketTrip).where(
            MarketTrip.supplier_id == supplier_id,
            MarketTrip.is_deleted == False,
        ).order_by(MarketTrip.created_at.desc())
    )
    trips = result.scalars().all()

    total_payable = 0
    total_paid = 0
    total_tds = 0
    entries = []

    for trip in trips:
        net = float(trip.net_payable or 0)
        tds = float(trip.tds_amount or 0)
        is_settled = trip.status.value == "settled"

        if is_settled:
            total_paid += net
        else:
            total_payable += net
        total_tds += tds

        entries.append({
            "market_trip_id": trip.id,
            "job_id": trip.job_id,
            "contractor_rate": float(trip.contractor_rate or 0),
            "tds_amount": tds,
            "net_payable": net,
            "status": trip.status.value,
            "settled_at": trip.settled_at.isoformat() if trip.settled_at else None,
            "settlement_reference": trip.settlement_reference,
        })

    return {
        "supplier_id": supplier_id,
        "total_payable": total_payable,
        "total_paid": total_paid,
        "total_tds_deducted": total_tds,
        "outstanding": total_payable,
        "entries": entries,
    }
