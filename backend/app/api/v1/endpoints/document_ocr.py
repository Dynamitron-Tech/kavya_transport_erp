# Document OCR Endpoint — Free Tesseract-based OCR for transport documents
# POST /api/v1/documents/ocr
# GET  /api/v1/documents/ocr/supported-types

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from typing import Optional
import logging

from app.core.security import get_current_user, TokenData
from app.schemas.base import APIResponse
from app.services.document_ocr_service import (
    run_ocr,
    detect_doc_type,
    extract_document_fields,
    SUPPORTED_DOC_TYPES,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Allowed MIME types for upload
ALLOWED_OCR_MIMES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "application/pdf",
}

MAX_OCR_FILE_SIZE = 15 * 1024 * 1024  # 15 MB

# Map frontend doc_type values → OCR service doc_type keys
_DOC_TYPE_MAP = {
    "rc": "RC",
    "insurance": "Insurance",
    "driving_license": "DrivingLicense",
    "license": "DrivingLicense",
    "fitness": "Fitness",
    "puc": "PUC",
    "pollution": "PUC",
    "auto": "auto",
    "other": "Other",
}


@router.post("/ocr", response_model=APIResponse)
async def scan_document_ocr(
    file: UploadFile = File(...),
    doc_type: Optional[str] = Query(
        default="auto",
        description="Document type: rc | insurance | driving_license | "
                    "fitness | puc | auto (default). Use 'auto' for automatic detection.",
    ),
    lang: Optional[str] = Query(
        default="eng+hin",
        description="Tesseract language(s) string. Options: eng, hin, tam. "
                    "Combine with '+', e.g. 'eng+hin+tam'.",
    ),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Run OCR on an uploaded document image or PDF.

    - Accepts JPEG, PNG, WEBP, HEIC, PDF (first page).
    - Preprocesses with OpenCV (deskew, denoise, threshold).
    - Runs Tesseract OCR with specified language(s).
    - Auto-detects document type when doc_type='auto'.
    - Returns extracted fields with confidence scores.

    Returns:
        success: true
        data:
          raw_text: full OCR text
          lines: non-empty lines
          fields: { field_name: { value, confidence, raw_match } }
          overall_confidence: 0.0–1.0
          doc_type_detected: RC | Insurance | DrivingLicense | Fitness | PUC | Other
          word_data: list of { text, confidence, bbox }
    """
    # ─── Validate file ────────────────────────────────────────────────────

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_OCR_MIMES:
        # Try inferring from filename extension
        ext = (file.filename or "").rsplit(".", 1)[-1].lower()
        ext_mime_map = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "webp": "image/webp",
            "heic": "image/heic",
            "pdf": "application/pdf",
        }
        content_type = ext_mime_map.get(ext, content_type)
        if content_type not in ALLOWED_OCR_MIMES:
            raise HTTPException(
                status_code=422,
                detail=f"Unsupported file type '{file.content_type}'. "
                       f"Allowed: JPEG, PNG, WEBP, HEIC, PDF.",
            )

    image_bytes = await file.read()

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(image_bytes) > MAX_OCR_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(image_bytes) // 1024}KB). Max 15MB.",
        )

    # ─── Map doc_type to OCR service key ─────────────────────────────────

    raw_dt = (doc_type or "auto").strip().lower()
    ocr_doc_type = _DOC_TYPE_MAP.get(raw_dt, "auto")

    # ─── Sanitise lang string to prevent injection ────────────────────────

    allowed_lang_codes = {"eng", "hin", "tam"}
    parts = [p.strip().lower() for p in (lang or "eng+hin").split("+")]
    safe_parts = [p for p in parts if p in allowed_lang_codes]
    if not safe_parts:
        safe_parts = ["eng"]
    safe_lang = "+".join(safe_parts)

    # ─── Run OCR ──────────────────────────────────────────────────────────

    ocr_result = run_ocr(
        image_bytes=image_bytes,
        mime_type=content_type,
        doc_type=ocr_doc_type,
        lang=safe_lang,
    )

    if ocr_result.error:
        logger.warning(
            "OCR pipeline error for user=%s file=%s: %s",
            current_user.user_id,
            file.filename,
            ocr_result.error,
        )

    # ─── Serialise fields ─────────────────────────────────────────────────

    serialised_fields = {
        key: {
            "value": ef.value,
            "confidence": ef.confidence,
            "raw_match": ef.raw_match,
        }
        for key, ef in ocr_result.extracted_fields.items()
    }

    return APIResponse(
        success=True,
        data={
            "raw_text": ocr_result.raw_text,
            "lines": ocr_result.lines,
            "fields": serialised_fields,
            "overall_confidence": ocr_result.overall_confidence,
            "doc_type_detected": ocr_result.doc_type_detected,
            "word_data": ocr_result.word_data,
            "error": ocr_result.error,
        },
        message=(
            "OCR completed"
            if not ocr_result.error
            else f"OCR completed with warnings: {ocr_result.error}"
        ),
    )


@router.get("/ocr/supported-types", response_model=APIResponse)
async def get_ocr_supported_types(
    current_user: TokenData = Depends(get_current_user),
):
    """
    Return the list of document types supported by the OCR engine
    and the fields that can be extracted for each type.
    """
    doc_type_list = [
        {
            "doc_type": doc_type,
            "label": _OCR_DOC_LABELS.get(doc_type, doc_type),
            "extractable_fields": fields,
        }
        for doc_type, fields in SUPPORTED_DOC_TYPES.items()
    ]
    return APIResponse(
        success=True,
        data={"doc_types": doc_type_list},
        message="Supported OCR document types",
    )


_OCR_DOC_LABELS = {
    "RC": "Registration Certificate (RC)",
    "Insurance": "Insurance Certificate",
    "DrivingLicense": "Driving License",
    "Fitness": "Fitness Certificate",
    "PUC": "Pollution Under Control (PUC)",
    "Other": "Other Document",
}
