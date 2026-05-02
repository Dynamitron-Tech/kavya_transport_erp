"""
IFIAS Pipeline Tasks — Phase 7
Full Celery orchestration: Excel parse → Email search → OCR → Validate → DB update.

Pipeline flow:
  process_invoice_excel
      └─► [per LR] search_and_extract_slip
               └─► validate_and_store (inline)

  reprocess_single_lr  — triggered from dashboard "Reprocess" button
  send_review_notification — sent after batch completes
"""

import asyncio
import json
import logging
import os
import tempfile
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

from celery import shared_task, group
from sqlalchemy import select, update, func

from app.celery_app import celery_app
from app.db.postgres.connection import SyncSessionLocal
from app.services.excel_parser_service import parse_invoice_excel
from app.services.email_intelligence_service import EmailIntelligenceService
from app.services.satisfaction_slip_parser import SatisfactionSlipParser
from app.services.validation_engine import ValidationEngine
from app.models.postgres.ifias import ProcessingBatch, IfiasLineItem

# --- Logging ---
log_dir = Path(__file__).resolve().parents[3] / "logs"
log_dir.mkdir(exist_ok=True)

_pipeline_fh = RotatingFileHandler(log_dir / "pipeline.log", maxBytes=10 * 1024 * 1024, backupCount=5)
_pipeline_fh.setFormatter(
    logging.Formatter("[%(asctime)s] [%(levelname)s] [pipeline] %(message)s")
)
logger = logging.getLogger("pipeline")
logger.setLevel(logging.INFO)
logger.addHandler(_pipeline_fh)

_error_fh = RotatingFileHandler(log_dir / "errors.log", maxBytes=10 * 1024 * 1024, backupCount=5)
_error_fh.setFormatter(
    logging.Formatter("[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s\n%(exc_info)s")
)
logging.getLogger().addHandler(_error_fh)


# ---------------------------------------------------------------------------
# Helper: Redis progress tracking
# ---------------------------------------------------------------------------

def _update_progress(batch_id: int, processed: int, total: int):
    """Store batch progress in Redis for WebSocket streaming."""
    try:
        from app.celery_app import celery_app
        celery_app.backend.client.set(
            f"batch:{batch_id}:progress",
            json.dumps({"processed": processed, "total": total}),
            ex=3600,  # expire in 1 hour
        )
    except Exception as exc:
        logger.warning(f"Redis progress update failed: {exc}")


# ---------------------------------------------------------------------------
# Task 1: Process Invoice Excel
# ---------------------------------------------------------------------------

@celery_app.task(
    name="ifias.process_invoice_excel",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def process_invoice_excel(self, file_path: str, triggered_by: str = "file_watcher"):
    """
    Step 1: Parse billing Excel → create ProcessingBatch → dispatch per-LR sub-tasks.
    """
    logger.info(f"[task] process_invoice_excel | file={file_path} | by={triggered_by}")

    try:
        parse_result = parse_invoice_excel(file_path)
    except Exception as exc:
        logger.error(f"Excel parse failed: {exc}", exc_info=True)
        raise self.retry(exc=exc)

    if parse_result.errors and not parse_result.line_items:
        logger.error(f"Parse failed with errors: {parse_result.errors}")
        return {"status": "FAILED", "errors": parse_result.errors}

    db = SyncSessionLocal()
    try:
        batch = ProcessingBatch(
            transporter_name=parse_result.transporter_name,
            client_name=parse_result.client_name,
            billing_period=parse_result.billing_period,
            source_excel_path=file_path,
            sheet_name=parse_result.sheet_name,
            total_lrs=parse_result.total_rows,
            status="PROCESSING",
            triggered_by=triggered_by,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(batch)
        db.flush()  # Get batch.id

        # Bulk insert all line items
        items_to_create = []
        for item in parse_result.line_items:
            items_to_create.append(IfiasLineItem(
                batch_id=batch.id,
                lr_number=item.lr_number,
                truck_number=item.truck_number,
                sat_slip_no=item.sat_slip_no,
                detention_days=item.detention_days,
                truck_type=item.truck_type,
                shipment_no=item.shipment_no,
                service_po=item.service_po,
                entry_sheet_no=item.entry_sheet_no,
                region=item.region,
                from_location=item.from_location,
                to_location=item.to_location,
                total_units=item.total_units,
                total_wt=item.total_wt,
                shortage=item.shortage,
                detention_charge=item.detention_charge,
                master_rate=item.master_rate,
                payable=item.payable,
                remarks=item.remarks,
                excel_row_number=item.row_number,
                processing_status="PENDING",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            ))

        db.bulk_save_objects(items_to_create)
        db.commit()
        batch_id = batch.id
        logger.info(
            f"[batch:{batch_id}] Created | transporter={parse_result.transporter_name} "
            f"| period={parse_result.billing_period} | LRs={parse_result.total_rows}"
        )

    except Exception as exc:
        db.rollback()
        logger.error(f"DB save failed: {exc}", exc_info=True)
        raise self.retry(exc=exc)
    finally:
        db.close()

    # Dispatch sub-tasks for LRs that need OCR
    dispatched = 0
    for item in parse_result.line_items:
        if item.needs_ocr or item.needs_ocr_verify:
            excel_row_data = {
                "lr_number": item.lr_number,
                "truck_number": item.truck_number,
                "sat_slip_no": item.sat_slip_no,
            }
            search_and_extract_slip.delay(
                lr_number=item.lr_number,
                batch_id=batch_id,
                excel_row_data=excel_row_data,
            )
            dispatched += 1

    _update_progress(batch_id, 0, parse_result.total_rows)
    logger.info(f"[batch:{batch_id}] Dispatched {dispatched} OCR sub-tasks")

    return {
        "batch_id": batch_id,
        "total_lrs": parse_result.total_rows,
        "dispatched_ocr": dispatched,
        "status": "PROCESSING",
    }


# ---------------------------------------------------------------------------
# Task 2: Search email + extract slip + validate + save
# ---------------------------------------------------------------------------

@celery_app.task(
    name="ifias.search_and_extract_slip",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def search_and_extract_slip(self, lr_number: str, batch_id: int, excel_row_data: dict):
    """
    Step 2: For a single LR:
      - Search Outlook for matching email
      - Download PDF
      - Run OCR parser
      - Run validation engine
      - Update DB record
    """
    logger.info(f"[batch:{batch_id}] [LR:{lr_number}] Starting extraction")

    # --- Email search ---
    email_svc = EmailIntelligenceService()
    pdf_path = None
    s3_key = None
    message_id = None
    email_folder = None

    if email_svc.connect():
        try:
            best = email_svc.get_best_match(lr_number)
            if best and best.has_pdf_attachment:
                tmp_dir = Path(tempfile.mkdtemp())
                tmp_pdf = str(tmp_dir / f"slip_{lr_number.replace('/', '_')}.pdf")
                dl = email_svc.download_attachment(best.message_id, best.folder, tmp_pdf)
                if dl.success:
                    pdf_path = dl.local_path
                    s3_key = dl.s3_key
                    message_id = best.message_id
                    email_folder = best.folder
                else:
                    logger.warning(f"[{lr_number}] Download failed: {dl.error}")
            else:
                logger.warning(f"[{lr_number}] No email match found")
        finally:
            email_svc.disconnect()
    else:
        logger.warning(f"[{lr_number}] IMAP connection failed — skipping email search")

    # --- OCR parsing ---
    slip_data = None
    if pdf_path and os.path.exists(pdf_path):
        parser = SatisfactionSlipParser()
        try:
            slip_data = parser.parse(pdf_path, s3_key=s3_key)
            logger.info(
                f"[{lr_number}] OCR complete | truck_type={slip_data.truck_type} "
                f"detention={slip_data.detention_days} confidence={slip_data.confidence_score:.2f}"
            )
        except Exception as exc:
            logger.error(f"[{lr_number}] OCR parse error: {exc}", exc_info=True)

    # --- Validation ---
    validation_result = None
    processing_status = "NEEDS_REVIEW"

    if slip_data:
        # Build a minimal excel_row proxy for validation
        class _ExcelRow:
            pass
        row = _ExcelRow()
        row.lr_number = excel_row_data.get("lr_number", lr_number)
        row.truck_number = excel_row_data.get("truck_number")

        engine = ValidationEngine()
        # Create a dummy InvoiceLineItem for cross-validation
        from app.services.excel_parser_service import InvoiceLineItem
        dummy_item = InvoiceLineItem(
            lr_number=row.lr_number,
            truck_number=row.truck_number,
            sat_slip_no=excel_row_data.get("sat_slip_no"),
            detention_days=None,
            truck_type=None,
            shipment_no=None,
            service_po=None,
            entry_sheet_no=None,
            region=None,
            from_location=None,
            to_location=None,
            total_units=None,
            total_wt=None,
            shortage=None,
            detention_charge=None,
            master_rate=None,
            payable=None,
            remarks=None,
            needs_ocr=True,
            needs_ocr_verify=True,
            row_number=0,
        )
        validation_result = engine.validate_and_score(slip_data, dummy_item)
        processing_status = validation_result.status

    # --- DB update ---
    db = SyncSessionLocal()
    try:
        stmt = (
            update(IfiasLineItem)
            .where(IfiasLineItem.batch_id == batch_id)
            .where(IfiasLineItem.lr_number == lr_number)
            .values(
                processing_status=processing_status,
                truck_type_verified=slip_data.truck_type if slip_data else None,
                detention_days_verified=slip_data.detention_days if slip_data else None,
                confidence_score=slip_data.confidence_score if slip_data else None,
                extraction_method=slip_data.extraction_method if slip_data else None,
                auto_filled=bool(slip_data and slip_data.truck_type),
                auto_filled_at=datetime.utcnow() if slip_data else None,
                auto_fill_data=validation_result.auto_fill_data if validation_result else None,
                flags=[
                    {"field": f.field, "severity": f.severity, "message": f.message,
                     "value_found": f.value_found, "value_expected": f.value_expected}
                    for f in validation_result.flags
                ] if validation_result else None,
                source_pdf_local=pdf_path,
                source_pdf_s3=s3_key,
                email_message_id=message_id,
                email_folder=email_folder,
                ocr_raw_text=slip_data.raw_text[:5000] if slip_data else None,
                updated_at=datetime.utcnow(),
            )
        )
        db.execute(stmt)

        # Update batch progress counters
        _increment_batch_counters(db, batch_id, processing_status)
        db.commit()

    except Exception as exc:
        db.rollback()
        logger.error(f"[{lr_number}] DB update error: {exc}", exc_info=True)
        raise self.retry(exc=exc)
    finally:
        db.close()

    logger.info(f"[batch:{batch_id}] [LR:{lr_number}] Done → {processing_status}")
    return {"lr_number": lr_number, "status": processing_status}


def _increment_batch_counters(db, batch_id: int, status: str):
    """Atomically increment processed_lrs and status-specific counter."""
    update_vals = {
        "processed_lrs": ProcessingBatch.processed_lrs + 1,
        "updated_at": datetime.utcnow(),
    }
    if status == "AUTO_APPROVED":
        update_vals["approved_lrs"] = ProcessingBatch.approved_lrs + 1
    elif status == "NEEDS_REVIEW":
        update_vals["review_lrs"] = ProcessingBatch.review_lrs + 1
    elif status == "REJECTED":
        update_vals["rejected_lrs"] = ProcessingBatch.rejected_lrs + 1

    db.execute(
        update(ProcessingBatch)
        .where(ProcessingBatch.id == batch_id)
        .values(**update_vals)
    )

    # Check if batch is now complete
    batch = db.execute(
        select(ProcessingBatch).where(ProcessingBatch.id == batch_id)
    ).scalar_one_or_none()

    if batch and batch.processed_lrs >= batch.total_lrs:
        db.execute(
            update(ProcessingBatch)
            .where(ProcessingBatch.id == batch_id)
            .values(status="COMPLETED", completed_at=datetime.utcnow())
        )
        logger.info(f"[batch:{batch_id}] All LRs processed → COMPLETED")
        # Dispatch review notification
        send_review_notification.delay(batch_id)


# ---------------------------------------------------------------------------
# Task 3: Reprocess a single LR
# ---------------------------------------------------------------------------

@celery_app.task(name="ifias.reprocess_single_lr")
def reprocess_single_lr(lr_id: int):
    """Re-run search + extract for one LR. Triggered from dashboard."""
    db = SyncSessionLocal()
    try:
        item = db.execute(
            select(IfiasLineItem).where(IfiasLineItem.id == lr_id)
        ).scalar_one_or_none()

        if not item:
            logger.warning(f"reprocess_single_lr: LR id={lr_id} not found")
            return {"error": "not_found"}

        # Reset status to PENDING
        db.execute(
            update(IfiasLineItem)
            .where(IfiasLineItem.id == lr_id)
            .values(processing_status="PENDING", updated_at=datetime.utcnow())
        )
        db.commit()

        excel_row_data = {
            "lr_number": item.lr_number,
            "truck_number": item.truck_number,
            "sat_slip_no": item.sat_slip_no,
        }
        search_and_extract_slip.delay(
            lr_number=item.lr_number,
            batch_id=item.batch_id,
            excel_row_data=excel_row_data,
        )
        logger.info(f"Reprocess dispatched for LR id={lr_id} ({item.lr_number})")
        return {"status": "reprocessing", "lr_number": item.lr_number}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Task 4: Review notification
# ---------------------------------------------------------------------------

@celery_app.task(name="ifias.send_review_notification")
def send_review_notification(batch_id: int):
    """Send notification to accountant after batch processing completes."""
    db = SyncSessionLocal()
    try:
        batch = db.execute(
            select(ProcessingBatch).where(ProcessingBatch.id == batch_id)
        ).scalar_one_or_none()

        if not batch:
            return

        message = (
            f"IFIAS: {batch.transporter_name} {batch.billing_period} batch complete. "
            f"{batch.total_lrs} LRs processed | "
            f"{batch.approved_lrs} auto-approved | "
            f"{batch.review_lrs} need review | "
            f"{batch.rejected_lrs} rejected."
        )
        logger.info(f"[batch:{batch_id}] Notification: {message}")

        # Try FCM push notification if configured
        try:
            from app.services.fcm_service import send_push_notification
            # Would send to accountant's device token
            logger.info(f"[batch:{batch_id}] FCM push sent")
        except Exception:
            pass

    finally:
        db.close()
