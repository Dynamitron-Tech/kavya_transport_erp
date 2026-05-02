"""Invoice Batches API -- IFIAS

Endpoints:
  POST /invoice-batches/upload          -- upload Excel, create batch, fire Celery task
  GET  /invoice-batches                  -- list batches
  GET  /invoice-batches/{id}             -- batch status / progress
  GET  /invoice-batches/{id}/download/excel   -- download *_processed.xlsx
  GET  /invoice-batches/{id}/download/report  -- download report.json or report.txt
"""

import io
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.db.postgres.connection import get_db
from app.models.postgres.ifias import ProcessingBatch
from app.schemas.base import APIResponse, PaginationMeta

router = APIRouter()
logger = logging.getLogger(__name__)

# Directory where uploaded Excels are stored before processing
UPLOAD_DIR = Path(os.getenv("IFIAS_UPLOAD_DIR", str(Path.home() / "ifias_uploads")))


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

@router.post("/invoice-batches/upload", response_model=APIResponse, status_code=202)
async def upload_excel(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Upload a billing Excel file.
    Saves to disk, quick-parses for metadata, creates ProcessingBatch,
    fires the Celery task, returns batch_id immediately.
    """
    from app.services.excel_parser_service import parse_invoice_excel
    from app.tasks.pipeline_tasks import run_ifias_batch

    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files accepted")

    # Save file
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    save_path = UPLOAD_DIR / f"{ts}_{file.filename}"
    content = await file.read()
    save_path.write_bytes(content)

    # Quick parse for metadata
    try:
        parse_result = parse_invoice_excel(str(save_path))
    except Exception as exc:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"Cannot parse Excel: {exc}")

    # Create DB batch record
    batch = ProcessingBatch(
        transporter_name=parse_result.transporter_name or Path(file.filename).stem,
        client_name=parse_result.client_name or "Unknown",
        billing_period=parse_result.billing_period or "",
        source_excel_path=str(save_path),
        sheet_name=parse_result.sheet_name,
        total_lrs=parse_result.total_rows,
        status="PENDING",
        triggered_by=f"upload:{current_user.username}",
    )
    db.add(batch)
    await db.commit()
    await db.refresh(batch)

    # Fire Celery task
    task = run_ifias_batch.delay(
        excel_path=str(save_path),
        batch_id=batch.id,
        triggered_by=f"upload:{current_user.username}",
    )

    return APIResponse(
        success=True,
        data={
            "batch_id":        batch.id,
            "task_id":         task.id,
            "status":          "PENDING",
            "total_lrs":       parse_result.total_rows,
            "transporter_name": batch.transporter_name,
            "message":         "Processing started. Poll GET /invoice-batches/{batch_id} for progress.",
        },
    )

# ---------------------------------------------------------------------------
# Batches — list + status
# ---------------------------------------------------------------------------

@router.get("/invoice-batches", response_model=APIResponse)
async def list_batches(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """List all processing batches, newest first."""
    query = select(ProcessingBatch)
    if status:
        query = query.where(ProcessingBatch.status == status.upper())
    query = query.order_by(ProcessingBatch.created_at.desc())

    count_q = select(func.count()).select_from(ProcessingBatch)
    if status:
        count_q = count_q.where(ProcessingBatch.status == status.upper())

    total = (await db.execute(count_q)).scalar_one()
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit))
    batches = result.scalars().all()

    return APIResponse(
        success=True,
        data=[_batch_to_dict(b) for b in batches],
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=(total + limit - 1) // limit),
    )


@router.get("/invoice-batches/{batch_id}", response_model=APIResponse)
async def get_batch(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get batch status and progress. Poll this until status == COMPLETED or FAILED."""
    batch = await _get_batch_or_404(db, batch_id)
    return APIResponse(success=True, data=_batch_to_dict(batch))


# ---------------------------------------------------------------------------
# Download — processed Excel
# ---------------------------------------------------------------------------

@router.get("/invoice-batches/{batch_id}/download/excel")
async def download_processed_excel(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Download the *_processed.xlsx file once the batch is COMPLETED."""
    batch = await _get_batch_or_404(db, batch_id)

    if batch.status not in ("COMPLETED", "EXPORTED"):
        raise HTTPException(
            status_code=400,
            detail=f"Batch not ready yet (status={batch.status}). Wait for COMPLETED.",
        )

    if not batch.export_excel_path or not Path(batch.export_excel_path).exists():
        raise HTTPException(status_code=404, detail="Processed Excel file not found on disk")

    content = Path(batch.export_excel_path).read_bytes()
    filename = Path(batch.export_excel_path).name
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Download — report (JSON or TXT)
# ---------------------------------------------------------------------------

@router.get("/invoice-batches/{batch_id}/download/report")
async def download_report(
    batch_id: int,
    fmt: str = Query("json", pattern="^(json|txt)$"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Download the processing report.
    ?fmt=json  →  report.json  (machine-readable)
    ?fmt=txt   →  report.txt   (human-readable, for accountant)
    """
    batch = await _get_batch_or_404(db, batch_id)

    if batch.status not in ("COMPLETED", "EXPORTED"):
        raise HTTPException(
            status_code=400,
            detail=f"Batch not ready yet (status={batch.status}).",
        )

    if not batch.export_excel_path:
        raise HTTPException(status_code=404, detail="No output path recorded for this batch")

    # Report lives alongside the processed Excel: *_report.json / *_report.txt
    excel_path = Path(batch.export_excel_path)
    stem = excel_path.stem.replace("_processed", "")
    report_path = excel_path.parent / f"{stem}_report.{fmt}"

    if not report_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Report file not found: {report_path.name}",
        )

    content   = report_path.read_bytes()
    media_type = "application/json" if fmt == "json" else "text/plain"
    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{report_path.name}"'},
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_batch_or_404(db: AsyncSession, batch_id: int) -> ProcessingBatch:
    result = await db.execute(select(ProcessingBatch).where(ProcessingBatch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


def _batch_to_dict(b: ProcessingBatch) -> dict:
    return {
        "id":               b.id,
        "transporter_name": b.transporter_name,
        "client_name":      b.client_name,
        "billing_period":   b.billing_period,
        "status":           b.status,
        "total_lrs":        b.total_lrs,
        "processed_lrs":    b.processed_lrs,
        "approved_lrs":     b.approved_lrs,
        "review_lrs":       b.review_lrs,
        "triggered_by":     b.triggered_by,
        "source_excel_path": b.source_excel_path,
        "export_excel_path": b.export_excel_path,
        "error_message":    b.error_message,
        "created_at":       b.created_at.isoformat() if b.created_at else None,
        "completed_at":     b.completed_at.isoformat() if b.completed_at else None,
    }


# ---------------------------------------------------------------------------
# Line Items
# ---------------------------------------------------------------------------

@router.get("/invoice-batches/{batch_id}/line-items", response_model=APIResponse)
async def list_line_items(
    batch_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    List line items for a batch.
    In the new architecture these are optional \u2014 the output is in the downloaded Excel.
    """
    from app.models.postgres.ifias import IfiasLineItem

    await _get_batch_or_404(db, batch_id)
    query = (
        select(IfiasLineItem)
        .where(IfiasLineItem.batch_id == batch_id)
        .order_by(IfiasLineItem.excel_row_number)
    )
    count_q = (
        select(func.count())
        .select_from(IfiasLineItem)
        .where(IfiasLineItem.batch_id == batch_id)
    )
    total = (await db.execute(count_q)).scalar_one()
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit))
    items = result.scalars().all()

    return APIResponse(
        success=True,
        data=[
            {
                "id":             i.id,
                "lr_number":      i.lr_number,
                "truck_number":   i.truck_number,
                "excel_row_number": i.excel_row_number,
                "created_at":     i.created_at.isoformat() if i.created_at else None,
            }
            for i in items
        ],
        pagination=PaginationMeta(
            page=page, limit=limit, total=total,
            pages=(total + limit - 1) // limit,
        ),
    )
