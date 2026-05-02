"""
IFIAS Pipeline Tasks — Thin Celery Wrapper
All processing logic lives in IfiasProcessor.
This file only handles:
  - Celery task registration
  - DB batch status bookkeeping (PENDING → PROCESSING → COMPLETED / FAILED)
"""

import logging
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

from sqlalchemy import update

from app.celery_app import celery_app
from app.db.postgres.connection import SyncSessionLocal
from app.models.postgres.ifias import ProcessingBatch

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

log_dir = Path(__file__).resolve().parents[3] / "logs"
log_dir.mkdir(exist_ok=True)

_fh = RotatingFileHandler(
    log_dir / "pipeline.log", maxBytes=10 * 1024 * 1024, backupCount=5
)
_fh.setFormatter(
    logging.Formatter("[%(asctime)s] [%(levelname)s] [pipeline] %(message)s")
)
logger = logging.getLogger("pipeline")
logger.setLevel(logging.INFO)
logger.addHandler(_fh)

# ---------------------------------------------------------------------------
# Constants — re-exported for backward compat
# ---------------------------------------------------------------------------

ONEDRIVE_WATCH_PATH = os.getenv(
    "ONEDRIVE_WATCH_PATH",
    os.path.join(os.path.expanduser("~"), "OneDrive"),
)


# ---------------------------------------------------------------------------
# Main IFIAS batch task
# ---------------------------------------------------------------------------

@celery_app.task(
    bind=True,
    name="ifias.run_batch",
    max_retries=0,
)
def run_ifias_batch(
    self,
    excel_path: str,
    batch_id: int,
    triggered_by: str = "api",
) -> dict:
    """
    Main IFIAS Celery task.

    Steps:
      1. Mark ProcessingBatch → PROCESSING
      2. Call IfiasProcessor.run(excel_path, batch_id)
      3. Mark ProcessingBatch → COMPLETED with counts + output paths
      4. On any error → mark FAILED with error_message
    """
    from app.services.ifias_processor import IfiasProcessor

    db = SyncSessionLocal()
    try:
        # Mark PROCESSING
        db.execute(
            update(ProcessingBatch)
            .where(ProcessingBatch.id == batch_id)
            .values(status="PROCESSING", updated_at=datetime.utcnow())
        )
        db.commit()
        logger.info(f"[batch:{batch_id}] PROCESSING | file={excel_path}")

        # Run full pipeline
        processor = IfiasProcessor()
        result = processor.run(excel_path=excel_path, batch_id=batch_id)

        # Mark COMPLETED
        db.execute(
            update(ProcessingBatch)
            .where(ProcessingBatch.id == batch_id)
            .values(
                status="COMPLETED",
                total_lrs=result.total,
                processed_lrs=result.successful + result.errors,
                approved_lrs=result.successful,
                review_lrs=result.manual_required,
                completed_at=datetime.utcnow(),
                export_excel_path=result.processed_excel_path,
                updated_at=datetime.utcnow(),
            )
        )
        db.commit()

        logger.info(
            f"[batch:{batch_id}] COMPLETED | "
            f"total={result.total}  ok={result.successful}  "
            f"manual={result.manual_required}  err={result.errors}"
        )
        return {
            "batch_id":        batch_id,
            "status":          "COMPLETED",
            "total":           result.total,
            "successful":      result.successful,
            "manual_required": result.manual_required,
            "errors":          result.errors,
            "processed_excel": result.processed_excel_path,
            "report_json":     result.report_json_path,
            "report_txt":      result.report_txt_path,
        }

    except Exception as exc:
        logger.error(f"[batch:{batch_id}] FAILED: {exc}", exc_info=True)
        db.execute(
            update(ProcessingBatch)
            .where(ProcessingBatch.id == batch_id)
            .values(
                status="FAILED",
                error_message=str(exc),
                updated_at=datetime.utcnow(),
            )
        )
        db.commit()
        raise

    finally:
        db.close()

