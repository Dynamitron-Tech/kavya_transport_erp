# E-way Bill Service
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from datetime import datetime, timedelta

from app.models.postgres.eway_bill import EwayBill, EwayItem, DocumentType, TransportMode, VehicleCategory, TransactionType, EwayBillStatus
from app.models.postgres.lr import LR


# ── Validity auto-calculation (per GST rules) ──────────────────────
# ODC = Over Dimensional Cargo
VALIDITY_RULES = {
    # (max_km, hours, is_odc)
    "normal": [
        (100, 24),     # Up to 100 km → 1 day
        (300, 48),     # Up to 300 km → 2 days
        (500, 72),     # Up to 500 km → 3 days
        (1000, 120),   # Up to 1000 km → 5 days
        (float('inf'), 168),  # 1000+ km → 7 days
    ],
    "odc": [
        (100, 24),
        (300, 48),
        (500, 96),     # ODC gets more time for long distances
        (1000, 168),
        (float('inf'), 240),
    ],
}


def calculate_validity_hours(distance_km: int, is_odc: bool = False) -> int:
    """Calculate EWB validity in hours based on distance and cargo type."""
    rules = VALIDITY_RULES["odc"] if is_odc else VALIDITY_RULES["normal"]
    for max_km, hours in rules:
        if distance_km <= max_km:
            return hours
    return 24  # default


def calculate_valid_until(
    start_time: datetime, distance_km: int, is_odc: bool = False
) -> datetime:
    """Calculate the valid_until datetime for an EWB."""
    hours = calculate_validity_hours(distance_km, is_odc)
    return start_time + timedelta(hours=hours)


def _coerce_enum(enum_cls, raw_value):
    if raw_value is None:
        return None
    if isinstance(raw_value, enum_cls):
        return raw_value
    text = str(raw_value).strip()
    for member in enum_cls:
        if text.lower() == str(member.value).lower() or text.upper() == member.name.upper():
            return member
    return raw_value


async def list_eway_bills(db: AsyncSession, page: int = 1, limit: int = 20, search: str = None, status: str = None):
    query = select(EwayBill).where(EwayBill.is_deleted == False)
    count_query = select(func.count(EwayBill.id)).where(EwayBill.is_deleted == False)

    if search:
        sf = or_(
            EwayBill.eway_bill_number.ilike(f"%{search}%"),
            EwayBill.document_number.ilike(f"%{search}%"),
            EwayBill.from_name.ilike(f"%{search}%"),
            EwayBill.to_name.ilike(f"%{search}%"),
        )
        query = query.where(sf)
        count_query = count_query.where(sf)

    if status:
        coerced_status = _coerce_enum(EwayBillStatus, status)
        query = query.where(EwayBill.status == coerced_status)
        count_query = count_query.where(EwayBill.status == coerced_status)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(EwayBill.id.desc()))
    return result.scalars().all(), total


async def get_eway_bill(db: AsyncSession, eway_id: int):
    result = await db.execute(
        select(EwayBill).where(EwayBill.id == eway_id, EwayBill.is_deleted == False)
    )
    return result.scalar_one_or_none()


async def create_eway_bill(db: AsyncSession, data: dict, user_id: int = None) -> EwayBill:
    payload = dict(data)
    items_data = payload.pop("items", [])

    # API schema sends approximate_distance as an integer distance in km,
    # while the model stores `distance_km` (Integer) + `approximate_distance` (Boolean).
    input_distance_km = payload.get("approximate_distance")
    if isinstance(input_distance_km, (int, float)):
        payload["distance_km"] = int(input_distance_km)
        payload["approximate_distance"] = True
    elif payload.get("distance_km") is not None:
        input_distance_km = payload.get("distance_km")

    # Map schema aliases to model field names and fill required columns.
    if not payload.get("eway_bill_number"):
        payload["eway_bill_number"] = f"EWB-{datetime.utcnow().strftime('%y%m%d%H%M%S')}"
    if not payload.get("eway_bill_date"):
        payload["eway_bill_date"] = payload.get("document_date") or datetime.utcnow().date().isoformat()

    payload["supplier_name"] = payload.get("supplier_name") or payload.get("from_name") or "Supplier"
    payload["recipient_name"] = payload.get("recipient_name") or payload.get("to_name") or "Recipient"
    payload["supplier_gstin"] = payload.get("supplier_gstin") or payload.get("from_gstin")
    payload["supplier_state_code"] = payload.get("supplier_state_code") or payload.get("from_state_code")
    payload["supplier_city"] = payload.get("supplier_city") or payload.get("from_place")
    payload["supplier_pincode"] = payload.get("supplier_pincode") or payload.get("from_pincode")
    payload["recipient_gstin"] = payload.get("recipient_gstin") or payload.get("to_gstin")
    payload["recipient_state_code"] = payload.get("recipient_state_code") or payload.get("to_state_code")
    payload["recipient_city"] = payload.get("recipient_city") or payload.get("to_place")
    payload["recipient_pincode"] = payload.get("recipient_pincode") or payload.get("to_pincode")

    if payload.get("total_taxable_value") is None and payload.get("total_value") is not None:
        payload["total_taxable_value"] = payload.get("total_value")

    if not payload.get("job_id") and payload.get("lr_id"):
        lr_result = await db.execute(select(LR).where(LR.id == payload.get("lr_id")))
        lr = lr_result.scalar_one_or_none()
        if lr:
            payload["job_id"] = lr.job_id

    payload["created_by"] = user_id

    payload["status"] = _coerce_enum(EwayBillStatus, payload.get("status", EwayBillStatus.GENERATED))
    payload["transaction_type"] = _coerce_enum(TransactionType, payload.get("transaction_type", TransactionType.OUTWARD))
    payload["document_type"] = _coerce_enum(DocumentType, payload.get("document_type", DocumentType.TAX_INVOICE))
    payload["transport_mode"] = _coerce_enum(TransportMode, payload.get("transport_mode", TransportMode.ROAD))
    payload["vehicle_type"] = _coerce_enum(VehicleCategory, payload.get("vehicle_type", VehicleCategory.REGULAR))

    # Auto-calculate validity if distance is provided and no valid_until set
    if not payload.get("valid_until") and input_distance_km:
        is_odc = str(payload.get("vehicle_type", "")).upper() == "OVER_DIMENSIONAL"
        start_time = datetime.utcnow()
        if payload.get("eway_bill_date"):
            try:
                ebd = payload["eway_bill_date"]
                if isinstance(ebd, str):
                    start_time = datetime.fromisoformat(ebd)
                else:
                    start_time = datetime.combine(ebd, datetime.min.time()) if hasattr(ebd, 'year') else datetime.utcnow()
            except (ValueError, TypeError):
                pass
        payload["valid_until"] = calculate_valid_until(start_time, int(input_distance_km), is_odc)

    # Drop unknown keys that are not model columns (for example, trip_id from schema).
    valid_columns = set(EwayBill.__table__.columns.keys())
    model_data = {k: v for k, v in payload.items() if k in valid_columns and v is not None}

    eway = EwayBill(**model_data)
    db.add(eway)
    await db.flush()

    for item_data in items_data:
        item = EwayItem(eway_bill_id=eway.id, **item_data)
        db.add(item)
    await db.flush()

    # Writeback EWB number to linked LR
    if eway.lr_id and eway.eway_bill_number:
        from sqlalchemy import update
        update_values = {"eway_bill_number": eway.eway_bill_number}
        if eway.eway_bill_date:
            update_values["eway_bill_date"] = eway.eway_bill_date
        if eway.valid_until:
            update_values["eway_bill_valid_until"] = eway.valid_until
        await db.execute(
            update(LR).where(LR.id == eway.lr_id).values(**update_values)
        )

    # Writeback to Job
    if eway.job_id and eway.eway_bill_number:
        from app.models.postgres.job import Job
        from sqlalchemy import update
        await db.execute(
            update(Job).where(Job.id == eway.job_id)
            .values(latest_eway_bill_number=eway.eway_bill_number)
        )

    await db.flush()
    return eway


async def update_eway_bill(db: AsyncSession, eway_id: int, data: dict):
    eway = await get_eway_bill(db, eway_id)
    if not eway:
        return None
    for k, v in data.items():
        if v is not None:
            setattr(eway, k, v)
    return eway


async def get_eway_with_details(db: AsyncSession, eway: EwayBill) -> dict:
    items_result = await db.execute(select(EwayItem).where(EwayItem.eway_bill_id == eway.id))
    items = items_result.scalars().all()

    return {
        **{c.key: getattr(eway, c.key) for c in eway.__table__.columns},
        "items": [{c.key: getattr(item, c.key) for c in item.__table__.columns} for item in items],
    }


# ── Phase 1 Local Operations (no NIC API) ──────────────────────────

async def cancel_eway_bill_local(
    db: AsyncSession, eway_id: int, reason: str, user_id: int = None
) -> EwayBill:
    """Cancel an EWB locally (Phase 1 — no NIC API call)."""
    eway = await get_eway_bill(db, eway_id)
    if not eway:
        return None

    # Only DRAFT, GENERATED, ACTIVE can be cancelled
    cancellable = [EwayBillStatus.DRAFT, EwayBillStatus.GENERATED, EwayBillStatus.ACTIVE]
    if eway.status not in cancellable:
        raise ValueError(f"Cannot cancel EWB in status {eway.status.value}")

    eway.status = EwayBillStatus.CANCELLED
    eway.remarks = f"Cancelled: {reason}" if reason else "Cancelled"
    await db.flush()
    return eway


async def extend_eway_bill_local(
    db: AsyncSession, eway_id: int, new_vehicle_no: str = None,
    additional_distance_km: int = 0, reason: str = None, user_id: int = None
) -> EwayBill:
    """Extend an EWB validity locally (Phase 1 — no NIC API call)."""
    eway = await get_eway_bill(db, eway_id)
    if not eway:
        return None

    extendable = [EwayBillStatus.ACTIVE, EwayBillStatus.IN_TRANSIT]
    if eway.status not in extendable:
        raise ValueError(f"Cannot extend EWB in status {eway.status.value}")

    if new_vehicle_no:
        eway.vehicle_number = new_vehicle_no

    # Recalculate validity from now
    base_distance = eway.approximate_distance or 0
    total_distance = base_distance + additional_distance_km
    eway.valid_until = calculate_valid_until(datetime.utcnow(), total_distance)
    eway.status = EwayBillStatus.EXTENDED
    eway.is_extended = True
    eway.remarks = f"Extended: {reason}" if reason else "Extended"

    # Reset alert flags for new validity period
    eway.alert_8h_sent = False
    eway.alert_4h_sent = False
    eway.alert_1h_sent = False

    await db.flush()
    return eway


async def list_expiring_eway_bills(db: AsyncSession, hours: int = 8):
    """Get EWBs expiring within the specified hours."""
    cutoff = datetime.utcnow() + timedelta(hours=hours)
    result = await db.execute(
        select(EwayBill).where(
            and_(
                EwayBill.is_deleted == False,
                EwayBill.status.in_([EwayBillStatus.ACTIVE, EwayBillStatus.IN_TRANSIT]),
                EwayBill.valid_until <= cutoff,
                EwayBill.valid_until > datetime.utcnow(),
            )
        ).order_by(EwayBill.valid_until.asc())
    )
    return result.scalars().all()


async def list_active_eway_bills(db: AsyncSession):
    """Get all active/in-transit EWBs."""
    result = await db.execute(
        select(EwayBill).where(
            and_(
                EwayBill.is_deleted == False,
                EwayBill.status.in_([
                    EwayBillStatus.ACTIVE,
                    EwayBillStatus.IN_TRANSIT,
                    EwayBillStatus.EXTENDED,
                ]),
            )
        ).order_by(EwayBill.valid_until.asc())
    )
    return result.scalars().all()


async def get_trip_compliance(db: AsyncSession, trip_id: int) -> dict:
    """Check EWB compliance for a trip."""
    result = await db.execute(
        select(EwayBill).where(
            and_(
                EwayBill.is_deleted == False,
                EwayBill.trip_id == trip_id,
            )
        )
    )
    bills = result.scalars().all()
    if not bills:
        return {"compliant": False, "reason": "No E-Way Bill linked to this trip", "bills": []}

    now = datetime.utcnow()
    active_bills = []
    for bill in bills:
        status = bill.status.value if hasattr(bill.status, 'value') else str(bill.status)
        is_valid = status in ("ACTIVE", "IN_TRANSIT", "EXTENDED", "GENERATED")
        is_expired = bill.valid_until and bill.valid_until < now if bill.valid_until else False
        hours_remaining = ((bill.valid_until - now).total_seconds() / 3600) if bill.valid_until and bill.valid_until > now else 0
        active_bills.append({
            "id": bill.id,
            "ewb_number": bill.eway_bill_number,
            "status": status,
            "valid_until": bill.valid_until.isoformat() if bill.valid_until else None,
            "hours_remaining": round(hours_remaining, 1),
            "is_valid": is_valid and not is_expired,
            "is_expired": is_expired,
        })

    any_valid = any(b["is_valid"] for b in active_bills)
    return {
        "compliant": any_valid,
        "reason": None if any_valid else "All linked E-Way Bills are expired or invalid",
        "bills": active_bills,
    }


async def complete_trip_eway_bills(db: AsyncSession, trip_id: int) -> int:
    """Mark active linked EWBs as completed when trip is delivered."""
    result = await db.execute(
        select(EwayBill).where(
            and_(
                EwayBill.is_deleted == False,
                EwayBill.trip_id == trip_id,
                EwayBill.status.in_([
                    EwayBillStatus.ACTIVE,
                    EwayBillStatus.IN_TRANSIT,
                    EwayBillStatus.EXTENDED,
                ]),
            )
        )
    )

    count = 0
    for bill in result.scalars().all():
        bill.status = EwayBillStatus.COMPLETED
        count += 1

    if count:
        await db.flush()
    return count
