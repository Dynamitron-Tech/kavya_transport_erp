"""TMS automation columns

Revision ID: h001_tms_automation_columns
Revises: g001_add_document_extraction
Create Date: 2025-01-01 00:00:00.000000

Adds nullable columns used by the 18 TMS zero-cost automations:
  - lrs.ewb_draft_id              (EVT-01)
  - trips.pod_completed_at        (EVT-06)
  - trip_expenses.anomaly_flag    (SCH-05)
  - trip_expenses.anomaly_reason  (SCH-05)
  - jobs.requires_credit_approval (RUL-01)
  - jobs.suggested_vehicle_type   (RUL-04)
  - clients.do_not_remind         (SCH-02)
  - vehicles.odometer_at_last_service (SCH-03)
  - vehicles.last_service_date    (SCH-03)
"""

from alembic import op
import sqlalchemy as sa

revision = "h001_tms_automation_columns"
down_revision = "g001_add_document_extraction"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # LRs — EVT-01
    op.add_column("lrs", sa.Column("ewb_draft_id", sa.String(50), nullable=True))

    # Trips — EVT-06
    op.add_column("trips", sa.Column("pod_completed_at", sa.DateTime(), nullable=True))

    # Trip Expenses — SCH-05
    op.add_column("trip_expenses", sa.Column("anomaly_flag", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("trip_expenses", sa.Column("anomaly_reason", sa.String(255), nullable=True))

    # Jobs — RUL-01, RUL-04
    op.add_column("jobs", sa.Column("requires_credit_approval", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("jobs", sa.Column("suggested_vehicle_type", sa.String(50), nullable=True))

    # Clients — SCH-02
    op.add_column("clients", sa.Column("do_not_remind", sa.Boolean(), server_default="false", nullable=False))

    # Vehicles — SCH-03
    op.add_column("vehicles", sa.Column("odometer_at_last_service", sa.Numeric(12, 2), nullable=True))
    op.add_column("vehicles", sa.Column("last_service_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("vehicles", "last_service_date")
    op.drop_column("vehicles", "odometer_at_last_service")
    op.drop_column("clients", "do_not_remind")
    op.drop_column("jobs", "suggested_vehicle_type")
    op.drop_column("jobs", "requires_credit_approval")
    op.drop_column("trip_expenses", "anomaly_reason")
    op.drop_column("trip_expenses", "anomaly_flag")
    op.drop_column("trips", "pod_completed_at")
    op.drop_column("lrs", "ewb_draft_id")
