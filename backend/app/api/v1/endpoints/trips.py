# Trip Management Endpoints
import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.trip import TripCreate, TripUpdate, TripStatusChange, TripExpenseCreate, TripFuelCreate
from app.services import trip_service
from app.services.notification_service import notification_service
from app.models.postgres.job import Job
from app.models.postgres.vehicle import Vehicle
from app.models.postgres.driver import Driver
from app.models.postgres.lr import LR
from app.models.postgres.route import Route
from app.models.postgres.trip import Trip

logger = logging.getLogger(__name__)

router = APIRouter()


async def _resolve_driver_id(current_user: TokenData, db: AsyncSession) -> Optional[int]:
    """Return the driver.id linked to the current user, or None."""
    result = await db.execute(select(Driver.id).where(Driver.user_id == current_user.user_id))
    row = result.scalar_one_or_none()
    return row


def _is_role(current_user: TokenData, role: str) -> bool:
    return any(r.lower() == role for r in (current_user.roles or []))


@router.get("", response_model=APIResponse)
async def list_trips(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=500),
    search: Optional[str] = None, status: Optional[str] = None,
    vehicle_id: Optional[int] = None, driver_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.TRIP_READ)),
):
    # Role-based data filtering
    if _is_role(current_user, "driver"):
        resolved = await _resolve_driver_id(current_user, db)
        if not resolved:
            return APIResponse(success=True, data=[], pagination=PaginationMeta(page=page, limit=limit, total=0, pages=0))
        driver_id = resolved  # Force to own trips only
    elif _is_role(current_user, "accountant"):
        status = "completed"  # Accountants only see completed trips

    trips, total = await trip_service.list_trips(db, page, limit, search, status, vehicle_id, driver_id)
    pages = (total + limit - 1) // limit
    items = []
    for trip in trips:
        items.append(await trip_service.get_trip_with_details(db, trip))
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/{trip_id}", response_model=APIResponse)
async def get_trip(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.TRIP_READ)),
):
    trip = await trip_service.get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    # Drivers can only see their own trips
    if _is_role(current_user, "driver"):
        resolved = await _resolve_driver_id(current_user, db)
        if trip.driver_id != resolved:
            raise HTTPException(status_code=403, detail="Access denied: not your trip")
    data = await trip_service.get_trip_with_details(db, trip)
    return APIResponse(success=True, data=data)


@router.post("", response_model=APIResponse, status_code=201)
async def create_trip(
    data: TripCreate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_CREATE)),
):
    trip = await trip_service.create_trip(db, data.model_dump(), current_user.user_id)
    route_str = f"{trip.origin or ''} → {trip.destination or ''}"
    adv_fmt = f"₹{float(trip.driver_advance or 0):,.0f}"
    # Fetch driver user_id for targeted notification
    driver_res = await db.execute(select(Driver).where(Driver.id == trip.driver_id))
    driver_obj = driver_res.scalar_one_or_none()
    await notification_service.send(
        db, event_type="TRIP_CREATED",
        title="Trip created",
        body=f"Trip {trip.trip_number} departing {trip.planned_start or 'TBD'}",
        target_roles=["MANAGER"],
        data={"trip_id": str(trip.id)},
        urgency="normal", triggered_by=current_user.user_id,
    )
    await notification_service.send(
        db, event_type="TRIP_DISPATCHED",
        title="New trip dispatched",
        body=f"Trip {trip.trip_number} – {route_str}",
        target_roles=["FLEET_MANAGER"],
        data={"trip_id": str(trip.id)},
        urgency="normal", triggered_by=current_user.user_id,
    )
    if driver_obj and driver_obj.user_id:
        await notification_service.send(
            db, event_type="YOUR_TRIP_READY",
            title="Your trip sheet is ready",
            body=f"Trip {trip.trip_number}: {route_str}. Advance: {adv_fmt}",
            target_user_ids=[driver_obj.user_id],
            data={"trip_id": str(trip.id), "route": f"/driver/trips/{trip.id}"},
            urgency="urgent", triggered_by=current_user.user_id,
        )
    return APIResponse(success=True, data={"id": trip.id, "trip_number": trip.trip_number}, message="Trip created")


@router.put("/{trip_id}", response_model=APIResponse)
async def update_trip(
    trip_id: int, data: TripUpdate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_UPDATE)),
):
    trip = await trip_service.update_trip(db, trip_id, data.model_dump(exclude_unset=True))
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return APIResponse(success=True, message="Trip updated")


@router.delete("/{trip_id}", response_model=APIResponse)
async def delete_trip(
    trip_id: int, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_DELETE)),
):
    success = await trip_service.delete_trip(db, trip_id)
    if not success:
        raise HTTPException(status_code=404, detail="Trip not found")
    return APIResponse(success=True, message="Trip deleted")


@router.patch("/{trip_id}/status", response_model=APIResponse)
async def change_trip_status(
    trip_id: int, data: TripStatusChange, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_UPDATE)),
):
    trip, error = await trip_service.change_trip_status(
        db, trip_id, data.status, current_user.user_id, data.remarks,
        data.odometer_reading, data.latitude, data.longitude, data.location_name,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return APIResponse(success=True, message=f"Trip status changed to {data.status}")


@router.put("/{trip_id}/start", response_model=APIResponse)
async def start_trip(
    trip_id: int,
    background_tasks: BackgroundTasks,
    payload: dict | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_UPDATE)),
):
    from app.services.tms_automation_service import evt_03_notify_driver_dispatch, evt_04_sync_vehicle_status, evt_04_check_vehicle_available

    odometer = payload.get("start_odometer") if isinstance(payload, dict) else None

    # EVT-04 pre-check: block if vehicle is in maintenance
    trip_obj = await db.get(Trip, trip_id)
    if trip_obj and trip_obj.vehicle_id:
        await evt_04_check_vehicle_available(db, trip_obj.vehicle_id)

    trip, error = await trip_service.change_trip_status(
        db, trip_id, "started", current_user.user_id, "Trip started",
        odometer_reading=odometer,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    await notification_service.send(
        db, event_type="TRIP_STARTED",
        title="Trip started",
        body=f"Trip {trip.trip_number} departed",
        target_roles=["MANAGER", "FLEET_MANAGER", "PROJECT_ASSOCIATE"],
        data={"trip_id": str(trip.id)},
        urgency="normal", triggered_by=current_user.user_id,
    )
    # EVT-03: notify driver; EVT-04: set vehicle ON_TRIP
    background_tasks.add_task(evt_03_notify_driver_dispatch, db, trip.id, current_user.user_id)
    if trip.vehicle_id:
        background_tasks.add_task(evt_04_sync_vehicle_status, db, trip.vehicle_id, "started", current_user.user_id)
    return APIResponse(success=True, data={"id": trip.id}, message="Trip started")


@router.put("/{trip_id}/reach", response_model=APIResponse)
async def reach_trip_destination(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_UPDATE)),
):
    trip, error = await trip_service.change_trip_status(
        db,
        trip_id,
        "unloading",
        current_user.user_id,
        "Reached destination",
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return APIResponse(success=True, data={"id": trip.id}, message="Trip marked as reached")


@router.put("/{trip_id}/close", response_model=APIResponse)
async def close_trip(
    trip_id: int,
    background_tasks: BackgroundTasks,
    payload: dict | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_UPDATE)),
):
    from app.services.tms_automation_service import evt_04_sync_vehicle_status

    odometer = None
    if isinstance(payload, dict):
        odometer = payload.get("end_odometer")

    # Capture vehicle_id before status change
    closing_trip = await db.get(Trip, trip_id)
    vehicle_id_to_free = closing_trip.vehicle_id if closing_trip else None

    trip, error = await trip_service.change_trip_status(
        db, trip_id, "completed", current_user.user_id, "Trip closed",
        odometer_reading=odometer,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    freight_fmt = f"₹{float(trip.revenue or 0):,.0f}"
    driver_display = trip.driver_name or "Driver"
    await notification_service.send(
        db, event_type="TRIP_CLOSED",
        title="Trip closed",
        body=f"Trip {trip.trip_number} closed",
        target_roles=["MANAGER", "FLEET_MANAGER"],
        data={"trip_id": str(trip.id)},
        urgency="normal", triggered_by=current_user.user_id,
    )
    await notification_service.send(
        db, event_type="TRIP_COMPLETED_EXPENSES",
        title="Trip Completed – Expenses Pending",
        body=f"Driver:{driver_display} has completed the trip: {trip.trip_number}. Please pay the Expenses",
        target_roles=["FINANCE_MANAGER"],
        data={"trip_id": str(trip.id)},
        urgency="normal", triggered_by=current_user.user_id,
    )
    await notification_service.send(
        db, event_type="INVOICE_DUE",
        title="Invoice due – trip closed",
        body=f"Trip {trip.trip_number} closed. {freight_fmt} invoice pending.",
        target_roles=["ACCOUNTANT"],
        data={"trip_id": str(trip.id), "route": "/accountant/invoices/new"},
        urgency="urgent", triggered_by=current_user.user_id,
    )
    # EVT-04: release vehicle back to AVAILABLE
    if vehicle_id_to_free:
        background_tasks.add_task(evt_04_sync_vehicle_status, db, vehicle_id_to_free, "closed", current_user.user_id)
    return APIResponse(success=True, data={"id": trip.id}, message="Trip closed")


@router.post("/{trip_id}/approve-payment", response_model=APIResponse)
async def approve_trip_payment(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_UPDATE)),
):
    """
    Fleet Manager approves driver payment for a completed trip.
    Creates a Payment record with status=PENDING that appears in Accountant's driver-payments queue.
    """
    from datetime import date, datetime
    from app.models.postgres.finance import Payment, PaymentMethod, PaymentStatus
    from app.models.postgres.trip import TripStatusEnum
    import random, string

    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip.status != TripStatusEnum.COMPLETED:
        raise HTTPException(status_code=400, detail="Can only approve payment for completed trips")
    
    if trip.payment_approved:
        raise HTTPException(status_code=400, detail="Payment already approved for this trip")

    # Set payment_approved flag
    trip.payment_approved = True

    # Create PENDING payment record for accountant queue
    suffix = ''.join(random.choices(string.digits, k=6))
    payment = Payment(
        payment_number=f"TRP-{suffix}",
        payment_date=date.today(),
        payment_type="paid",
        trip_id=trip_id,
        driver_id=trip.driver_id,
        source_ref=f"trip_pay:{trip.trip_number}",
        amount=trip.driver_pay or 0,
        net_amount=trip.driver_pay or 0,
        currency="INR",
        payment_method=PaymentMethod.CASH,
        status=PaymentStatus.PENDING,
        remarks=f"Trip payment for {trip.trip_number} ({trip.origin} → {trip.destination})",
        tenant_id=getattr(trip, 'tenant_id', None),
        created_by=current_user.user_id,
    )
    db.add(payment)
    await db.commit()

    return APIResponse(
        success=True,
        data={"payment_id": payment.id, "payment_number": payment.payment_number, "amount": float(trip.driver_pay or 0)},
        message="Trip payment approved and queued for accountant"
    )


# --- Driver Checklist ---
class ChecklistItemPayload(BaseModel):
    id: str
    label: str
    checked: bool = False
    note: Optional[str] = None
    photo: Optional[str] = None  # base64-encoded image

class ChecklistPayload(BaseModel):
    type: str = "checklist"  # checklist type
    items: list[ChecklistItemPayload] = []
    notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@router.get("/{trip_id}/checklist", response_model=APIResponse)
async def get_trip_checklist(
    trip_id: int,
    type: str = "checklist",  # default type
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.TRIP_READ)),
):
    """Fetch a saved checklist for a trip. Returns null data if not submitted yet."""
    try:
        from app.db.mongodb.connection import MongoDB
        mongo_db = MongoDB.db
        doc = await mongo_db.driver_checklist_logs.find_one(
            {"trip_id": trip_id, "checklist_type": type},
            sort=[("submitted_at", -1)],
        )
    except Exception:
        return APIResponse(success=True, data=None)
    if not doc:
        return APIResponse(success=True, data=None)
    doc.pop("_id", None)
    return APIResponse(success=True, data={
        "trip_id": trip_id,
        "type": type,
        "items": doc.get("items", []),
        "notes": doc.get("notes"),
        "completed_at": doc.get("submitted_at"),
        "ok_count": doc.get("ok_count", 0),
        "total_items": doc.get("total_items", 0),
    })


@router.post("/{trip_id}/checklist", response_model=APIResponse)
async def save_trip_checklist(
    trip_id: int,
    payload: ChecklistPayload,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.TRIP_READ)),
):
    """Save a completed pre-trip or post-trip checklist to MongoDB and mark trip.pod_collected."""
    from datetime import datetime
    from app.db.mongodb.connection import MongoDB
    mongo_db = MongoDB.db

    # Verify trip exists and driver has access
    trip = await trip_service.get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if _is_role(current_user, "driver"):
        resolved = await _resolve_driver_id(current_user, db)
        if trip.driver_id != resolved:
            raise HTTPException(status_code=403, detail="Access denied: not your trip")

    total = len(payload.items)
    ok_count = sum(1 for i in payload.items if i.checked)
    overall_status = "passed" if ok_count == total else "attention_needed"

    doc = {
        "trip_id": trip_id,
        "driver_id": trip.driver_id,
        "vehicle_id": trip.vehicle_id,
        "checklist_type": payload.type,
        "items": [i.model_dump() for i in payload.items],
        "notes": payload.notes or "",
        "total_items": total,
        "ok_count": ok_count,
        "issue_count": total - ok_count,
        "overall_status": overall_status,
        "submitted_at": datetime.utcnow().isoformat(),
        "submitted_by_user_id": current_user.user_id,
        **({"location": {"latitude": payload.latitude, "longitude": payload.longitude}}
           if payload.latitude is not None and payload.longitude is not None else {}),
    }
    # Upsert: update if a checklist already exists (e.g., driver retaking photos),
    # insert if this is the first submission.
    await mongo_db.driver_checklist_logs.replace_one(
        {"trip_id": trip_id, "checklist_type": payload.type},
        doc,
        upsert=True,
    )

    # Notify fleet manager
    try:
        driver_name = trip.driver_name or "Driver"
        await notification_service.send(
            db,
            event_type="DRIVER_CHECKLIST_COMPLETED",
            title="Checklist Completed",
            body=f"{driver_name} has completed the checklist for {trip.trip_number}",
            target_roles=["FLEET_MANAGER"],
            data={"trip_id": trip_id, "trip_number": trip.trip_number},
        )
    except Exception:
        pass

    # Mark pod_collected on the trip when checklist is passed
    if overall_status == "passed":
        try:
            trip.pod_collected = True
            await db.commit()
        except Exception:
            pass  # Non-critical

    return APIResponse(
        success=True,
        data={"ok_count": ok_count, "total": total, "status": overall_status},
        message="Checklist saved successfully.",
    )


# --- Trip Document Photos ---
@router.get("/{trip_id}/trip-documents", response_model=APIResponse)
async def get_trip_document_photos(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.TRIP_READ)),
):
    """Return URLs for LR and E-way files uploaded for this trip."""
    import os, glob as _glob
    from pathlib import Path as _Path

    doc_dir = _Path(__file__).resolve().parents[4] / "uploads" / "trip_documents"
    docs = []
    for pattern, doc_type in [(f"lr_{trip_id}_*", "lr"), (f"eway_{trip_id}_*", "eway")]:
        matches = sorted(_glob.glob(str(doc_dir / pattern)))
        if matches:
            filename = os.path.basename(matches[-1])  # most recent
            docs.append({"type": doc_type, "url": f"/uploads/trip_documents/{filename}"})
    return APIResponse(success=True, data=docs)


@router.get("/{trip_id}/trip-photos", response_model=APIResponse)
async def get_trip_photos(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.TRIP_READ)),
):
    """Return URLs for driver-uploaded trip photos (loaded, reached, unloaded)."""
    import os, glob as _glob
    from pathlib import Path as _Path

    photo_dir = _Path(__file__).resolve().parents[4] / "uploads" / "trip_photos"
    photos = []
    for pattern, photo_type in [
        (f"loaded_{trip_id}_*", "loaded"),
        (f"reached_{trip_id}_*", "reached"),
        (f"unloaded_{trip_id}_*", "unloaded"),
    ]:
        matches = sorted(_glob.glob(str(photo_dir / pattern)))
        for match in matches:
            filename = os.path.basename(match)
            photos.append({"type": photo_type, "url": f"/uploads/trip_photos/{filename}"})
    return APIResponse(success=True, data=photos)


# --- SOS Emergency ---
class SOSPayload(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None


@router.post("/{trip_id}/sos", response_model=APIResponse)
async def trigger_sos(
    trip_id: int,
    payload: SOSPayload = SOSPayload(),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.SOS_TRIGGER)),
):
    """SOS panic button — creates P0 event, records driver event, publishes to event bus."""
    trip = await trip_service.get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Drivers can only trigger SOS for their own trip
    resolved = await _resolve_driver_id(current_user, db)
    if _is_role(current_user, "driver") and trip.driver_id != resolved:
        raise HTTPException(status_code=403, detail="Access denied: not your trip")

    driver_id = resolved or trip.driver_id

    # Fetch full driver details for the notification
    driver_result = await db.execute(select(Driver).where(Driver.id == driver_id))
    driver_obj = driver_result.scalar_one_or_none()
    driver_full_name = f"{driver_obj.first_name} {driver_obj.last_name}" if driver_obj else (trip.driver_name or "Unknown")
    driver_phone = driver_obj.phone if driver_obj else (trip.driver_phone or "N/A")
    emergency_contact_name = driver_obj.emergency_contact_name if driver_obj else None
    emergency_contact_phone = driver_obj.emergency_contact_phone if driver_obj else None

    # Fetch vehicle details
    vehicle_result = await db.execute(select(Vehicle).where(Vehicle.id == trip.vehicle_id))
    vehicle_obj = vehicle_result.scalar_one_or_none()
    vehicle_reg = trip.vehicle_registration or (vehicle_obj.registration_number if vehicle_obj else "N/A")
    vehicle_type = vehicle_obj.vehicle_type.value if vehicle_obj and hasattr(vehicle_obj.vehicle_type, 'value') else (vehicle_obj.vehicle_type if vehicle_obj else "N/A")

    # 1. Create DriverEvent record (SOS, severity 5)
    from app.models.postgres.driver_event import DriverEvent, DriverEventType
    sos_event = DriverEvent(
        driver_id=driver_id,
        trip_id=trip_id,
        vehicle_id=trip.vehicle_id,
        event_type=DriverEventType.SOS,
        severity=5,
        latitude=payload.latitude,
        longitude=payload.longitude,
        location_name=payload.location_name,
        details={"triggered_by_user_id": current_user.user_id},
        tenant_id=getattr(current_user, "tenant_id", None),
        branch_id=getattr(current_user, "branch_id", None),
    )
    db.add(sos_event)
    await db.flush()

    # 2. Audit log
    from app.services.audit_logger import log_audit
    await log_audit(
        db,
        actor_id=current_user.user_id,
        actor_role=(current_user.roles or ["driver"])[0],
        action="sos_triggered",
        entity_type="trip",
        entity_id=str(trip_id),
        new_state={
            "driver_id": driver_id,
            "vehicle_id": trip.vehicle_id,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "location_name": payload.location_name,
        },
    )

    # 3. Publish SOS event to event bus (P0 priority)
    from app.services.event_bus import event_bus, EventTypes
    await event_bus.publish(
        event_type=EventTypes.SOS_TRIGGERED,
        entity_type="trip",
        entity_id=str(trip_id),
        payload={
            "trip_id": trip_id,
            "trip_number": trip.trip_number,
            "driver_id": driver_id,
            "driver_name": driver_full_name,
            "driver_phone": driver_phone,
            "vehicle_id": trip.vehicle_id,
            "vehicle_registration": vehicle_reg,
            "vehicle_type": vehicle_type,
            "origin": trip.origin,
            "destination": trip.destination,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "location_name": payload.location_name,
            "emergency_message": (
                f"🆘 SOS ALERT — IMMEDIATE ATTENTION REQUIRED\n"
                f"Driver: {driver_full_name} ({driver_phone})\n"
                f"Trip: {trip.trip_number} | {trip.origin} → {trip.destination}\n"
                f"Vehicle: {vehicle_reg} ({vehicle_type})\n"
                f"Location: {payload.location_name or 'Unknown'}"
            ),
        },
        persist=True,
        db_session=db,
    )

    # 4. Create in-app notification records for admin and fleet_manager users
    try:
        from app.models.postgres.user import User  # noqa
        admin_users = (await db.execute(
            select(User).where(User.is_active == True)
        )).scalars().all()
        from app.models.postgres.intelligence import NotificationQueue
        from datetime import datetime
        for u in admin_users:
            roles = getattr(u, 'roles', [])
            role_names = [r.name if hasattr(r, 'name') else str(r) for r in roles]
            if any(rn in ('admin', 'fleet_manager', 'manager') for rn in role_names):
                nq = NotificationQueue(
                    event_id=None,  # not linked to event_bus_event yet
                    target_user_id=u.id,
                    channel="in_app",
                    scheduled_for=datetime.utcnow(),
                    status="pending",
                )
                db.add(nq)
    except Exception as e:
        logger.warning(f"SOS in-app notification creation failed (non-critical): {e}")

    await db.commit()

    return APIResponse(
        success=True,
        data={
            "event_id": sos_event.id,
            "trip_id": trip_id,
            "trip_number": trip.trip_number,
            "driver_name": driver_full_name,
            "driver_phone": driver_phone,
            "vehicle_registration": vehicle_reg,
            "origin": trip.origin,
            "destination": trip.destination,
            "emergency_contact_name": emergency_contact_name,
            "emergency_contact_phone": emergency_contact_phone,
        },
        message="🆘 SOS alert sent! Admin and fleet managers have been notified immediately.",
    )


# --- ePOD PDF ---
@router.post("/{trip_id}/epod", response_model=APIResponse)
async def generate_epod_pdf(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.TRIP_READ)),
):
    """Generate and upload ePOD PDF for a trip."""
    from app.services.epod_pdf_service import generate_and_upload_epod
    try:
        result = await generate_and_upload_epod(db, trip_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return APIResponse(success=True, data=result, message="ePOD PDF generated")


@router.get("/{trip_id}/epod/download")
async def download_epod_pdf(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.TRIP_READ)),
):
    """Generate ePOD PDF and return as downloadable file."""
    from fastapi.responses import Response
    from app.services.epod_pdf_service import build_epod_pdf
    try:
        pdf_bytes = await build_epod_pdf(db, trip_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=epod_trip_{trip_id}.pdf"},
    )


# --- Expenses ---
@router.get("/{trip_id}/expenses", response_model=APIResponse)
async def list_expenses(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.EXPENSE_READ)),
):
    # Drivers can only see expenses for their own trips
    if _is_role(current_user, "driver"):
        trip = await trip_service.get_trip(db, trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        resolved = await _resolve_driver_id(current_user, db)
        if trip.driver_id != resolved:
            raise HTTPException(status_code=403, detail="Access denied: not your trip")
    expenses = await trip_service.list_trip_expenses(db, trip_id)
    # Collect paid_by user ids to resolve names
    paid_by_ids = {e.paid_by for e in expenses if e.paid_by}
    paid_by_names: dict[int, str] = {}
    if paid_by_ids:
        from app.models.postgres.user import User
        users_r = await db.execute(select(User).where(User.id.in_(paid_by_ids)))
        for u in users_r.scalars().all():
            paid_by_names[u.id] = f"{u.first_name} {u.last_name or ''}".strip()
    items = []
    for e in expenses:
        row = {c.key: getattr(e, c.key) for c in e.__table__.columns}
        row["paid_by_name"] = paid_by_names.get(e.paid_by) if e.paid_by else None
        items.append(row)
    return APIResponse(success=True, data=items)


@router.post("/{trip_id}/expenses", response_model=APIResponse, status_code=201)
async def add_expense(
    trip_id: int,
    data: TripExpenseCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.EXPENSE_CREATE)),
):
    trip = await trip_service.get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    # Drivers can only add expenses to their own trips
    if _is_role(current_user, "driver"):
        resolved = await _resolve_driver_id(current_user, db)
        if trip.driver_id != resolved:
            raise HTTPException(status_code=403, detail="Access denied: not your trip")
    # Biometric threshold enforcement
    from app.services.config_service import get_config_bulk
    cfg = await get_config_bulk(db, "expense.")
    threshold = cfg.get("expense.biometric_threshold_amount")
    if threshold is not None and data.amount >= threshold and not data.biometric_verified:
        raise HTTPException(
            status_code=400,
            detail=f"Biometric verification required for expenses ≥ ₹{threshold}",
        )
    expense = await trip_service.add_trip_expense(db, trip_id, data.model_dump(), current_user.user_id)
    # Mark driver-submitted expenses so they show as "from Driver App" in the UI
    if _is_role(current_user, "driver"):
        expense.entry_source = "app"
        await db.commit()
    # RUL-03: flag expense anomaly in background (fire-and-forget)
    from decimal import Decimal
    from app.services.tms_automation_service import rul_03_flag_expense_anomaly
    background_tasks.add_task(
        rul_03_flag_expense_anomaly,
        db, expense.id, data.category, Decimal(str(data.amount)), trip.route_id
    )
    return APIResponse(success=True, data={"id": expense.id}, message="Expense added")


@router.post("/expenses/{expense_id}/verify", response_model=APIResponse)
async def verify_expense(
    expense_id: int, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.EXPENSE_VERIFY)),
):
    expense = await trip_service.verify_expense(db, expense_id, current_user.user_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return APIResponse(success=True, message="Expense verified")


@router.post("/expenses/ocr", response_model=APIResponse)
async def ocr_receipt(
    file: UploadFile = File(...),
    current_user: TokenData = Depends(require_permission(Permissions.EXPENSE_CREATE)),
):
    """OCR a receipt image — returns extracted amount, date, vendor, category."""
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")
    image_bytes = await file.read()
    from app.services.ocr_service import extract_receipt_data
    result = await extract_receipt_data(image_bytes)
    return APIResponse(success=True, data=result)


# --- Fuel ---
@router.get("/{trip_id}/fuel", response_model=APIResponse)
async def list_fuel(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.FUEL_READ)),
):
    # Drivers can only see fuel for their own trips
    if _is_role(current_user, "driver"):
        trip = await trip_service.get_trip(db, trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        resolved = await _resolve_driver_id(current_user, db)
        if trip.driver_id != resolved:
            raise HTTPException(status_code=403, detail="Access denied: not your trip")
    entries = await trip_service.list_trip_fuel(db, trip_id)
    items = [{c.key: getattr(f, c.key) for c in f.__table__.columns} for f in entries]
    return APIResponse(success=True, data=items)


@router.post("/{trip_id}/fuel", response_model=APIResponse, status_code=201)
async def add_fuel(
    trip_id: int, data: TripFuelCreate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.FUEL_CREATE)),
):
    # Drivers can only add fuel to their own trips
    if _is_role(current_user, "driver"):
        trip = await trip_service.get_trip(db, trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        resolved = await _resolve_driver_id(current_user, db)
        if trip.driver_id != resolved:
            raise HTTPException(status_code=403, detail="Access denied: not your trip")
    fuel = await trip_service.add_trip_fuel(db, trip_id, data.model_dump())
    if not fuel:
        raise HTTPException(status_code=404, detail="Trip not found")
    return APIResponse(success=True, data={"id": fuel.id}, message="Fuel entry added")


# ── Lookup endpoints ─────────────────────────────────────
@router.get("/next-trip-number", response_model=APIResponse)
async def next_trip_number(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    from app.utils.generators import generate_trip_number
    from sqlalchemy import func
    count_result = await db.execute(select(func.count(Trip.id)))
    seq = (count_result.scalar() or 0) + 1
    return APIResponse(success=True, data={"trip_number": generate_trip_number(seq)})


@router.get("/lookup/jobs", response_model=APIResponse)
async def lookup_jobs(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    query = select(Job.id, Job.job_number, Job.origin_city, Job.destination_city).where(Job.is_deleted == False)
    if search:
        query = query.where(Job.job_number.ilike(f"%{search}%"))
    query = query.order_by(Job.id.desc()).limit(50)
    result = await db.execute(query)
    items = [{"id": r.id, "job_number": r.job_number, "origin_city": r.origin_city, "destination_city": r.destination_city} for r in result.all()]
    return APIResponse(success=True, data=items)


@router.get("/lookup/vehicles", response_model=APIResponse)
async def lookup_vehicles(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    from app.models.postgres.driver import DriverLicense
    query = select(Vehicle.id, Vehicle.registration_number, Vehicle.vehicle_type, Vehicle.default_driver_id).where(Vehicle.is_deleted == False)
    if search:
        query = query.where(Vehicle.registration_number.ilike(f"%{search}%"))
    query = query.order_by(Vehicle.registration_number).limit(50)
    result = await db.execute(query)
    vehicles = result.all()

    items = []
    for v in vehicles:
        driver_info = None

        # Prefer the explicitly assigned default driver
        if v.default_driver_id:
            dr_result = await db.execute(
                select(Driver.id, Driver.first_name, Driver.last_name, Driver.phone)
                .where(Driver.id == v.default_driver_id, Driver.is_deleted == False)
            )
            driver_row = dr_result.first()
        else:
            # Fall back to most recently assigned driver via trips
            driver_row = None
            trip_result = await db.execute(
                select(Driver.id, Driver.first_name, Driver.last_name, Driver.phone)
                .join(Trip, Trip.driver_id == Driver.id)
                .where(Trip.vehicle_id == v.id, Driver.is_deleted == False)
                .order_by(Trip.id.desc())
                .limit(1)
            )
            driver_row = trip_result.first()

        if driver_row:
            lic_result = await db.execute(
                select(DriverLicense)
                .where(DriverLicense.driver_id == driver_row.id)
                .order_by(DriverLicense.id.desc())
                .limit(1)
            )
            lic = lic_result.scalars().first()
            driver_info = {
                "id": driver_row.id,
                "name": f"{driver_row.first_name} {driver_row.last_name or ''}".strip(),
                "phone": driver_row.phone,
                "license_number": lic.license_number if lic else None,
            }

        items.append({
            "id": v.id,
            "registration_number": v.registration_number,
            "vehicle_type": v.vehicle_type,
            "driver": driver_info,
        })
    return APIResponse(success=True, data=items)


@router.get("/lookup/drivers", response_model=APIResponse)
async def lookup_drivers(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    from app.models.postgres.driver import DriverLicense

    query = select(Driver.id, Driver.first_name, Driver.last_name, Driver.phone).where(Driver.is_deleted == False)
    if search:
        query = query.where(Driver.first_name.ilike(f"%{search}%"))
    query = query.order_by(Driver.first_name).limit(50)
    result = await db.execute(query)
    items = []
    for r in result.all():
        lic_result = await db.execute(
            select(DriverLicense)
            .where(DriverLicense.driver_id == r.id)
            .order_by(DriverLicense.id.desc())
        )
        lic = lic_result.scalars().first()
        items.append(
            {
                "id": r.id,
                "name": f"{r.first_name} {r.last_name}".strip(),
                "phone": r.phone,
                "license_number": lic.license_number if lic else None,
                "license_expiry": str(lic.expiry_date) if lic and lic.expiry_date else None,
            }
        )
    return APIResponse(success=True, data=items)


@router.get("/lookup/lrs", response_model=APIResponse)
async def lookup_lrs(
    job_id: Optional[int] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    query = select(LR).where(LR.is_deleted == False)
    if job_id:
        query = query.where(LR.job_id == job_id)
    if search:
        query = query.where(LR.lr_number.ilike(f"%{search}%"))
    query = query.order_by(LR.id.desc()).limit(50)
    result = await db.execute(query)
    items = [{c.key: getattr(lr, c.key) for c in lr.__table__.columns} for lr in result.scalars().all()]
    return APIResponse(success=True, data=items)


@router.get("/lookup/routes", response_model=APIResponse)
async def lookup_routes(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    query = select(Route).limit(50)
    if search:
        query = query.where(Route.name.ilike(f"%{search}%"))
    result = await db.execute(query)
    items = [{c.key: getattr(r, c.key) for c in r.__table__.columns} for r in result.scalars().all()]
    return APIResponse(success=True, data=items)


@router.get("/lookup/trip-types", response_model=APIResponse)
async def lookup_trip_types(current_user: TokenData = Depends(get_current_user)):
    types = [
        {"value": "ftl", "label": "Full Truck Load (FTL)"},
        {"value": "ptl", "label": "Part Truck Load (PTL)"},
        {"value": "express", "label": "Express"},
        {"value": "local", "label": "Local"},
        {"value": "return", "label": "Return Trip"},
    ]
    return APIResponse(success=True, data=types)


@router.get("/lookup/priorities", response_model=APIResponse)
async def lookup_priorities(current_user: TokenData = Depends(get_current_user)):
    priorities = [
        {"value": "low", "label": "Low"},
        {"value": "normal", "label": "Normal"},
        {"value": "high", "label": "High"},
        {"value": "urgent", "label": "Urgent"},
    ]
    return APIResponse(success=True, data=priorities)


@router.get("/{trip_id}/timeline", response_model=APIResponse)
async def get_trip_timeline(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Return the status change history for a trip."""
    from app.models.postgres.trip import TripStatus
    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    result = await db.execute(
        select(TripStatus)
        .where(TripStatus.trip_id == trip_id)
        .order_by(TripStatus.created_at)
    )
    events = result.scalars().all()
    data = [
        {
            "id": e.id,
            "from_status": e.from_status,
            "to_status": e.to_status,
            "changed_by": e.changed_by,
            "latitude": float(e.latitude) if e.latitude else None,
            "longitude": float(e.longitude) if e.longitude else None,
            "location_name": e.location_name,
            "remarks": e.remarks,
            "timestamp": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]
    return APIResponse(success=True, data=data)
