"""Make tyre_readings.vehicle_tyre_id nullable

Revision ID: r002_tyre_readings_nullable
Revises: r001_tyre_field_tables
Create Date: 2026-04-13 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "r002_tyre_readings_nullable"
down_revision = "r001_tyre_field_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the old NOT NULL + CASCADE FK, re-add as nullable with SET NULL
    with op.batch_alter_table("tyre_readings") as batch_op:
        batch_op.alter_column(
            "vehicle_tyre_id",
            existing_type=sa.Integer(),
            nullable=True,
        )
        # Drop old CASCADE FK and recreate with SET NULL
        try:
            batch_op.drop_constraint(
                "tyre_readings_vehicle_tyre_id_fkey", type_="foreignkey"
            )
        except Exception:
            pass  # constraint name may differ; ignore if not found
        batch_op.create_foreign_key(
            "tyre_readings_vehicle_tyre_id_fkey",
            "vehicle_tyres",
            ["vehicle_tyre_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("tyre_readings") as batch_op:
        batch_op.drop_constraint(
            "tyre_readings_vehicle_tyre_id_fkey", type_="foreignkey"
        )
        batch_op.alter_column(
            "vehicle_tyre_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
        batch_op.create_foreign_key(
            "tyre_readings_vehicle_tyre_id_fkey",
            "vehicle_tyres",
            ["vehicle_tyre_id"],
            ["id"],
            ondelete="CASCADE",
        )
