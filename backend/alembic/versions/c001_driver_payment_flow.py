"""driver payment flow - add trip/driver/razorpay columns to payments, add payment_approved to trips

Revision ID: c001
Revises: b007
Create Date: 2026-03-21 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "c001"
down_revision = "b007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── payments table: link to trip & driver, Razorpay fields, source tag ──
    op.add_column("payments", sa.Column("trip_id", sa.Integer(), nullable=True))
    op.add_column("payments", sa.Column("driver_id", sa.Integer(), nullable=True))
    op.add_column("payments", sa.Column("source_ref", sa.String(100), nullable=True))
    op.add_column("payments", sa.Column("razorpay_order_id", sa.String(100), nullable=True))
    op.add_column("payments", sa.Column("razorpay_payment_id", sa.String(100), nullable=True))

    op.create_foreign_key("fk_payments_trip_id", "payments", "trips", ["trip_id"], ["id"])
    op.create_foreign_key("fk_payments_driver_id", "payments", "drivers", ["driver_id"], ["id"])

    # ── trips table: track payment approval by admin ──────────────────────────
    op.add_column("trips", sa.Column("payment_approved", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("trips", sa.Column("payment_approved_at", sa.DateTime(), nullable=True))
    op.add_column("trips", sa.Column("payment_approved_by", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_trips_payment_approved_by", "trips", "users", ["payment_approved_by"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_trips_payment_approved_by", "trips", type_="foreignkey")
    op.drop_column("trips", "payment_approved_by")
    op.drop_column("trips", "payment_approved_at")
    op.drop_column("trips", "payment_approved")

    op.drop_constraint("fk_payments_driver_id", "payments", type_="foreignkey")
    op.drop_constraint("fk_payments_trip_id", "payments", type_="foreignkey")
    op.drop_column("payments", "razorpay_payment_id")
    op.drop_column("payments", "razorpay_order_id")
    op.drop_column("payments", "source_ref")
    op.drop_column("payments", "driver_id")
    op.drop_column("payments", "trip_id")
