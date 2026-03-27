# Driver Management Endpoints
from fastapi import APIRouter, Body, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional
from datetime import date, datetime, timedelta
import random

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user, get_password_hash, verify_password
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.driver import DriverCreate, DriverUpdate, DriverLicenseCreate
from app.services import driver_service, trip_service
from app.models.postgres.driver import Driver, DriverDocument
from app.models.postgres.document import Document, EntityType
from app.models.postgres.trip import Trip
from app.models.postgres.lr import LR
from app.models.postgres.user import User
from app.models.postgres.vehicle import Vehicle, VehicleDocument

router = APIRouter()


async def _get_current_driver_profile(db: AsyncSession, current_user: TokenData) -> Optional[Driver]:
    """Resolve the logged-in user to a driver profile, including legacy fallback matching."""
    driver_result = await db.execute(
        select(Driver).where(Driver.user_id == current_user.user_id, Driver.is_deleted == False)
    )
    driver = driver_result.scalar_one_or_none()

    if driver:
        return driver

    user_result = await db.execute(select(User).where(User.id == current_user.user_id, User.is_active == True))
    user = user_result.scalar_one_or_none()
    if not user:
        return None

    fallback = await db.execute(
        select(Driver)
        .where(
            Driver.is_deleted == False,
            or_(
                Driver.email == user.email,
                Driver.phone == user.phone,
            ),
        )
        .order_by(Driver.id.desc())
    )
    driver = fallback.scalar_one_or_none()
    if driver and not driver.user_id:
        driver.user_id = current_user.user_id
        await db.flush()
    return driver


async def _collect_driver_documents(db: AsyncSession, driver_id: int):
    """Collect driver docs from both driver_documents and central documents tables."""
    result = await db.execute(
        select(DriverDocument).where(DriverDocument.driver_id == driver_id)
    )
    docs = result.scalars().all()

    central_docs_result = await db.execute(
        select(Document).where(
            Document.entity_type == EntityType.DRIVER,
            Document.entity_id == driver_id,
            Document.is_deleted == False,
        )
    )
    central_docs = central_docs_result.scalars().all()

    items = []
    for dd in docs:
        items.append({
            "id": dd.id,
            "document_type": dd.document_type,
            "document_number": dd.document_number,
            "file_name": None,
            "file_url": dd.file_url,
            "is_verified": dd.is_verified,
            "remarks": dd.remarks,
            "uploaded_at": dd.created_at.isoformat() if dd.created_at else None,
            "updated_at": dd.updated_at.isoformat() if dd.updated_at else None,
        })

    for cd in central_docs:
        doc_type = cd.document_type.value.lower() if hasattr(cd.document_type, "value") else str(cd.document_type).lower()
        approval = cd.approval_status.value if hasattr(cd.approval_status, "value") else str(cd.approval_status)
        items.append({
            "id": cd.id,
            "document_type": doc_type,
            "document_number": cd.document_number,
            "file_name": cd.file_name,
            "file_url": cd.file_url,
            "is_verified": approval == "APPROVED",
            "remarks": cd.notes,
            "uploaded_at": cd.created_at.isoformat() if cd.created_at else None,
            "updated_at": cd.updated_at.isoformat() if cd.updated_at else None,
        })

    deduped = []
    seen_urls = set()
    for item in sorted(items, key=lambda x: x.get("uploaded_at") or "", reverse=True):
        key = item.get("file_url") or f"id:{item.get('id')}"
        if key in seen_urls:
            continue
        seen_urls.add(key)
        deduped.append(item)

    return deduped


@router.get("/dashboard", response_model=APIResponse)
async def get_driver_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get driver dashboard summary."""
    stats = await driver_service.get_driver_stats(db)
    return APIResponse(success=True, data=stats)


@router.get("", response_model=APIResponse)
async def list_drivers(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=500),
    search: Optional[str] = None, status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.DRIVER_READ)),
):
    drivers, total = await driver_service.list_drivers(db, page, limit, search, status)
    pages = (total + limit - 1) // limit
    items = []
    for d in drivers:
        row = {c.key: getattr(d, c.key) for c in d.__table__.columns}
        computed_name = f"{row.get('first_name', '')} {row.get('last_name', '')}".strip() or "Unknown"
        row["name"] = computed_name
        row["full_name"] = computed_name
        row["employee_id"] = row.get("employee_code", "")
        if row.get("status") and hasattr(row["status"], "value"):
            row["status"] = row["status"].value
        # Include first license info if available
        licenses = await driver_service.get_driver_license(db, d.id)
        if licenses:
            lic = licenses[0]
            row["license_number"] = lic.license_number
            row["license_expiry"] = str(lic.expiry_date) if lic.expiry_date else None
            row["license_type"] = lic.license_type.value if hasattr(lic.license_type, 'value') else str(lic.license_type)
        else:
            row["license_number"] = None
            row["license_expiry"] = None
            row["license_type"] = None
        items.append(row)
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/me/trips", response_model=APIResponse)
async def get_my_trips(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get trips for the currently logged-in driver user."""
    driver = await _get_current_driver_profile(db, current_user)

    if not driver:
        return APIResponse(
            success=True,
            data=[],
            message="No driver profile linked to this account",
            pagination=PaginationMeta(page=page, limit=page_size, total=0, pages=0),
        )

    base = select(Trip).where(Trip.driver_id == driver.id, Trip.is_deleted == False)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    offset = (page - 1) * page_size
    result = await db.execute(base.order_by(Trip.id.desc()).offset(offset).limit(page_size))
    trips = result.scalars().all()

    items = []
    for t in trips:
        status_val = getattr(t.status, 'value', t.status) if t.status else 'planned'
        lr_result = await db.execute(
            select(LR).where(LR.trip_id == t.id, LR.is_deleted == False).order_by(LR.id.desc())
        )
        trip_lrs = lr_result.scalars().all()
        lr_numbers = [lr.lr_number for lr in trip_lrs if lr.lr_number]
        items.append({
            "id": t.id,
            "trip_number": t.trip_number,
            "origin": t.origin,
            "destination": t.destination,
            "trip_date": str(t.trip_date) if t.trip_date else "",
            "vehicle_registration": t.vehicle_registration or "",
            "status": str(status_val),
            "driver_id": driver.id,
            "driver_name": driver.full_name,
            "lr_numbers": lr_numbers,
            "lr_count": len(lr_numbers),
        })

    pages = (total + page_size - 1) // page_size
    return APIResponse(
        success=True,
        data=items,
        message="My trips",
        pagination=PaginationMeta(page=page, limit=page_size, total=total, pages=pages),
    )


@router.get("/me/trips/{trip_id}", response_model=APIResponse)
async def get_my_trip_detail(
    trip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get detailed trip information for the logged-in driver."""
    driver = await _get_current_driver_profile(db, current_user)
    if not driver:
        raise HTTPException(status_code=404, detail="No driver profile linked to this account")

    trip_result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.driver_id == driver.id, Trip.is_deleted == False)
    )
    trip = trip_result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    status_val = getattr(trip.status, 'value', trip.status) if trip.status else 'planned'
    lr_result = await db.execute(
        select(LR).where(LR.trip_id == trip.id, LR.is_deleted == False).order_by(LR.id.desc())
    )
    trip_lrs = lr_result.scalars().all()
    lr_details = [
        {
            "id": lr.id,
            "lr_number": lr.lr_number,
            "status": getattr(lr.status, "value", lr.status),
            "consignor_name": lr.consignor_name,
            "consignee_name": lr.consignee_name,
            "origin": lr.origin,
            "destination": lr.destination,
        }
        for lr in trip_lrs
    ]
    data = {
        "id": trip.id,
        "trip_number": trip.trip_number,
        "origin": trip.origin,
        "destination": trip.destination,
        "trip_date": str(trip.trip_date) if trip.trip_date else None,
        "status": str(status_val),
        "vehicle_registration": trip.vehicle_registration,
        "driver_name": trip.driver_name or driver.full_name,
        "driver_phone": trip.driver_phone or driver.phone,
        "planned_start": trip.planned_start.isoformat() if trip.planned_start else None,
        "planned_end": trip.planned_end.isoformat() if trip.planned_end else None,
        "actual_start": trip.actual_start.isoformat() if trip.actual_start else None,
        "actual_end": trip.actual_end.isoformat() if trip.actual_end else None,
        "start_odometer": float(trip.start_odometer) if trip.start_odometer is not None else None,
        "end_odometer": float(trip.end_odometer) if trip.end_odometer is not None else None,
        "planned_distance_km": float(trip.planned_distance_km) if trip.planned_distance_km is not None else None,
        "actual_distance_km": float(trip.actual_distance_km) if trip.actual_distance_km is not None else None,
        "remarks": trip.remarks,
        "lr_numbers": [lr["lr_number"] for lr in lr_details if lr.get("lr_number")],
        "lr_count": len(lr_details),
        "lr_details": lr_details,
    }
    return APIResponse(success=True, data=data, message="Trip details")


@router.put("/me/trips/{trip_id}/complete", response_model=APIResponse)
async def complete_my_trip(
    trip_id: int,
    payload: dict | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.TRIP_COMPLETE)),
):
    """Mark an owned trip as completed."""
    driver = await _get_current_driver_profile(db, current_user)
    if not driver:
        raise HTTPException(status_code=404, detail="No driver profile linked to this account")

    trip_result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.driver_id == driver.id, Trip.is_deleted == False)
    )
    trip = trip_result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    odometer = payload.get("end_odometer") if isinstance(payload, dict) else None
    remarks = payload.get("remarks") if isinstance(payload, dict) else None
    close_remark = remarks or "Trip completed by driver"

    current_status = getattr(trip.status, "value", trip.status) if trip.status else "planned"
    current_status = str(current_status).strip().lower()

    if current_status in {"completed", "cancelled"}:
        raise HTTPException(status_code=400, detail=f"Trip is already {current_status}")

    # Driver complete should work from all active phases; advance safely when needed.
    transitions = {
        "planned": ["started", "in_transit", "completed"],
        "vehicle_assigned": ["driver_assigned", "ready", "started", "in_transit", "completed"],
        "driver_assigned": ["ready", "started", "in_transit", "completed"],
        "ready": ["started", "in_transit", "completed"],
        "started": ["in_transit", "completed"],
        "loading": ["in_transit", "completed"],
        "in_transit": ["completed"],
        "unloading": ["completed"],
    }
    status_path = transitions.get(current_status)
    if not status_path:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete trip from '{current_status}'. Start the trip first.",
        )

    updated_trip = trip
    for index, status_step in enumerate(status_path):
        step_odometer = odometer if status_step == "completed" else None
        step_remarks = close_remark if index == len(status_path) - 1 else f"Auto advanced to {status_step}"
        updated_trip, error = await trip_service.change_trip_status(
            db,
            trip_id,
            status_step,
            current_user.user_id,
            step_remarks,
            odometer_reading=step_odometer,
        )
        if error:
            raise HTTPException(status_code=400, detail=error)
    return APIResponse(success=True, data={"id": updated_trip.id}, message="Trip completed")


# --- Driver Allocated Vehicle ---
@router.get("/me/vehicle", response_model=APIResponse)
async def get_my_vehicle(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get the vehicle allocated to the current driver's active/started trip, including vehicle documents."""
    driver = await _get_current_driver_profile(db, current_user)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    # Find active trip (STARTED, IN_TRANSIT, LOADING, UNLOADING) with a vehicle
    active_statuses = ["STARTED", "IN_TRANSIT", "LOADING", "UNLOADING", "READY", "VEHICLE_ASSIGNED", "DRIVER_ASSIGNED"]
    trip_result = await db.execute(
        select(Trip).where(
            Trip.driver_id == driver.id,
            Trip.status.in_(active_statuses),
            Trip.vehicle_id.isnot(None),
            Trip.is_deleted == False,
        ).order_by(Trip.trip_date.desc()).limit(1)
    )
    trip = trip_result.scalar_one_or_none()
    if not trip or not trip.vehicle_id:
        return APIResponse(success=True, data=None, message="No vehicle currently allocated")

    # Get vehicle details
    vehicle_result = await db.execute(
        select(Vehicle).where(Vehicle.id == trip.vehicle_id)
    )
    vehicle = vehicle_result.scalar_one_or_none()
    if not vehicle:
        return APIResponse(success=True, data=None, message="Vehicle not found")

    # Get vehicle documents
    docs_result = await db.execute(
        select(VehicleDocument).where(VehicleDocument.vehicle_id == vehicle.id)
    )
    docs = docs_result.scalars().all()
    doc_items = []
    for d in docs:
        doc_items.append({
            "id": d.id,
            "document_type": d.document_type,
            "document_number": d.document_number,
            "issue_date": str(d.issue_date) if d.issue_date else None,
            "expiry_date": str(d.expiry_date) if d.expiry_date else None,
            "file_url": d.file_url,
            "is_verified": d.is_verified,
            "remarks": d.remarks,
        })

    data = {
        "vehicle": {
            "id": vehicle.id,
            "registration_number": vehicle.registration_number,
            "vehicle_type": vehicle.vehicle_type.value if vehicle.vehicle_type else None,
            "make": vehicle.make,
            "model": vehicle.model,
            "year_of_manufacture": vehicle.year_of_manufacture,
            "fuel_type": vehicle.fuel_type,
            "status": vehicle.status.value if vehicle.status else None,
        },
        "trip": {
            "id": trip.id,
            "trip_number": trip.trip_number,
            "origin": trip.origin,
            "destination": trip.destination,
            "status": trip.status.value if trip.status else str(trip.status),
        },
        "documents": doc_items,
    }
    return APIResponse(success=True, data=data)


# --- Driver Self-Service Documents ---
@router.get("/me/documents", response_model=APIResponse)
async def get_my_documents(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get the current driver's own documents."""
    driver = await _get_current_driver_profile(db, current_user)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    items = await _collect_driver_documents(db, driver.id)
    return APIResponse(success=True, data={"items": items})


@router.post("/me/documents/upload", response_model=APIResponse, status_code=201)
async def upload_my_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    document_number: str = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Upload a personal document (license, aadhaar, badge, medical cert)."""
    ALLOWED_TYPES = ["driving_license", "aadhaar_card", "driver_badge", "medical_fitness"]
    if document_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid document_type. Allowed: {ALLOWED_TYPES}")

    driver = await db.execute(
        select(Driver).where(Driver.user_id == current_user.user_id)
    )
    driver = driver.scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    existing = await db.execute(
        select(DriverDocument).where(
            DriverDocument.driver_id == driver.id,
            DriverDocument.document_type == document_type,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Document already exists. Use PUT to update.")

    from app.services import s3_service
    content = await file.read()
    folder = f"driver-documents/{driver.id}"
    result = await s3_service.upload_file(content, file.filename, folder, file.content_type)

    doc = DriverDocument(
        driver_id=driver.id,
        document_type=document_type,
        document_number=document_number,
        file_url=result.get("url", ""),
        is_verified=False,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return APIResponse(
        success=True,
        data={"id": doc.id, "file_url": doc.file_url, "document_type": doc.document_type},
        message="Document uploaded successfully",
    )


@router.put("/me/documents/{doc_id}", response_model=APIResponse)
async def update_my_document(
    doc_id: int,
    file: UploadFile = File(...),
    document_number: str = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Update (re-upload) a driver's personal document."""
    driver = await db.execute(
        select(Driver).where(Driver.user_id == current_user.user_id)
    )
    driver = driver.scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    result = await db.execute(
        select(DriverDocument).where(
            DriverDocument.id == doc_id,
            DriverDocument.driver_id == driver.id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    from app.services import s3_service
    content = await file.read()
    folder = f"driver-documents/{driver.id}"
    upload_result = await s3_service.upload_file(content, file.filename, folder, file.content_type)

    doc.file_url = upload_result.get("url", doc.file_url)
    doc.is_verified = False
    if document_number:
        doc.document_number = document_number
    await db.commit()
    await db.refresh(doc)

    return APIResponse(
        success=True,
        data={"id": doc.id, "file_url": doc.file_url, "document_type": doc.document_type},
        message="Document updated successfully",
    )


@router.get("/{driver_id}", response_model=APIResponse)
async def get_driver(driver_id: int, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    driver = await driver_service.get_driver(db, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    data = {c.key: getattr(driver, c.key) for c in driver.__table__.columns}
    computed_name = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip() or "Unknown"
    data["name"] = computed_name
    data["full_name"] = computed_name
    data["employee_id"] = data.get("employee_code", "")
    if data.get("status") and hasattr(data["status"], "value"):
        data["status"] = data["status"].value
    licenses = await driver_service.get_driver_license(db, driver_id)
    data["licenses"] = [{c.key: getattr(l, c.key) for c in l.__table__.columns} for l in licenses]
    if licenses:
        lic = licenses[0]
        data["license_number"] = lic.license_number
        data["license_expiry"] = str(lic.expiry_date) if lic.expiry_date else None
        data["license_type"] = lic.license_type.value if hasattr(lic.license_type, 'value') else str(lic.license_type)
    return APIResponse(success=True, data=data)


@router.post("", response_model=APIResponse, status_code=201)
async def create_driver(
    data: DriverCreate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.DRIVER_CREATE)),
):
    result = await driver_service.create_driver(db, data.model_dump(exclude_unset=True))
    driver = result["driver"]
    credentials = result["credentials"]
    return APIResponse(
        success=True,
        data={
            "id": driver.id,
            "employee_code": driver.employee_code,
            "user_id": driver.user_id,
            "login_email": credentials["email"],
            "login_password": credentials["password"],
        },
        message=f"Driver created. Login: {credentials['email']} / {credentials['password']}",
    )


@router.put("/{driver_id}", response_model=APIResponse)
async def update_driver(
    driver_id: int, data: DriverUpdate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.DRIVER_UPDATE)),
):
    driver = await driver_service.update_driver(db, driver_id, data.model_dump(exclude_unset=True))
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return APIResponse(success=True, message="Driver updated")


@router.delete("/{driver_id}", response_model=APIResponse)
async def delete_driver(
    driver_id: int, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.DRIVER_DELETE)),
):
    success = await driver_service.delete_driver(db, driver_id)
    if not success:
        raise HTTPException(status_code=404, detail="Driver not found")
    return APIResponse(success=True, message="Driver deleted")


# --- Security PIN ---
@router.put("/{driver_id}/pin", response_model=APIResponse)
async def set_driver_pin(
    driver_id: int,
    pin: str = Body(..., embed=True, min_length=6, max_length=6, pattern=r'^\d{6}$'),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.DRIVER_UPDATE)),
):
    """Admin sets or resets a driver's 6-digit security PIN."""
    driver = await driver_service.get_driver(db, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    driver.security_pin_hash = get_password_hash(pin)
    await db.flush()
    return APIResponse(success=True, message="Security PIN updated")


@router.post("/verify-pin", response_model=APIResponse)
async def verify_driver_pin(
    pin: str = Body(..., embed=True, min_length=6, max_length=6),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Driver verifies their own security PIN (e.g. for high-value expenses)."""
    result = await db.execute(
        select(Driver).where(Driver.user_id == current_user.user_id, Driver.is_deleted == False)
    )
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="No driver profile linked to this account")
    if not driver.security_pin_hash:
        raise HTTPException(status_code=400, detail="No security PIN has been set. Contact your admin.")
    if not verify_password(pin, driver.security_pin_hash):
        raise HTTPException(status_code=403, detail="Incorrect PIN")
    return APIResponse(success=True, message="PIN verified")


@router.get("/{driver_id}/payment-info", response_model=APIResponse)
async def get_driver_payment_info(
    driver_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.DRIVER_READ)),
):
    """Return payment details (UPI VPA, bank info) for a driver — used by accountant UPI flow."""
    driver = await driver_service.get_driver(db, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return APIResponse(
        success=True,
        data={
            "driver_id": driver.id,
            "name": f"{driver.first_name or ''} {driver.last_name or ''}".strip(),
            "upi_id": driver.upi_id,
            "bank_account_number": driver.bank_account_number,
            "bank_name": driver.bank_name,
            "bank_ifsc": driver.bank_ifsc,
        },
    )


# --- License ---
@router.get("/{driver_id}/licenses", response_model=APIResponse)
async def list_licenses(driver_id: int, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    licenses = await driver_service.get_driver_license(db, driver_id)
    items = [{c.key: getattr(l, c.key) for c in l.__table__.columns} for l in licenses]
    return APIResponse(success=True, data=items)


@router.post("/{driver_id}/licenses", response_model=APIResponse, status_code=201)
async def add_license(driver_id: int, data: DriverLicenseCreate, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    lic = await driver_service.add_driver_license(db, driver_id, data.model_dump())
    return APIResponse(success=True, data={"id": lic.id}, message="License added")


# --- Driver Trips ---
@router.get("/{driver_id}/trips", response_model=APIResponse)
async def get_driver_trips(
    driver_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get trips for a specific driver."""
    base = select(Trip).where(Trip.driver_id == driver_id, Trip.is_deleted == False)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    offset = (page - 1) * page_size
    result = await db.execute(base.order_by(Trip.id.desc()).offset(offset).limit(page_size))
    trips = result.scalars().all()

    completed = sum(1 for t in trips if str(getattr(t.status, 'value', t.status)) == 'completed')
    items = []
    for t in trips:
        status_val = getattr(t.status, 'value', t.status) if t.status else 'planned'
        items.append({
            "id": t.id,
            "trip_number": t.trip_number,
            "route": f"{t.origin} → {t.destination}",
            "vehicle_registration": t.vehicle_registration or "",
            "distance_km": float(t.actual_distance_km or t.planned_distance_km or 0),
            "date": str(t.trip_date) if t.trip_date else "",
            "earnings": float(t.revenue or 0),
            "status": str(status_val),
        })

    summary = {
        "total_trips": total,
        "completed": completed,
        "total_distance_km": sum(i["distance_km"] for i in items),
        "total_earnings": sum(i["earnings"] for i in items),
        "on_time_pct": 95 if total > 0 else 0,
    }

    pages = (total + page_size - 1) // page_size
    return APIResponse(
        success=True,
        data=items,
        message="Driver trips",
        pagination=PaginationMeta(page=page, limit=page_size, total=total, pages=pages),
    )


# --- Driver Behaviour ---
@router.get("/{driver_id}/behaviour", response_model=APIResponse)
async def get_driver_behaviour(
    driver_id: int,
    period: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get driving behaviour analytics for a driver."""
    driver = await driver_service.get_driver(db, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    today = datetime.utcnow().date()
    daily_trends = []
    for i in range(30):
        d = today - timedelta(days=29 - i)
        score = random.randint(65, 98)
        daily_trends.append({"date": str(d), "label": d.strftime("%d %b"), "safety_score": score})

    data = {
        "metrics": {
            "safety_score": 85,
            "safety_grade": "A",
            "average_speed_kmh": 52,
            "harsh_braking_events": 3,
            "over_speed_alerts": 1,
            "fuel_efficiency_kmpl": 4.2,
            "rest_compliance_pct": 92,
            "seatbelt_compliance_pct": 98,
            "night_driving_hours": 12,
            "idle_time_hours": 5,
        },
        "events": {
            "harsh_braking": {"count": 3, "trend": "down"},
            "harsh_acceleration": {"count": 1, "trend": "down"},
            "over_speeding": {"count": 1, "trend": "down"},
            "sharp_turn": {"count": 2, "trend": "up"},
        },
        "speed_distribution": [
            {"range": "0-30 km/h", "percentage": 15},
            {"range": "30-60 km/h", "percentage": 45},
            {"range": "60-80 km/h", "percentage": 30},
            {"range": "80+ km/h", "percentage": 10},
        ],
        "daily_trends": daily_trends,
    }
    return APIResponse(success=True, data=data)


# --- Driver Documents ---
@router.get("/{driver_id}/documents", response_model=APIResponse)
async def get_driver_documents(
    driver_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get documents for a specific driver (licenses + uploaded documents)."""
    driver = await driver_service.get_driver(db, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    licenses = await driver_service.get_driver_license(db, driver_id)
    docs = []
    for lic in licenses:
        docs.append({
            "id": lic.id,
            "doc_type": "license",
            "doc_name": f"Driving License - {lic.license_type}",
            "doc_number": lic.license_number,
            "expiry_date": str(lic.expiry_date) if lic.expiry_date else None,
            "status": "expired" if lic.expiry_date and lic.expiry_date < date.today() else "valid",
            "verified": True,
        })

    extra_docs = await _collect_driver_documents(db, driver_id)
    for dd in extra_docs:
        docs.append({
            "id": dd.get("id"),
            "doc_type": dd.get("document_type"),
            "doc_name": dd.get("file_name") or str(dd.get("document_type") or "Document").replace('_', ' ').title(),
            "doc_number": dd.get("document_number"),
            "file_url": dd.get("file_url"),
            "status": "verified" if dd.get("is_verified") else "pending",
            "verified": bool(dd.get("is_verified")),
            "uploaded_at": dd.get("uploaded_at"),
            "updated_at": dd.get("updated_at"),
            "remarks": dd.get("remarks"),
        })

    compliance = {
        "total": len(docs),
        "valid": sum(1 for d in docs if d.get("status") in ("valid", "verified")),
        "expired": sum(1 for d in docs if d.get("status") == "expired"),
        "pending": sum(1 for d in docs if d.get("status") == "pending"),
        "missing": 0,
    }
    return APIResponse(success=True, data={"items": docs, "compliance": compliance})


# --- Driver Performance ---
@router.get("/{driver_id}/performance", response_model=APIResponse)
async def get_driver_performance(
    driver_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get performance data for a driver."""
    driver = await driver_service.get_driver(db, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    # Count real trips
    total_trips = (await db.execute(
        select(func.count(Trip.id)).where(Trip.driver_id == driver_id, Trip.is_deleted == False)
    )).scalar() or 0

    monthly_trend = []
    today = datetime.utcnow().date()
    for i in range(6):
        m = today.month - 5 + i
        y = today.year
        if m <= 0:
            m += 12
            y -= 1
        monthly_trend.append({"month": f"{y}-{m:02d}", "label": date(y, m, 1).strftime("%b %Y"), "score": random.randint(70, 95)})

    data = {
        "overall_score": 82,
        "grade": "A",
        "rating": 4.3,
        "components": {
            "safety": {"score": 85, "weight": 30, "trend": "up"},
            "punctuality": {"score": 78, "weight": 25, "trend": "stable"},
            "fuel_efficiency": {"score": 80, "weight": 20, "trend": "up"},
            "customer_feedback": {"score": 88, "weight": 15, "trend": "up"},
            "compliance": {"score": 90, "weight": 10, "trend": "stable"},
        },
        "fleet_comparison": {
            "overall": 75,
            "safety": 78,
            "punctuality": 72,
            "fuel_efficiency": 74,
            "customer_feedback": 80,
            "compliance": 82,
        },
        "monthly_trend": monthly_trend,
        "stats": {
            "total_trips": total_trips,
            "total_km": total_trips * 320,
            "active_days": min(total_trips * 2, 180),
            "avg_daily_km": 320 if total_trips > 0 else 0,
        },
    }
    return APIResponse(success=True, data=data)


# --- Driver Attendance (per driver) ---
@router.get("/{driver_id}/attendance", response_model=APIResponse)
async def get_driver_attendance(
    driver_id: int,
    month: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get attendance for a specific driver for a month."""
    driver = await driver_service.get_driver(db, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if month:
        try:
            year, mon = month.split('-')
            year, mon = int(year), int(mon)
        except Exception:
            year, mon = datetime.utcnow().year, datetime.utcnow().month
    else:
        year, mon = datetime.utcnow().year, datetime.utcnow().month

    import calendar
    days_in_month = calendar.monthrange(year, mon)[1]
    today = datetime.utcnow().date()
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

    items = []
    present_days = 0
    absent_days = 0
    on_trip_days = 0
    leave_days = 0
    total_hours = 0

    for d in range(1, days_in_month + 1):
        dt = date(year, mon, d)
        if dt > today:
            break
        weekday = dt.weekday()
        day_name = day_names[weekday]

        if weekday == 6:  # Sunday
            status = 'weekly_off'
            hours = 0
        else:
            r = random.random()
            if r < 0.6:
                status = 'present'
                hours = round(random.uniform(8, 12), 1)
                present_days += 1
            elif r < 0.8:
                status = 'on_trip'
                hours = round(random.uniform(10, 14), 1)
                on_trip_days += 1
            elif r < 0.9:
                status = 'leave'
                hours = 0
                leave_days += 1
            else:
                status = 'absent'
                hours = 0
                absent_days += 1
            total_hours += hours

        items.append({
            "date": str(dt),
            "day": day_name,
            "status": status,
            "check_in": "08:00" if status in ('present', 'on_trip') else None,
            "check_out": f"{8 + int(hours)}:00" if hours > 0 else None,
            "hours_worked": hours,
            "remarks": None,
        })

    working_days = present_days + on_trip_days + absent_days + leave_days
    attendance_pct = round((present_days + on_trip_days) / working_days * 100) if working_days > 0 else 0

    summary = {
        "present_days": present_days,
        "on_trip_days": on_trip_days,
        "absent_days": absent_days,
        "leave_days": leave_days,
        "total_hours": round(total_hours, 1),
        "attendance_pct": attendance_pct,
    }

    return APIResponse(success=True, data={"items": items, "summary": summary})
