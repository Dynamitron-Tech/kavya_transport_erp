# Portal Service — shared logic for Customer & Supplier portals
# Transport ERP — Phase D

import logging
import secrets
from typing import Optional
from datetime import datetime
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.postgres.client import Client
from app.models.postgres.supplier import Supplier
from app.models.postgres.job import Job
from app.models.postgres.finance import Invoice, Payment
from app.models.postgres.market_trip import MarketTrip
from app.core.security import create_access_token

logger = logging.getLogger(__name__)

# ── Tracking UUID store (in production use Redis with TTL) ─────────
_tracking_tokens: dict[str, dict] = {}


def generate_tracking_token(job_id: int, client_id: int, ttl_hours: int = 48) -> str:
    """Generate a short-lived UUID for public tracking."""
    token = secrets.token_urlsafe(32)
    _tracking_tokens[token] = {
        "job_id": job_id,
        "client_id": client_id,
        "expires_at": datetime.utcnow().timestamp() + (ttl_hours * 3600),
    }
    return token


def validate_tracking_token(token: str) -> Optional[dict]:
    """Validate a tracking token and return job_id if valid."""
    data = _tracking_tokens.get(token)
    if not data:
        return None
    if datetime.utcnow().timestamp() > data["expires_at"]:
        _tracking_tokens.pop(token, None)
        return None
    return data


# ── Customer Portal Auth ───────────────────────────────────────────

async def authenticate_customer(db: AsyncSession, email: str) -> Optional[dict]:
    """Authenticate customer by email. Returns client record + portal token."""
    result = await db.execute(
        select(Client).where(
            and_(
                func.lower(Client.email) == email.strip().lower(),
                Client.is_active == True,
                Client.is_deleted == False,
            )
        )
    )
    client = result.scalar_one_or_none()
    if not client:
        return None

    # Create a portal-scoped access token
    token = create_access_token(
        user_id=client.id,
        email=client.email or "",
        roles=["customer"],
        tenant_id=client.tenant_id,
        branch_id=client.branch_id,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "client": {
            "id": client.id,
            "name": client.name,
            "code": client.code,
            "email": client.email,
            "phone": client.phone,
            "city": client.city,
            "gstin": client.gstin,
            "outstanding_amount": float(client.outstanding_amount or 0),
        },
    }


# ── Supplier Portal Auth ──────────────────────────────────────────

async def authenticate_supplier(db: AsyncSession, email: str) -> Optional[dict]:
    """Authenticate supplier by email. Returns supplier record + portal token."""
    result = await db.execute(
        select(Supplier).where(
            and_(
                func.lower(Supplier.email) == email.strip().lower(),
                Supplier.is_active == True,
                Supplier.is_deleted == False,
            )
        )
    )
    supplier = result.scalar_one_or_none()
    if not supplier:
        return None

    token = create_access_token(
        user_id=supplier.id,
        email=supplier.email or "",
        roles=["supplier"],
        tenant_id=supplier.tenant_id,
        branch_id=supplier.branch_id,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "supplier": {
            "id": supplier.id,
            "name": supplier.name,
            "code": supplier.code,
            "email": supplier.email,
            "phone": supplier.phone,
            "city": supplier.city,
            "supplier_type": supplier.supplier_type.value if hasattr(supplier.supplier_type, "value") else str(supplier.supplier_type),
        },
    }


# ── Customer Bookings (Jobs) ──────────────────────────────────────

async def get_customer_bookings(
    db: AsyncSession,
    client_id: int,
    skip: int = 0,
    limit: int = 20,
) -> dict:
    """List jobs belonging to a customer."""
    base = select(Job).where(
        and_(Job.client_id == client_id, Job.is_deleted == False)
    )
    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar() or 0

    result = await db.execute(
        base.order_by(Job.created_at.desc()).offset(skip).limit(limit)
    )
    jobs = result.scalars().all()

    items = []
    for j in jobs:
        status_val = j.status.value if hasattr(j.status, "value") else str(j.status)
        items.append({
            "id": j.id,
            "job_number": j.job_number,
            "job_date": str(j.job_date) if j.job_date else None,
            "origin": j.origin_city,
            "destination": j.destination_city,
            "material_type": j.material_type,
            "status": status_val,
            "pickup_date": j.pickup_date.isoformat() if j.pickup_date else None,
            "expected_delivery": j.expected_delivery_date.isoformat() if j.expected_delivery_date else None,
            "total_amount": float(j.total_amount or 0),
        })

    return {"items": items, "total": total}


async def create_customer_booking(
    db: AsyncSession,
    client_id: int,
    origin_city: str,
    destination_city: str,
    origin_address: Optional[str] = None,
    destination_address: Optional[str] = None,
    pickup_date: Optional[datetime] = None,
    material_type: Optional[str] = None,
    quantity: Optional[float] = None,
    quantity_unit: Optional[str] = "MT",
    vehicle_type_required: Optional[str] = None,
    special_requirements: Optional[str] = None,
    remarks: Optional[str] = None,
) -> dict:
    """Create a draft job from customer booking request."""
    # Generate job number
    count_result = await db.execute(select(func.count(Job.id)))
    count = (count_result.scalar() or 0) + 1
    job_number = f"JOB-{count:06d}"

    # Get client for tenant/branch
    client_result = await db.execute(select(Client).where(Client.id == client_id))
    client = client_result.scalar_one_or_none()

    job = Job(
        job_number=job_number,
        job_date=datetime.utcnow().date(),
        client_id=client_id,
        origin_city=origin_city,
        origin_address=origin_address or "",
        destination_city=destination_city,
        destination_address=destination_address or "",
        pickup_date=pickup_date,
        material_type=material_type,
        quantity=quantity,
        quantity_unit=quantity_unit or "MT",
        vehicle_type_required=vehicle_type_required,
        special_requirements=special_requirements,
        status="draft",
        tenant_id=client.tenant_id if client else None,
        branch_id=client.branch_id if client else None,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    return {
        "id": job.id,
        "job_number": job.job_number,
        "status": "draft",
        "message": "Booking request submitted. Our team will review and confirm.",
    }


# ── Customer Invoices ─────────────────────────────────────────────

async def get_customer_invoices(
    db: AsyncSession,
    client_id: int,
    skip: int = 0,
    limit: int = 20,
) -> dict:
    """List invoices for a customer."""
    base = select(Invoice).where(Invoice.client_id == client_id)
    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar() or 0

    result = await db.execute(
        base.order_by(Invoice.invoice_date.desc()).offset(skip).limit(limit)
    )
    invoices = result.scalars().all()

    items = []
    for inv in invoices:
        status_val = inv.status.value if hasattr(inv.status, "value") else str(inv.status)
        items.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "invoice_date": str(inv.invoice_date) if inv.invoice_date else None,
            "due_date": str(inv.due_date) if inv.due_date else None,
            "total_amount": float(inv.total_amount or 0),
            "amount_paid": float(inv.amount_paid or 0),
            "amount_due": float(inv.amount_due or 0),
            "status": status_val,
            "pdf_url": inv.pdf_url,
        })

    return {"items": items, "total": total}


async def get_customer_payments(
    db: AsyncSession,
    client_id: int,
    skip: int = 0,
    limit: int = 20,
) -> dict:
    """List payments for a customer."""
    base = select(Payment).where(Payment.client_id == client_id)
    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar() or 0

    result = await db.execute(
        base.order_by(Payment.payment_date.desc()).offset(skip).limit(limit)
    )
    payments = result.scalars().all()

    items = []
    for p in payments:
        status_val = p.status.value if hasattr(p.status, "value") else str(p.status)
        items.append({
            "id": p.id,
            "payment_number": p.payment_number,
            "payment_date": str(p.payment_date) if p.payment_date else None,
            "amount": float(p.amount or 0),
            "payment_method": p.payment_method.value if hasattr(p.payment_method, "value") else str(p.payment_method),
            "status": status_val,
            "transaction_ref": p.transaction_ref,
        })

    return {"items": items, "total": total}


# ── Supplier Trips ────────────────────────────────────────────────

async def get_supplier_trips(
    db: AsyncSession,
    supplier_id: int,
    skip: int = 0,
    limit: int = 20,
) -> dict:
    """List market trips assigned to a supplier."""
    base = select(MarketTrip).where(MarketTrip.supplier_id == supplier_id)
    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar() or 0

    result = await db.execute(
        base.order_by(MarketTrip.created_at.desc()).offset(skip).limit(limit)
    )
    trips = result.scalars().all()

    items = []
    for t in trips:
        status_val = t.status.value if hasattr(t.status, "value") else str(t.status)
        items.append({
            "id": t.id,
            "job_id": t.job_id,
            "vehicle_registration": t.vehicle_registration,
            "driver_name": t.driver_name,
            "driver_phone": t.driver_phone,
            "contractor_rate": float(t.contractor_rate or 0),
            "advance_amount": float(t.advance_amount or 0),
            "net_payable": float(t.net_payable or 0),
            "status": status_val,
            "assigned_at": t.assigned_at.isoformat() if t.assigned_at else None,
            "delivered_at": t.delivered_at.isoformat() if t.delivered_at else None,
            "settled_at": t.settled_at.isoformat() if t.settled_at else None,
        })

    return {"items": items, "total": total}


async def get_supplier_trip_detail(
    db: AsyncSession,
    supplier_id: int,
    trip_id: int,
) -> Optional[dict]:
    """Get detailed market trip info for a supplier."""
    result = await db.execute(
        select(MarketTrip).where(
            and_(MarketTrip.id == trip_id, MarketTrip.supplier_id == supplier_id)
        )
    )
    t = result.scalar_one_or_none()
    if not t:
        return None

    status_val = t.status.value if hasattr(t.status, "value") else str(t.status)

    # Get related job for route info
    job_data = None
    if t.job_id:
        job_result = await db.execute(select(Job).where(Job.id == t.job_id))
        job = job_result.scalar_one_or_none()
        if job:
            job_data = {
                "job_number": job.job_number,
                "origin": job.origin_city,
                "destination": job.destination_city,
                "pickup_date": job.pickup_date.isoformat() if job.pickup_date else None,
                "expected_delivery": job.expected_delivery_date.isoformat() if job.expected_delivery_date else None,
                "material_type": job.material_type,
            }

    return {
        "id": t.id,
        "job_id": t.job_id,
        "job": job_data,
        "vehicle_registration": t.vehicle_registration,
        "driver_name": t.driver_name,
        "driver_phone": t.driver_phone,
        "contractor_rate": float(t.contractor_rate or 0),
        "advance_amount": float(t.advance_amount or 0),
        "loading_charges": float(t.loading_charges or 0),
        "unloading_charges": float(t.unloading_charges or 0),
        "other_charges": float(t.other_charges or 0),
        "tds_rate": float(t.tds_rate or 0),
        "tds_amount": float(t.tds_amount or 0),
        "net_payable": float(t.net_payable or 0),
        "status": status_val,
        "assigned_at": t.assigned_at.isoformat() if t.assigned_at else None,
        "delivered_at": t.delivered_at.isoformat() if t.delivered_at else None,
        "settled_at": t.settled_at.isoformat() if t.settled_at else None,
        "settlement_reference": t.settlement_reference,
        "settlement_remarks": t.settlement_remarks,
    }


async def get_supplier_payments(
    db: AsyncSession,
    supplier_id: int,
    skip: int = 0,
    limit: int = 20,
) -> dict:
    """List payments made to a supplier (vendor payments)."""
    # Supplier payments come from payables — look for payments by vendor_id
    # The Supplier's id maps to vendor payments via the Vendor model or direct
    # For now, gather settled market trips as payment records
    base = select(MarketTrip).where(
        and_(
            MarketTrip.supplier_id == supplier_id,
            MarketTrip.status.in_(["settled", "SETTLED"]),
        )
    )
    result = await db.execute(
        base.order_by(MarketTrip.settled_at.desc()).offset(skip).limit(limit)
    )
    settlements = result.scalars().all()

    items = []
    for s in settlements:
        items.append({
            "id": s.id,
            "trip_id": s.id,
            "job_id": s.job_id,
            "amount": float(s.net_payable or 0),
            "settled_at": s.settled_at.isoformat() if s.settled_at else None,
            "reference": s.settlement_reference,
            "remarks": s.settlement_remarks,
        })

    return {"items": items, "total": len(items)}
