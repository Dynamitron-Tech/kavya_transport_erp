"""add document extraction fields

Revision ID: g001_add_document_extraction
Revises: f001_create_notifications_table
Create Date: 2026-03-24

Adds:
  - New DocumentType enum values: PUC, DRIVER_BADGE, MEDICAL_FITNESS,
    AADHAAR, PAN_CARD, GST_CERTIFICATE
  - documents.extracted_data  JSONB column
  - documents.file_key        VARCHAR(500) column
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'g001_add_document_extraction'
down_revision = 'f001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Add new enum values to documenttype ─────────────────────────────────
    # NOTE: ALTER TYPE … ADD VALUE cannot run inside a transaction in
    # PostgreSQL < 12. We use get_bind() to execute outside the transaction
    # if necessary. In PG 12+, this is safe inside a transaction.
    conn = op.get_bind()
    new_values = [
        "PUC",
        "DRIVER_BADGE",
        "MEDICAL_FITNESS",
        "AADHAAR",
        "PAN_CARD",
        "GST_CERTIFICATE",
    ]
    for val in new_values:
        # IF NOT EXISTS is supported in PostgreSQL 9.3+
        conn.execute(
            sa.text(f"ALTER TYPE documenttype ADD VALUE IF NOT EXISTS '{val}'")
        )

    # ── Add new columns to documents table ──────────────────────────────────
    op.add_column(
        "documents",
        sa.Column("extracted_data", sa.JSON(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("file_key", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    # Removing enum values from PostgreSQL requires recreating the type.
    # Column removal is straightforward.
    op.drop_column("documents", "extracted_data")
    op.drop_column("documents", "file_key")
    # Note: enum values cannot be removed without recreating the type;
    # downgrade leaves the enum values in place to avoid data loss.
