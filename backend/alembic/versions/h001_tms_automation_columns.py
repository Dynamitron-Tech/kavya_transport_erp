"""TMS Automation: Add columns for 18-automation rollout

Revision ID: h001_tms_automation_columns
Revises: g001_add_document_extraction
Create Date: 2024-01-01 00:00:00.000000

New columns added:
  lrs.ewb_draft_id           (EVT-01)
  trips.pod_completed_at     (EVT-06)
  trip_expenses.anomaly_flag (RUL-03)
  trip_expenses.anomaly_reason (RUL-03)
  jobs.requires_credit_approval (RUL-01)
  jobs.suggested_vehicle_type   (RUL-04)
  clients.do_not_remind         (SCH-02)
  vehicles.odometer_at_last_service (SCH-03)
  vehicles.last_service_date    (SCH-03)
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'h001_tms_automation_columns'
down_revision = 'g001_add_document_extraction'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # EVT-01: auto-drafted EWB tracking id on LR
    with op.batch_alter_table('lrs') as batch_op:
        batch_op.add_column(sa.Column('ewb_draft_id', sa.String(50), nullable=True))

    # EVT-06: timestamp when all LRs on a trip receive POD
    with op.batch_alter_table('trips') as batch_op:
        batch_op.add_column(sa.Column('pod_completed_at', sa.DateTime(), nullable=True))

    # RUL-03: expense anomaly detection flags
    with op.batch_alter_table('trip_expenses') as batch_op:
        batch_op.add_column(sa.Column('anomaly_flag', sa.Boolean(), nullable=False, server_default='false'))
        batch_op.add_column(sa.Column('anomaly_reason', sa.String(255), nullable=True))

    # RUL-01 / RUL-04: credit approval flag and vehicle-type suggestion on jobs
    with op.batch_alter_table('jobs') as batch_op:
        batch_op.add_column(sa.Column('requires_credit_approval', sa.Boolean(), nullable=False, server_default='false'))
        batch_op.add_column(sa.Column('suggested_vehicle_type', sa.String(50), nullable=True))

    # SCH-02: suppress payment reminder per client
    with op.batch_alter_table('clients') as batch_op:
        batch_op.add_column(sa.Column('do_not_remind', sa.Boolean(), nullable=False, server_default='false'))

    # SCH-03: predictive maintenance odometer tracking on vehicles
    with op.batch_alter_table('vehicles') as batch_op:
        batch_op.add_column(sa.Column('odometer_at_last_service', sa.Numeric(12, 2), nullable=True))
        batch_op.add_column(sa.Column('last_service_date', sa.Date(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('vehicles') as batch_op:
        batch_op.drop_column('last_service_date')
        batch_op.drop_column('odometer_at_last_service')

    with op.batch_alter_table('clients') as batch_op:
        batch_op.drop_column('do_not_remind')

    with op.batch_alter_table('jobs') as batch_op:
        batch_op.drop_column('suggested_vehicle_type')
        batch_op.drop_column('requires_credit_approval')

    with op.batch_alter_table('trip_expenses') as batch_op:
        batch_op.drop_column('anomaly_reason')
        batch_op.drop_column('anomaly_flag')

    with op.batch_alter_table('trips') as batch_op:
        batch_op.drop_column('pod_completed_at')

    with op.batch_alter_table('lrs') as batch_op:
        batch_op.drop_column('ewb_draft_id')
