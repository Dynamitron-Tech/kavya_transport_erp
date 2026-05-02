"""
IFIAS Report Builder
Generates a summary report (JSON + human-readable TXT) after a processing run.

Usage:
    report = IfiasReportBuilder.build(batch_id=1, excel_path="...", lr_results=[...], started_at=...)
    IfiasReportBuilder.save(report, "report.json", "report.txt")
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class IfiasReportBuilder:
    """Builds and saves the IFIAS processing report."""

    @staticmethod
    def build(
        batch_id: Optional[int],
        excel_path: str,
        lr_results: list,       # List[LRResult] — imported lazily to avoid circular
        started_at: datetime,
    ) -> Dict:
        """
        Build the report dict from the list of LRResult objects.

        Returns a plain dict (JSON-serialisable).
        """
        from app.services.ifias_processor import STATUS_SUCCESS, STATUS_MANUAL, STATUS_ERROR

        total          = len(lr_results)
        successful     = sum(1 for r in lr_results if r.status == STATUS_SUCCESS)
        manual_required = sum(1 for r in lr_results if r.status == STATUS_MANUAL)
        errors         = sum(1 for r in lr_results if r.status == STATUS_ERROR)

        per_lr: Dict[str, dict] = {}
        for r in lr_results:
            entry: Dict = {"status": r.status}
            if r.truck_type:
                entry["truck_type"] = r.truck_type
            if r.detention_days is not None:
                entry["detention_days"] = r.detention_days
            if r.error_detail:
                entry["reason"] = r.error_detail
            if r.from_cache:
                entry["from_cache"] = True
            per_lr[r.lr_number] = entry

        return {
            "batch_id":        batch_id,
            "excel_file":      Path(excel_path).name,
            "generated_at":    datetime.utcnow().isoformat(),
            "started_at":      started_at.isoformat(),
            "total":           total,
            "successful":      successful,
            "manual_required": manual_required,
            "errors":          errors,
            "success_rate_pct": round(successful / total * 100, 1) if total else 0,
            "per_lr":          per_lr,
        }

    @staticmethod
    def save(report: Dict, json_path: str, txt_path: str) -> None:
        """
        Persist the report dict to:
          - report.json  (machine-readable, for API)
          - report.txt   (human-readable, for accountant)
        """
        # --- JSON ---
        Path(json_path).write_text(
            json.dumps(report, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        # --- TXT ---
        lines = [
            "=" * 65,
            "   IFIAS — INVOICE AUTOMATION PROCESSING REPORT",
            "=" * 65,
            f"   File         : {report['excel_file']}",
            f"   Batch ID     : {report['batch_id'] or 'N/A'}",
            f"   Started      : {report['started_at']}",
            f"   Generated    : {report['generated_at']}",
            "-" * 65,
            f"   Total LRs    : {report['total']}",
            f"   Successful   : {report['successful']}",
            f"   Manual Reqd  : {report['manual_required']}",
            f"   Errors       : {report['errors']}",
            f"   Success %    : {report['success_rate_pct']}%",
            "=" * 65,
            "   PER-LR LOG",
            "-" * 65,
        ]

        for lr_no, data in report["per_lr"].items():
            status = data["status"]
            extras = []
            if data.get("truck_type"):
                extras.append(f"truck_type={data['truck_type']}")
            if data.get("detention_days") is not None:
                extras.append(f"detention={data['detention_days']}")
            if data.get("reason"):
                extras.append(f"reason={data['reason']}")
            if data.get("from_cache"):
                extras.append("CACHE")

            suffix = "  |  " + "  |  ".join(extras) if extras else ""
            lines.append(f"   {lr_no:<35} {status}{suffix}")

        lines.append("=" * 65)

        Path(txt_path).write_text("\n".join(lines), encoding="utf-8")
        logger.info(f"[IFIAS] Report saved → {json_path}  |  {txt_path}")
