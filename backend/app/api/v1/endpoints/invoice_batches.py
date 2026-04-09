"""
Invoice Batches API Endpoints — IFIAS
CRUD for processing batches + line items + export.
"""

import io
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.models.postgres.ifias import ProcessingBatch, IfiasLineItem
from app.schemas.base import APIResponse, PaginationMeta
from app.services.excel_writeback_service import ExcelWritebackService, ConfirmedLineItem

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Batches
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
    batch = await _get_batch_or_404(db, batch_id)
    return APIResponse(success=True, data=_batch_to_dict(batch))


@router.post("/invoice-batches/upload", response_model=APIResponse, status_code=202)
async def upload_excel(
    file_path: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Manually trigger processing of an Excel file (for testing/manual uploads)."""
    from app.tasks.pipeline_tasks import process_invoice_excel
    task = process_invoice_excel.delay(file_path, triggered_by=f"manual:{current_user.username}")
    return APIResponse(success=True, data={"task_id": task.id, "status": "queued"})


# ---------------------------------------------------------------------------
# Line Items
# ---------------------------------------------------------------------------

@router.get("/invoice-batches/{batch_id}/line-items", response_model=APIResponse)
async def list_line_items(
    batch_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """List line items for a batch, with optional status filter."""
    await _get_batch_or_404(db, batch_id)

    query = select(IfiasLineItem).where(IfiasLineItem.batch_id == batch_id)
    count_q = select(func.count()).select_from(IfiasLineItem).where(IfiasLineItem.batch_id == batch_id)

    if status:
        query = query.where(IfiasLineItem.processing_status == status.upper())
        count_q = count_q.where(IfiasLineItem.processing_status == status.upper())

    query = query.order_by(IfiasLineItem.excel_row_number)
    total = (await db.execute(count_q)).scalar_one()
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit))
    items = result.scalars().all()

    return APIResponse(
        success=True,
        data=[_item_to_dict(i) for i in items],
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=(total + limit - 1) // limit),
    )


@router.patch("/invoice-batches/{batch_id}/line-items/{lr_id}", response_model=APIResponse)
async def update_line_item(
    batch_id: int,
    lr_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Update a single line item (manual correction or confirm).
    Accepted body fields: truck_type, detention_days, sat_slip_no, processing_status
    """
    result = await db.execute(
        select(IfiasLineItem)
        .where(IfiasLineItem.id == lr_id)
        .where(IfiasLineItem.batch_id == batch_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Line item not found")

    allowed_fields = {"truck_type", "detention_days", "sat_slip_no", "processing_status", "remarks"}
    corrections = {}
    for field, val in body.items():
        if field in allowed_fields:
            setattr(item, field, val)
            if field not in {"processing_status"}:
                corrections[field] = val

    if corrections:
        item.manually_reviewed = True
        item.reviewed_by = current_user.user_id
        item.reviewed_at = datetime.utcnow()
        existing = item.manual_corrections or {}
        existing.update(corrections)
        item.manual_corrections = existing

    if body.get("processing_status") == "CONFIRMED":
        item.confirmed_at = datetime.utcnow()
        # Update batch confirmed count
        await db.execute(
            update(ProcessingBatch)
            .where(ProcessingBatch.id == batch_id)
            .values(confirmed_lrs=ProcessingBatch.confirmed_lrs + 1)
        )

    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)

    return APIResponse(success=True, data=_item_to_dict(item))


@router.post("/invoice-batches/{batch_id}/confirm-all", response_model=APIResponse)
async def confirm_all_approved(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Bulk-confirm all AUTO_APPROVED items in a batch."""
    await _get_batch_or_404(db, batch_id)

    result = await db.execute(
        update(IfiasLineItem)
        .where(IfiasLineItem.batch_id == batch_id)
        .where(IfiasLineItem.processing_status == "AUTO_APPROVED")
        .values(
            processing_status="CONFIRMED",
            confirmed_at=datetime.utcnow(),
            reviewed_by=current_user.user_id,
            reviewed_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        .returning(IfiasLineItem.id)
    )
    confirmed_ids = result.fetchall()
    count = len(confirmed_ids)

    await db.execute(
        update(ProcessingBatch)
        .where(ProcessingBatch.id == batch_id)
        .values(confirmed_lrs=ProcessingBatch.confirmed_lrs + count)
    )
    await db.commit()

    return APIResponse(success=True, data={"confirmed_count": count})


# ---------------------------------------------------------------------------
# Export (Excel write-back)
# ---------------------------------------------------------------------------

@router.post("/invoice-batches/{batch_id}/export", response_model=APIResponse)
async def export_batch(
    batch_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Write confirmed data back to the original Excel and return as download.
    """
    batch = await _get_batch_or_404(db, batch_id)

    if not batch.source_excel_path:
        raise HTTPException(status_code=400, detail="No source Excel path for this batch")

    # Load all CONFIRMED items
    result = await db.execute(
        select(IfiasLineItem)
        .where(IfiasLineItem.batch_id == batch_id)
        .where(IfiasLineItem.processing_status == "CONFIRMED")
    )
    items = result.scalars().all()

    if not items:
        raise HTTPException(status_code=400, detail="No confirmed items to export")

    confirmed = [
        ConfirmedLineItem(
            lr_number=i.lr_number,
            truck_type=i.truck_type_verified or i.truck_type,
            detention_days=i.detention_days_verified if i.detention_days_verified is not None else i.detention_days,
            sat_slip_no=i.sat_slip_no_verified or i.sat_slip_no,
            manually_corrected=i.manually_reviewed or False,
        )
        for i in items
    ]

    svc = ExcelWritebackService()
    write_result = svc.write_confirmed_data(
        source_excel_path=batch.source_excel_path,
        confirmed_items=confirmed,
    )

    if not write_result.success:
        raise HTTPException(status_code=500, detail=f"Export failed: {write_result.errors}")

    # Update batch record
    await db.execute(
        update(ProcessingBatch)
        .where(ProcessingBatch.id == batch_id)
        .values(
            exported_at=datetime.utcnow(),
            export_excel_path=write_result.output_path,
            status="EXPORTED",
        )
    )
    await db.commit()

    # Stream the file back to the browser
    with open(write_result.output_path, "rb") as f:
        content = f.read()

    filename = f"IFIAS_Export_Batch{batch_id}.xlsx"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/invoice-batches/{batch_id}/reprocess/{lr_id}", response_model=APIResponse)
async def reprocess_lr(
    batch_id: int,
    lr_id: int,
    current_user: TokenData = Depends(get_current_user),
):
    """Trigger re-processing of a single LR from the dashboard."""
    from app.tasks.pipeline_tasks import reprocess_single_lr
    task = reprocess_single_lr.delay(lr_id)
    return APIResponse(success=True, data={"task_id": task.id, "status": "reprocessing"})


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
        "id": b.id,
        "transporter_name": b.transporter_name,
        "client_name": b.client_name,
        "billing_period": b.billing_period,
        "status": b.status,
        "total_lrs": b.total_lrs,
        "processed_lrs": b.processed_lrs,
        "approved_lrs": b.approved_lrs,
        "review_lrs": b.review_lrs,
        "rejected_lrs": b.rejected_lrs,
        "confirmed_lrs": b.confirmed_lrs,
        "triggered_by": b.triggered_by,
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "completed_at": b.completed_at.isoformat() if b.completed_at else None,
        "exported_at": b.exported_at.isoformat() if b.exported_at else None,
        "source_excel_path": b.source_excel_path,
        "error_message": b.error_message,
    }


def _item_to_dict(i: IfiasLineItem) -> dict:
    return {
        "id": i.id,
        "batch_id": i.batch_id,
        "lr_number": i.lr_number,
        "truck_number": i.truck_number,
        "sat_slip_no": i.sat_slip_no,
        "detention_days": i.detention_days,
        "truck_type": i.truck_type,
        "truck_type_verified": i.truck_type_verified,
        "detention_days_verified": i.detention_days_verified,
        "sat_slip_no_verified": i.sat_slip_no_verified,
        "shipment_no": i.shipment_no,
        "region": i.region,
        "from_location": i.from_location,
        "to_location": i.to_location,
        "total_units": i.total_units,
        "total_wt": i.total_wt,
        "shortage": i.shortage,
        "detention_charge": i.detention_charge,
        "master_rate": i.master_rate,
        "payable": i.payable,
        "remarks": i.remarks,
        "processing_status": i.processing_status,
        "confidence_score": i.confidence_score,
        "extraction_method": i.extraction_method,
        "auto_filled": i.auto_filled,
        "manually_reviewed": i.manually_reviewed,
        "flags": i.flags or [],
        "auto_fill_data": i.auto_fill_data or {},
        "source_pdf_s3": i.source_pdf_s3,
        "reviewed_by": i.reviewed_by,
        "reviewed_at": i.reviewed_at.isoformat() if i.reviewed_at else None,
        "confirmed_at": i.confirmed_at.isoformat() if i.confirmed_at else None,
        "excel_row_number": i.excel_row_number,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }
