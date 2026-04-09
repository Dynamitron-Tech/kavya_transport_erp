"""
Validation Engine — IFIAS Phase 4
Validates OCR-extracted Satisfaction Slip data against Excel row data.
Assigns AUTO_APPROVED / NEEDS_REVIEW / REJECTED status per LR.

Usage:
    engine = ValidationEngine()
    result = engine.validate_and_score(slip_data, excel_row)
    print(result.status, result.confidence_score, result.flags)
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional

from app.services.satisfaction_slip_parser import SatisfactionSlipData
from app.services.excel_parser_service import InvoiceLineItem

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ValidationFlag:
    field: str
    severity: Literal["critical", "warning", "info"]
    message: str
    value_found: Optional[str]
    value_expected: Optional[str]


@dataclass
class FieldValidationResult:
    is_valid: bool
    message: str
    severity: Literal["critical", "warning", "info"]


@dataclass
class LineItemValidationResult:
    status: Literal["AUTO_APPROVED", "NEEDS_REVIEW", "REJECTED"]
    confidence_score: float
    truck_type_valid: bool
    detention_days_valid: bool
    lr_match: bool
    truck_no_match: bool
    flags: List[ValidationFlag]
    auto_fill_data: Dict[str, Any]


# ---------------------------------------------------------------------------
# Valid truck type codes (expandable via DB admin panel)
# ---------------------------------------------------------------------------

# Known valid Britannia truck type codes from real data
VALID_TRUCK_TYPES = [
    "Z020", "Z003", "Z069", "Z220", "Z004", "Z007", "Z077", "Z090",
    "CH50", "CH87", "CH69", "CH46",
    # Common Indian freight vehicle codes
    "MXL", "HCV", "LCV", "SXL",
]


# ---------------------------------------------------------------------------
# Validation engine
# ---------------------------------------------------------------------------

class ValidationEngine:
    """
    Validates OCR-extracted data against Excel row expectations.
    Produces AUTO_APPROVED / NEEDS_REVIEW / REJECTED decisions.
    """

    AUTO_APPROVE_THRESHOLD = 0.85
    NEEDS_REVIEW_THRESHOLD = 0.60

    def validate_and_score(
        self,
        slip_data: SatisfactionSlipData,
        excel_row: InvoiceLineItem,
    ) -> LineItemValidationResult:
        """
        Run all validation rules and return a consolidated result.
        """
        flags: List[ValidationFlag] = []
        critical_failures = 0
        warnings = 0

        # --- Critical check 1: Truck type confidence ---
        truck_type_valid = True
        if slip_data.truck_type:
            tt_result = self.validate_truck_type(slip_data.truck_type)
            if not tt_result.is_valid:
                truck_type_valid = False
                critical_failures += 1
                flags.append(ValidationFlag(
                    field="truck_type",
                    severity="critical",
                    message=tt_result.message,
                    value_found=slip_data.truck_type,
                    value_expected=f"One of: {', '.join(VALID_TRUCK_TYPES[:8])}...",
                ))
        elif slip_data.confidence_score < self.NEEDS_REVIEW_THRESHOLD:
            truck_type_valid = False
            critical_failures += 1
            flags.append(ValidationFlag(
                field="truck_type",
                severity="critical",
                message="Truck type not extracted from PDF",
                value_found=None,
                value_expected="Z-series code (e.g. Z220)",
            ))

        # --- Critical check 2: Detention days confidence ---
        detention_valid = True
        if slip_data.detention_days is not None:
            det_result = self.validate_detention_days(slip_data.detention_days)
            if not det_result.is_valid:
                detention_valid = False
                critical_failures += 1
                flags.append(ValidationFlag(
                    field="detention_days",
                    severity=det_result.severity,
                    message=det_result.message,
                    value_found=str(slip_data.detention_days),
                    value_expected="0–30",
                ))
            elif det_result.severity == "warning":
                warnings += 1
                flags.append(ValidationFlag(
                    field="detention_days",
                    severity="warning",
                    message=det_result.message,
                    value_found=str(slip_data.detention_days),
                    value_expected="≤5 typical",
                ))
        else:
            detention_valid = False
            critical_failures += 1
            flags.append(ValidationFlag(
                field="detention_days",
                severity="critical",
                message="Detention days not extracted from PDF",
                value_found=None,
                value_expected="Integer 0–30",
            ))

        # --- Critical check 3: LR number match ---
        lr_match = self.validate_lr_match(
            slip_data.lr_no or "",
            excel_row.lr_number or "",
        )
        if not lr_match:
            critical_failures += 1
            flags.append(ValidationFlag(
                field="lr_no",
                severity="critical",
                message="LR number in PDF does not match Excel row",
                value_found=slip_data.lr_no,
                value_expected=excel_row.lr_number,
            ))

        # --- Critical check 4: Truck number cross-match ---
        truck_no_match = True
        if slip_data.truck_no and excel_row.truck_number:
            pdf_tn = re.sub(r"[\s\-]", "", slip_data.truck_no.upper())
            xls_tn = re.sub(r"[\s\-]", "", str(excel_row.truck_number).upper())
            if pdf_tn != xls_tn:
                truck_no_match = False
                critical_failures += 1
                flags.append(ValidationFlag(
                    field="truck_no",
                    severity="critical",
                    message="Truck number mismatch between PDF and Excel",
                    value_found=slip_data.truck_no,
                    value_expected=excel_row.truck_number,
                ))

        # --- Warning check: Unusual detention ---
        if slip_data.detention_days is not None and slip_data.detention_days > 5:
            warnings += 1
            flags.append(ValidationFlag(
                field="detention_days",
                severity="warning",
                message=f"Detention days ({slip_data.detention_days}) is unusually high — verify manually",
                value_found=str(slip_data.detention_days),
                value_expected="≤5 typical",
            ))

        # --- Warning check: Shortages / damages ---
        if slip_data.shortage_qty and slip_data.shortage_qty > 0:
            warnings += 1
            flags.append(ValidationFlag(
                field="shortage_qty",
                severity="warning",
                message=f"Shortage detected: {slip_data.shortage_qty} units",
                value_found=str(slip_data.shortage_qty),
                value_expected="0",
            ))
        if slip_data.damaged_qty and slip_data.damaged_qty > 0:
            warnings += 1
            flags.append(ValidationFlag(
                field="damaged_qty",
                severity="warning",
                message=f"Damage detected: {slip_data.damaged_qty} units",
                value_found=str(slip_data.damaged_qty),
                value_expected="0",
            ))

        # --- Overall confidence score ---
        confidence = slip_data.confidence_score

        # --- Status assignment ---
        if critical_failures > 0:
            if confidence < self.NEEDS_REVIEW_THRESHOLD:
                status: Literal["AUTO_APPROVED", "NEEDS_REVIEW", "REJECTED"] = "REJECTED"
            else:
                status = "NEEDS_REVIEW"
        elif confidence >= self.AUTO_APPROVE_THRESHOLD and warnings == 0:
            status = "AUTO_APPROVED"
        elif confidence >= self.NEEDS_REVIEW_THRESHOLD:
            status = "NEEDS_REVIEW"
        else:
            status = "REJECTED"

        # --- Build auto_fill_data (only fields safe to auto-fill) ---
        auto_fill_data: Dict[str, Any] = {}
        if truck_type_valid and slip_data.truck_type:
            auto_fill_data["truck_type"] = slip_data.truck_type
        if detention_valid and slip_data.detention_days is not None:
            auto_fill_data["detention_days"] = slip_data.detention_days
        if slip_data.sat_slip_date:
            auto_fill_data["sat_slip_date"] = str(slip_data.sat_slip_date)

        logger.info(
            f"[{excel_row.lr_number}] status={status} confidence={confidence:.2f} "
            f"critical={critical_failures} warnings={warnings}"
        )

        return LineItemValidationResult(
            status=status,
            confidence_score=confidence,
            truck_type_valid=truck_type_valid,
            detention_days_valid=detention_valid,
            lr_match=lr_match,
            truck_no_match=truck_no_match,
            flags=flags,
            auto_fill_data=auto_fill_data,
        )

    def validate_truck_type(self, truck_type: str) -> FieldValidationResult:
        """Validate a truck type code against the known valid list."""
        normalized = truck_type.strip().upper()

        # Check exact match
        if normalized in VALID_TRUCK_TYPES:
            return FieldValidationResult(is_valid=True, message="Valid truck type", severity="info")

        # Check format pattern: letter(s) + 2-4 digits
        if re.match(r"^[A-Z]{1,3}\d{2,4}$", normalized):
            return FieldValidationResult(
                is_valid=True,
                message=f"Truck type {normalized} matches format but not in known list — review",
                severity="warning",
            )

        return FieldValidationResult(
            is_valid=False,
            message=f"Truck type '{truck_type}' is not a valid code",
            severity="critical",
        )

    def validate_detention_days(self, days: int) -> FieldValidationResult:
        """Validate detention days value."""
        if days < 0:
            return FieldValidationResult(
                is_valid=False,
                message=f"Negative detention days ({days}) is invalid",
                severity="critical",
            )
        if days > 30:
            return FieldValidationResult(
                is_valid=False,
                message=f"Detention days ({days}) exceeds maximum (30) — likely OCR error",
                severity="critical",
            )
        if days > 5:
            return FieldValidationResult(
                is_valid=True,
                message=f"Detention days ({days}) is high — verify manually",
                severity="warning",
            )
        return FieldValidationResult(is_valid=True, message="Valid", severity="info")

    def validate_lr_match(self, pdf_lr: str, excel_lr: str) -> bool:
        """
        Normalize and compare LR numbers from PDF and Excel.
        Extracts numeric parts and checks if they overlap.

        'LR-5935/SL-21737' and 'LR-5935/SL-21737' → True
        '4856/72188' and '4856/72188' → True
        """
        if not pdf_lr or not excel_lr:
            return True  # Cannot verify → don't flag

        def numeric_parts(s: str) -> List[str]:
            return re.findall(r"\d{4,}", s)

        pdf_nums = set(numeric_parts(pdf_lr))
        xls_nums = set(numeric_parts(excel_lr))

        if not pdf_nums or not xls_nums:
            return True  # Cannot compare

        # At least one numeric part must match
        return bool(pdf_nums & xls_nums)
