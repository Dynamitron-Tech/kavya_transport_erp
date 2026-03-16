# E-way Bill Service
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from datetime import datetime

from app.models.postgres.eway_bill import EwayBill, EwayItem, DocumentType, TransportMode, VehicleCategory, TransactionType, EwayBillStatus
from app.models.postgres.lr import LR


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

    payload["status"] = _coerce_enum(EwayBillStatus, payload.get("status", EwayBillStatus.DRAFT))
    payload["transaction_type"] = _coerce_enum(TransactionType, payload.get("transaction_type", TransactionType.OUTWARD))
    payload["document_type"] = _coerce_enum(DocumentType, payload.get("document_type", DocumentType.TAX_INVOICE))
    payload["transport_mode"] = _coerce_enum(TransportMode, payload.get("transport_mode", TransportMode.ROAD))
    payload["vehicle_type"] = _coerce_enum(VehicleCategory, payload.get("vehicle_type", VehicleCategory.REGULAR))

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
