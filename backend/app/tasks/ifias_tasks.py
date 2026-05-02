"""
IFIAS Tasks — Intelligent Freight Invoice Automation System
Kavya Transports — Accountant Workflow Automation

Pipeline Flow (STRICT — RULE 4: never stop batch):
  Excel Upload
  ↓
  parse_invoice_excel   → dedup LRs → sort by SL NO
  ↓ per LR:
  search_and_extract_slip
    → Outlook IMAP search
    → OneDrive fallback
    → RULE 5: validate PDF contains SAME LR number
    → OCR (pdfplumber → Tesseract fallback)
    → PART 4: validate truck_type + detention_days
    → DB update
  ↓
  Frontend Review (accountant confirms / edits)
  ↓
  Export Excel (CONFIRMED rows only)

This module is the public entry point. All Celery tasks live in pipeline_tasks.py
and are re-exported here for clean imports by the API layer.

Usage:
    from app.tasks.ifias_tasks import (
        process_invoice_excel,
        search_and_extract_slip,
        reprocess_single_lr,
        send_review_notification,
        trigger_batch,
    )
"""

# Re-export all pipeline tasks for clean imports
from app.tasks.pipeline_tasks import (
    process_invoice_excel,
    search_and_extract_slip,
    reprocess_single_lr,
    send_review_notification,
    ONEDRIVE_WATCH_PATH,
    _find_lr_pdf_in_onedrive,
    _update_progress,
)

import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Convenience: trigger a batch from a file path (manual / API call)
# ---------------------------------------------------------------------------

def trigger_batch(file_path: str, triggered_by: str = "manual") -> dict:
    """
    High-level entry point: validate the file exists, then dispatch the
    Celery pipeline task.

    Args:
        file_path: Absolute path to the billing Excel file.
        triggered_by: "manual" | "file_watcher" | "api"

    Returns:
        dict with task_id and initial status.

    Raises:
        FileNotFoundError: if the Excel file doesn't exist.
        ValueError: if the file extension is not .xlsx / .xls
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Excel file not found: {file_path}")
    if path.suffix.lower() not in (".xlsx", ".xls"):
        raise ValueError(f"Expected .xlsx or .xls, got: {path.suffix}")

    logger.info(f"[ifias] trigger_batch: {file_path} | by={triggered_by}")
    task = process_invoice_excel.delay(file_path=str(file_path), triggered_by=triggered_by)
    return {
        "task_id": task.id,
        "status": "QUEUED",
        "file": path.name,
        "triggered_by": triggered_by,
    }


# ---------------------------------------------------------------------------
# Convenience: quick single-LR test (for accountant testing / debugging)
# ---------------------------------------------------------------------------

def test_single_lr(lr_number: str, batch_id: int, pdf_path: Optional[str] = None) -> dict:
    """
    Manually trigger extraction for a single LR number.
    Optionally provide a known PDF path to skip the email search.

    Useful for accountant testing: "does this LR work end-to-end?"
    """
    excel_row_data = {
        "lr_number": lr_number,
        "truck_number": None,
        "sat_slip_no": None,
    }
    if pdf_path and os.path.exists(pdf_path):
        # Inject a pre-known PDF directly into the task via Redis/state bypass
        # The task will fall through email search and OneDrive to use the provided path
        logger.info(f"[ifias] test_single_lr: using provided PDF: {pdf_path}")
        os.environ.setdefault("IFIAS_TEST_PDF", pdf_path)

    task = search_and_extract_slip.delay(
        lr_number=lr_number,
        batch_id=batch_id,
        excel_row_data=excel_row_data,
    )
    return {
        "task_id": task.id,
        "lr_number": lr_number,
        "batch_id": batch_id,
        "status": "QUEUED",
    }


__all__ = [
    "process_invoice_excel",
    "search_and_extract_slip",
    "reprocess_single_lr",
    "send_review_notification",
    "trigger_batch",
    "test_single_lr",
    "ONEDRIVE_WATCH_PATH",
]
