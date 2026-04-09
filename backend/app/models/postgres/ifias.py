"""
IFIAS PostgreSQL Models
ProcessingBatch + IfiasLineItem tables for invoice automation tracking.
"""

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey,
    DateTime, Text, Float, JSON, Index
)
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class ProcessingBatch(Base, TimestampMixin):
    """One per Excel billing file uploaded / detected."""
    __tablename__ = "processing_batches"

    transporter_name = Column(String(100), nullable=False, index=True)
    client_name = Column(String(100), nullable=True)
    billing_period = Column(String(20), nullable=True)          # e.g. "MAR 2026"
    source_excel_path = Column(String(500), nullable=True)
    source_excel_s3 = Column(String(500), nullable=True)
    sheet_name = Column(String(100), nullable=True)

    # Counts
    total_lrs = Column(Integer, default=0)
    processed_lrs = Column(Integer, default=0)
    approved_lrs = Column(Integer, default=0)
    review_lrs = Column(Integer, default=0)
    rejected_lrs = Column(Integer, default=0)
    confirmed_lrs = Column(Integer, default=0)

    # Pipeline state
    status = Column(String(30), default="PENDING")
    # PENDING | PROCESSING | COMPLETED | FAILED | EXPORTED

    triggered_by = Column(String(50), default="file_watcher")
    # "file_watcher" | "manual" | "api"

    completed_at = Column(DateTime, nullable=True)
    exported_at = Column(DateTime, nullable=True)
    export_excel_path = Column(String(500), nullable=True)
    export_excel_s3 = Column(String(500), nullable=True)
    error_message = Column(Text, nullable=True)

    # Relationships
    line_items = relationship("IfiasLineItem", back_populates="batch", lazy="dynamic")


class IfiasLineItem(Base, TimestampMixin):
    """One row per LR number within a processing batch."""
    __tablename__ = "ifias_line_items"

    batch_id = Column(Integer, ForeignKey("processing_batches.id"), nullable=False, index=True)

    # From Excel
    lr_number = Column(String(50), nullable=False, index=True)
    truck_number = Column(String(30), nullable=True)
    sat_slip_no = Column(String(50), nullable=True)
    detention_days = Column(Integer, nullable=True)             # from Excel (may be blank)
    truck_type = Column(String(20), nullable=True)              # usually blank → filled by OCR
    shipment_no = Column(String(50), nullable=True)
    service_po = Column(String(50), nullable=True)
    entry_sheet_no = Column(String(50), nullable=True)
    region = Column(String(30), nullable=True)
    from_location = Column(String(100), nullable=True)
    to_location = Column(String(100), nullable=True)
    total_units = Column(Float, nullable=True)
    total_wt = Column(Float, nullable=True)
    shortage = Column(Float, nullable=True)
    detention_charge = Column(Float, nullable=True)
    master_rate = Column(Float, nullable=True)
    payable = Column(Float, nullable=True)
    remarks = Column(Text, nullable=True)
    excel_row_number = Column(Integer, nullable=True)

    # OCR / auto-fill results
    truck_type_verified = Column(String(20), nullable=True)     # from PDF OCR
    detention_days_verified = Column(Integer, nullable=True)    # from PDF OCR
    sat_slip_no_verified = Column(String(50), nullable=True)
    auto_filled = Column(Boolean, default=False)
    confidence_score = Column(Float, nullable=True)
    extraction_method = Column(String(20), nullable=True)       # pdfplumber | tesseract

    # Processing state
    processing_status = Column(String(20), default="PENDING")
    # PENDING | PROCESSING | AUTO_APPROVED | NEEDS_REVIEW | REJECTED | CONFIRMED

    flags = Column(JSON, nullable=True)                         # List of ValidationFlag dicts
    auto_fill_data = Column(JSON, nullable=True)

    # Source PDF
    source_pdf_local = Column(String(500), nullable=True)
    source_pdf_s3 = Column(String(500), nullable=True)
    email_message_id = Column(String(255), nullable=True)
    email_folder = Column(String(100), nullable=True)

    # OCR raw output (for debugging)
    ocr_raw_text = Column(Text, nullable=True)

    # Human review
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    manual_corrections = Column(JSON, nullable=True)   # dict of field → corrected value
    manually_reviewed = Column(Boolean, default=False)

    # Timestamps
    auto_filled_at = Column(DateTime, nullable=True)
    confirmed_at = Column(DateTime, nullable=True)

    # Relationships
    batch = relationship("ProcessingBatch", back_populates="line_items")

    __table_args__ = (
        Index("ix_ifias_batch_lr", "batch_id", "lr_number"),
    )
