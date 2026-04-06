# Vehicle Management Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from typing import Optional
from datetime import datetime

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.vehicle import VehicleCreate, VehicleUpdate
from app.services import vehicle_service

router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_vehicles(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=500),
    search: Optional[str] = None, status: Optional[str] = None,
    vehicle_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_READ)),
):
    vehicles, total = await vehicle_service.list_vehicles(db, page, limit, search, status, vehicle_type)
    pages = (total + limit - 1) // limit
    items = []
    for v in vehicles:
        d = {c.key: getattr(v, c.key) for c in v.__table__.columns}
        d["expiry_alerts"] = vehicle_service.get_expiry_alerts(v)
        d["gps_enabled"] = bool(v.gps_device_id or v.current_latitude)
        d["total_km_run"] = float(v.odometer_reading or 0)
        items.append(d)
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/summary", response_model=APIResponse)
async def fleet_summary(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    summary = await vehicle_service.get_fleet_summary(db)
    return APIResponse(success=True, data=summary)


@router.get("/expiring", response_model=APIResponse)
async def expiring_vehicles(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    vehicles = await vehicle_service.get_vehicles_expiring_soon(db, days)
    items = []
    for v in vehicles:
        d = {c.key: getattr(v, c.key) for c in v.__table__.columns}
        d["expiry_alerts"] = vehicle_service.get_expiry_alerts(v)
        items.append(d)
    return APIResponse(success=True, data=items)


@router.get("/{vehicle_id}", response_model=APIResponse)
async def get_vehicle(vehicle_id: int, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    vehicle = await vehicle_service.get_vehicle(db, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    d = {c.key: getattr(vehicle, c.key) for c in vehicle.__table__.columns}
    d["expiry_alerts"] = vehicle_service.get_expiry_alerts(vehicle)
    return APIResponse(success=True, data=d)


@router.post("", response_model=APIResponse, status_code=201)
async def create_vehicle(
    data: VehicleCreate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_CREATE)),
):
    try:
        vehicle = await vehicle_service.create_vehicle(db, data.model_dump())
    except IntegrityError as exc:
        msg = str(exc).lower()
        if "registration_number" in msg or "vehicles_registration_number_key" in msg:
            raise HTTPException(status_code=400, detail="Vehicle registration number already exists")
        raise HTTPException(status_code=400, detail="Unable to create vehicle due to conflicting data")
    return APIResponse(success=True, data={"id": vehicle.id, "registration_number": vehicle.registration_number}, message="Vehicle created")


@router.put("/{vehicle_id}", response_model=APIResponse)
async def update_vehicle(
    vehicle_id: int, data: VehicleUpdate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    try:
        vehicle = await vehicle_service.update_vehicle(db, vehicle_id, data.model_dump(exclude_unset=True))
    except IntegrityError as exc:
        msg = str(exc).lower()
        if "registration_number" in msg or "vehicles_registration_number_key" in msg:
            raise HTTPException(status_code=400, detail="Vehicle registration number already exists")
        raise HTTPException(status_code=400, detail="Unable to update vehicle due to conflicting data")
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return APIResponse(success=True, message="Vehicle updated")


@router.delete("/{vehicle_id}", response_model=APIResponse)
async def delete_vehicle(
    vehicle_id: int, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_DELETE)),
):
    success = await vehicle_service.delete_vehicle(db, vehicle_id)
    if not success:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return APIResponse(success=True, message="Vehicle deleted")


# ── Vehicle Document Endpoints ─────────────────────────────────────────────

_ALLOWED_DOC_MIME = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
_MAX_DOC_SIZE = 10 * 1024 * 1024  # 10 MB


def _parse_date(value: Optional[str]):
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            pass
    return None


@router.get("/{vehicle_id}/documents", response_model=APIResponse)
async def get_vehicle_documents(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Return all documents stored for a vehicle."""
    from app.models.postgres.vehicle import VehicleDocument
    result = await db.execute(
        select(VehicleDocument).where(VehicleDocument.vehicle_id == vehicle_id)
    )
    docs = result.scalars().all()
    items = [
        {
            "id": d.id,
            "document_type": d.document_type,
            "document_number": d.document_number,
            "issue_date": str(d.issue_date) if d.issue_date else None,
            "expiry_date": str(d.expiry_date) if d.expiry_date else None,
            "file_url": d.file_url,
            "is_verified": d.is_verified,
            "remarks": d.remarks,
        }
        for d in docs
    ]
    return APIResponse(success=True, data=items)


@router.post("/{vehicle_id}/documents", response_model=APIResponse, status_code=201)
async def upload_vehicle_document(
    vehicle_id: int,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    document_number: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    issue_date: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_UPDATE)),
):
    """Upload or replace a document for a vehicle (rc_book, insurance, pollution_certificate, fitness_certificate)."""
    from app.models.postgres.vehicle import VehicleDocument
    from app.services import s3_service

    vehicle = await vehicle_service.get_vehicle(db, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    if file.content_type not in _ALLOWED_DOC_MIME:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload JPEG, PNG, WEBP, or PDF.")

    content = await file.read()
    if len(content) > _MAX_DOC_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")

    folder = f"documents/vehicle/{vehicle_id}"
    upload_result = await s3_service.upload_file(content, file.filename, folder, file.content_type)

    doc_type = document_type.strip().lower()

    # Upsert: replace existing record of same type if present
    existing_result = await db.execute(
        select(VehicleDocument).where(
            VehicleDocument.vehicle_id == vehicle_id,
            VehicleDocument.document_type == doc_type,
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        existing.file_url = upload_result.get("url", "")
        if document_number:
            existing.document_number = document_number
        parsed_expiry = _parse_date(expiry_date)
        if parsed_expiry:
            existing.expiry_date = parsed_expiry
        parsed_issue = _parse_date(issue_date)
        if parsed_issue:
            existing.issue_date = parsed_issue
        existing.is_verified = False
        doc = existing
    else:
        doc = VehicleDocument(
            vehicle_id=vehicle_id,
            document_type=doc_type,
            document_number=document_number,
            expiry_date=_parse_date(expiry_date),
            issue_date=_parse_date(issue_date),
            file_url=upload_result.get("url", ""),
            is_verified=False,
        )
        db.add(doc)

    await db.commit()
    await db.refresh(doc)

    return APIResponse(
        success=True,
        data={"id": doc.id, "document_type": doc.document_type, "file_url": doc.file_url},
        message=f"{doc_type} uploaded successfully",
    )
