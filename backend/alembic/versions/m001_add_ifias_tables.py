"""
Alembic migration: m001 — IFIAS tables
Adds processing_batches and ifias_line_items tables for invoice automation.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "m001_ifias_tables"
down_revision = "l001_gps_providers"
branch_labels = None
depends_on = None


def upgrade():
    # --- processing_batches ---
    op.create_table(
        "processing_batches",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("transporter_name", sa.String(100), nullable=False),
        sa.Column("client_name", sa.String(100), nullable=True),
        sa.Column("billing_period", sa.String(20), nullable=True),
        sa.Column("source_excel_path", sa.String(500), nullable=True),
        sa.Column("source_excel_s3", sa.String(500), nullable=True),
        sa.Column("sheet_name", sa.String(100), nullable=True),
        sa.Column("total_lrs", sa.Integer(), server_default="0"),
        sa.Column("processed_lrs", sa.Integer(), server_default="0"),
        sa.Column("approved_lrs", sa.Integer(), server_default="0"),
        sa.Column("review_lrs", sa.Integer(), server_default="0"),
        sa.Column("rejected_lrs", sa.Integer(), server_default="0"),
        sa.Column("confirmed_lrs", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(30), server_default="PENDING"),
        sa.Column("triggered_by", sa.String(50), server_default="file_watcher"),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("exported_at", sa.DateTime(), nullable=True),
        sa.Column("export_excel_path", sa.String(500), nullable=True),
        sa.Column("export_excel_s3", sa.String(500), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_processing_batches_transporter", "processing_batches", ["transporter_name"])

    # --- ifias_line_items ---
    op.create_table(
        "ifias_line_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("processing_batches.id"), nullable=False),
        sa.Column("lr_number", sa.String(50), nullable=False),
        sa.Column("truck_number", sa.String(30), nullable=True),
        sa.Column("sat_slip_no", sa.String(50), nullable=True),
        sa.Column("detention_days", sa.Integer(), nullable=True),
        sa.Column("truck_type", sa.String(20), nullable=True),
        sa.Column("shipment_no", sa.String(50), nullable=True),
        sa.Column("service_po", sa.String(50), nullable=True),
        sa.Column("entry_sheet_no", sa.String(50), nullable=True),
        sa.Column("region", sa.String(30), nullable=True),
        sa.Column("from_location", sa.String(100), nullable=True),
        sa.Column("to_location", sa.String(100), nullable=True),
        sa.Column("total_units", sa.Float(), nullable=True),
        sa.Column("total_wt", sa.Float(), nullable=True),
        sa.Column("shortage", sa.Float(), nullable=True),
        sa.Column("detention_charge", sa.Float(), nullable=True),
        sa.Column("master_rate", sa.Float(), nullable=True),
        sa.Column("payable", sa.Float(), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("excel_row_number", sa.Integer(), nullable=True),
        # OCR / auto-fill
        sa.Column("truck_type_verified", sa.String(20), nullable=True),
        sa.Column("detention_days_verified", sa.Integer(), nullable=True),
        sa.Column("sat_slip_no_verified", sa.String(50), nullable=True),
        sa.Column("auto_filled", sa.Boolean(), server_default="false"),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("extraction_method", sa.String(20), nullable=True),
        # Processing state
        sa.Column("processing_status", sa.String(20), server_default="PENDING"),
        sa.Column("flags", postgresql.JSONB(), nullable=True),
        sa.Column("auto_fill_data", postgresql.JSONB(), nullable=True),
        # Source PDF
        sa.Column("source_pdf_local", sa.String(500), nullable=True),
        sa.Column("source_pdf_s3", sa.String(500), nullable=True),
        sa.Column("email_message_id", sa.String(255), nullable=True),
        sa.Column("email_folder", sa.String(100), nullable=True),
        sa.Column("ocr_raw_text", sa.Text(), nullable=True),
        # Human review
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("manual_corrections", postgresql.JSONB(), nullable=True),
        sa.Column("manually_reviewed", sa.Boolean(), server_default="false"),
        sa.Column("auto_filled_at", sa.DateTime(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_ifias_line_items_batch_id", "ifias_line_items", ["batch_id"])
    op.create_index("ix_ifias_line_items_lr_number", "ifias_line_items", ["lr_number"])
    op.create_index("ix_ifias_batch_lr", "ifias_line_items", ["batch_id", "lr_number"])


def downgrade():
    op.drop_index("ix_ifias_batch_lr", table_name="ifias_line_items")
    op.drop_index("ix_ifias_line_items_lr_number", table_name="ifias_line_items")
    op.drop_index("ix_ifias_line_items_batch_id", table_name="ifias_line_items")
    op.drop_table("ifias_line_items")
    op.drop_index("ix_processing_batches_transporter", table_name="processing_batches")
    op.drop_table("processing_batches")
