# Document Management Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional
import json
import logging
from datetime import datetime, date as date_type

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse, PaginationMeta
from app.models.postgres.document import Document, EntityType, DocumentType
from app.services import s3_service
from app.services.document_extraction_service import (
    DocumentExtractionService,
    ENTITY_DOCUMENTS,
    DOC_TYPE_TO_ENUM,
    EXPIRY_FIELDS,
    ISSUE_DATE_FIELDS,
    SYSTEM_GENERATED_TYPES,
)
from app.middleware.permissions import require_permission, require_any_permission, Permissions

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/webp",
    "image/heic", "application/pdf",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _parse_ddmmyyyy(value: Optional[str]) -> Optional[date_type]:
    """Parse DD/MM/YYYY string to a Python date. Returns None on failure."""
    if not value:
        return None
    try:
        return datetime.strptime(value.strip(), "%d/%m/%Y").date()
    except (ValueError, AttributeError):
        return None

router = APIRouter()


# ── AI Document Extraction ──────────────────────────────────────────────────

@router.post("/extract", response_model=APIResponse)
async def extract_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    entity_type: str = Form(...),
    current_user: TokenData = Depends(require_permission(Permissions.DOCUMENT_CREATE)),
):
    """
    Upload a document image or PDF and extract structured data using AI.

    Returns extracted JSON data for user review — does NOT save to database.
    Call POST /documents/upload with the reviewed data to persist.
    """
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload JPEG, PNG, WEBP, HEIC, or PDF.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")

    service = DocumentExtractionService()
    result = await service.extract(
        document_type=document_type,
        file_bytes=file_bytes,
        media_type=file.content_type,
    )

    extraction_message = (
        "Extraction complete. Review the fields below before saving."
        if result.get("extracted")
        else result.get("message", "Extraction unavailable. You can continue with manual entry.")
    )

    return APIResponse(
        success=True,
        data={
            **result,
            "entity_type": entity_type,
        },
        message=extraction_message,
    )


@router.get("/requirements", response_model=APIResponse)
async def get_document_requirements(
    entity_type: str = Query(...),
    current_user: TokenData = Depends(require_permission(Permissions.DOCUMENT_READ)),
):
    """
    Returns the required and optional document checklist for an entity type.
    entity_type: vehicle | driver | employee | client
    """
    if entity_type not in ENTITY_DOCUMENTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown entity type: '{entity_type}'. Use: vehicle, driver, employee, client",
        )
    return APIResponse(success=True, data=ENTITY_DOCUMENTS[entity_type])


@router.get("", response_model=APIResponse)
async def list_documents(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=500),
    search: Optional[str] = None, entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.DOCUMENT_READ)),
):
    query = select(Document).where(Document.is_deleted == False)
    count_query = select(func.count(Document.id)).where(Document.is_deleted == False)

    if search:
        sf = or_(Document.title.ilike(f"%{search}%"), Document.document_number.ilike(f"%{search}%"))
        query = query.where(sf)
        count_query = count_query.where(sf)

    if entity_type:
        query = query.where(Document.entity_type == EntityType(entity_type.upper()))
        count_query = count_query.where(Document.entity_type == EntityType(entity_type.upper()))

    if entity_id:
        query = query.where(Document.entity_id == entity_id)
        count_query = count_query.where(Document.entity_id == entity_id)

    total = (await db.execute(count_query)).scalar() or 0
    pages = (total + limit - 1) // limit
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(Document.id.desc()))
    docs = result.scalars().all()

    def _serialize_doc(d):
        row = {}
        for c in d.__table__.columns:
            v = getattr(d, c.key)
            if hasattr(v, 'isoformat'):
                v = v.isoformat()
            elif hasattr(v, 'value'):   # SQLAlchemy Enum
                v = v.value
            elif hasattr(v, '__float__') and not isinstance(v, (int, float, bool)):  # Decimal
                v = float(v)
            row[c.key] = v
        return row

    items = [_serialize_doc(d) for d in docs]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


# ── Lookup endpoints (must be before /{doc_id} to avoid path conflicts) ──
@router.get("/lookup/entities", response_model=APIResponse)
async def lookup_entities(
    entity_type: str = Query("vehicle"),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.DOCUMENT_READ)),
):
    """Lookup entities (vehicles, drivers, trips, clients) for document linking."""
    items = []
    if entity_type == "vehicle":
        from app.models.postgres.vehicle import Vehicle
        q = select(Vehicle.id, Vehicle.registration_number, Vehicle.make, Vehicle.model).where(Vehicle.is_deleted == False)
        if search:
            q = q.where(Vehicle.registration_number.ilike(f"%{search}%"))
        result = await db.execute(q.order_by(Vehicle.registration_number).limit(50))
        items = [{"id": r.id, "name": f"{r.registration_number} ({r.make} {r.model})"} for r in result.all()]
    elif entity_type == "driver":
        from app.models.postgres.driver import Driver
        q = select(Driver.id, Driver.first_name, Driver.last_name, Driver.phone, Driver.employee_code).where(Driver.is_deleted == False)
        if search:
            q = q.where(Driver.first_name.ilike(f"%{search}%"))
        result = await db.execute(q.order_by(Driver.first_name).limit(50))
        items = [{"id": r.id, "name": f"{r.first_name} {r.last_name or ''} ({r.employee_code})".strip()} for r in result.all()]
    elif entity_type == "trip":
        from app.models.postgres.trip import Trip
        q = select(Trip.id, Trip.trip_number, Trip.origin, Trip.destination).where(Trip.is_deleted == False)
        if search:
            q = q.where(Trip.trip_number.ilike(f"%{search}%"))
        result = await db.execute(q.order_by(Trip.id.desc()).limit(50))
        items = [{"id": r.id, "name": f"{r.trip_number} ({r.origin} → {r.destination})"} for r in result.all()]
    elif entity_type == "client":
        from app.models.postgres.client import Client
        q = select(Client.id, Client.name, Client.code).where(Client.is_deleted == False)
        if search:
            q = q.where(Client.name.ilike(f"%{search}%"))
        result = await db.execute(q.order_by(Client.name).limit(50))
        items = [{"id": r.id, "name": f"{r.name} ({r.code})"} for r in result.all()]
    return APIResponse(success=True, data={"items": items})


@router.get("/lookup/compliance-categories", response_model=APIResponse)
async def lookup_compliance_categories(
    current_user: TokenData = Depends(require_permission(Permissions.DOCUMENT_READ)),
):
    categories = [
        {"value": "registration", "label": "Vehicle Registration"},
        {"value": "insurance", "label": "Insurance"},
        {"value": "fitness", "label": "Fitness Certificate"},
        {"value": "pollution", "label": "PUC / Pollution"},
        {"value": "permit", "label": "Permit"},
        {"value": "tax", "label": "Road Tax"},
        {"value": "license", "label": "Driver License"},
        {"value": "other", "label": "Other"},
    ]
    return APIResponse(success=True, data={"items": categories})


@router.get("/{doc_id}", response_model=APIResponse)
async def get_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.DOCUMENT_READ)),
):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return APIResponse(success=True, data={c.key: getattr(doc, c.key) for c in doc.__table__.columns})


@router.post("/upload", response_model=APIResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    entity_type: str = Form("vehicle"),
    entity_id: int = Form(0),
    title: Optional[str] = Form(None),
    document_type: str = Form("other"),
    extracted_data: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.DOCUMENT_CREATE)),
):
    """
    Upload a document file to S3/local storage.

    Pass extracted_data as a JSON string to store AI-extracted fields.
    Expiry alerts are auto-created if the document expires within 30 days.
    """
    from app.utils.generators import generate_number
    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")

    folder = f"documents/{entity_type}"
    upload_result = await s3_service.upload_file(content, file.filename, folder, file.content_type)

    # Parse extracted_data JSON string
    parsed_extracted: Optional[dict] = None
    if extracted_data:
        try:
            parsed_extracted = json.loads(extracted_data)
        except (json.JSONDecodeError, TypeError):
            logger.warning("Invalid extracted_data JSON in upload, ignoring.")

    # Resolve DocumentType enum (support both lowercase API types and existing uppercase values)
    doc_type_key = DOC_TYPE_TO_ENUM.get(document_type.lower(), document_type.upper())
    try:
        resolved_doc_type = DocumentType(doc_type_key)
    except ValueError:
        resolved_doc_type = DocumentType.OTHER

    # Resolve EntityType enum
    try:
        resolved_entity_type = EntityType(entity_type.upper())
    except ValueError:
        resolved_entity_type = EntityType.VEHICLE

    # Extract expiry and issue dates from parsed_extracted if present
    expiry_date: Optional[date_type] = None
    issue_date: Optional[date_type] = None
    if parsed_extracted:
        expiry_field = EXPIRY_FIELDS.get(document_type.lower())
        if expiry_field:
            expiry_date = _parse_ddmmyyyy(parsed_extracted.get(expiry_field))
        issue_field = ISSUE_DATE_FIELDS.get(document_type.lower())
        if issue_field:
            issue_date = _parse_ddmmyyyy(parsed_extracted.get(issue_field))

    doc = Document(
        doc_number=generate_number("DOC", 4),
        title=title or file.filename,
        document_type=resolved_doc_type,
        entity_type=resolved_entity_type,
        entity_id=entity_id,
        file_url=upload_result.get("url", ""),
        file_key=upload_result.get("key", ""),
        file_name=file.filename,
        file_size=len(content),
        file_type=file.content_type,
        uploaded_by=current_user.user_id,
        extracted_data=parsed_extracted,
        issue_date=issue_date,
        expiry_date=expiry_date,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Create expiry compliance alert if document expires within 30 days
    if expiry_date and entity_id:
        try:
            from app.services import compliance_alert_service
            today = date_type.today()
            days_until = (expiry_date - today).days
            if days_until <= 30:
                from app.models.postgres.document import DocumentType as DT
                doc_label = title or document_type.replace("_", " ").title()
                severity = "critical" if days_until <= 7 else "high"
                message = (
                    f"{doc_label} expires in {days_until} days"
                    if days_until >= 0
                    else f"{doc_label} expired {abs(days_until)} days ago"
                )
                vehicle_id = entity_id if entity_type.lower() == "vehicle" else None
                driver_id = entity_id if entity_type.lower() == "driver" else None
                await compliance_alert_service.create_alert(
                    db=db,
                    title=f"Document Expiring: {doc_label}",
                    alert_type="warning",
                    severity=severity,
                    message=message,
                    vehicle_id=vehicle_id,
                    driver_id=driver_id,
                    document_id=doc.id,
                    entity_type=entity_type.lower(),
                    entity_id=entity_id,
                    due_date=datetime.combine(expiry_date, datetime.min.time()),
                )
        except Exception as e:
            logger.warning(f"Could not create expiry alert for document {doc.id}: {e}")

    return APIResponse(
        success=True,
        data={
            "id": doc.id,
            "url": upload_result.get("url"),
            "source": upload_result.get("source"),
            "expiry_date": expiry_date.isoformat() if expiry_date else None,
        },
        message="Document uploaded successfully",
    )


@router.delete("/{doc_id}", response_model=APIResponse)
async def delete_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.DOCUMENT_DELETE)),
):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.is_deleted = True
    await db.commit()
    if doc.file_key:
        await s3_service.delete_file(doc.file_key)
    return APIResponse(success=True, message="Document deleted")
