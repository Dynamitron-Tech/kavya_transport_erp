"""Convert native enum columns to VARCHAR in tyre_readings and tyre_alerts

Revision ID: r003_tyre_enums_to_varchar
Revises: r002_tyre_readings_nullable
Create Date: 2026-04-13

Fixes DatatypeMismatchError: columns created as native PostgreSQL enums (via
sa.Enum with name=) but ORM model uses native_enum=False (VARCHAR). The mismatch
only surfaces on multi-row inserts (insertmanyvalues path in asyncpg), which is
triggered when multiple alerts are created in a single reading submission.
"""

from alembic import op
import sqlalchemy as sa

revision = "r003_tyre_enums_to_varchar"
down_revision = "r002_tyre_readings_nullable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── tyre_readings.condition ──────────────────────────────
    # Drop default first (it references the enum type), convert, restore
    op.execute("ALTER TABLE tyre_readings ALTER COLUMN condition DROP DEFAULT")
    op.execute(
        "ALTER TABLE tyre_readings "
        "ALTER COLUMN condition TYPE VARCHAR(20) "
        "USING condition::TEXT"
    )
    op.execute("ALTER TABLE tyre_readings ALTER COLUMN condition SET DEFAULT 'GOOD'")

    # ── tyre_alerts enum columns ─────────────────────────────
    # Drop defaults that reference enum types before altering
    op.execute("ALTER TABLE tyre_alerts ALTER COLUMN status DROP DEFAULT")
    op.execute(
        "ALTER TABLE tyre_alerts "
        "ALTER COLUMN alert_type TYPE VARCHAR(30) USING alert_type::TEXT"
    )
    op.execute(
        "ALTER TABLE tyre_alerts "
        "ALTER COLUMN severity TYPE VARCHAR(20) USING severity::TEXT"
    )
    op.execute(
        "ALTER TABLE tyre_alerts "
        "ALTER COLUMN status TYPE VARCHAR(20) USING status::TEXT"
    )
    op.execute("ALTER TABLE tyre_alerts ALTER COLUMN status SET DEFAULT 'OPEN'")

    # Drop the now-orphaned PostgreSQL enum types (CASCADE to clear any remnant deps)
    op.execute("DROP TYPE IF EXISTS tyrereadingcondition CASCADE")
    op.execute("DROP TYPE IF EXISTS tyrealerttype CASCADE")
    op.execute("DROP TYPE IF EXISTS tyrealertseverity CASCADE")
    op.execute("DROP TYPE IF EXISTS tyrealertstatus CASCADE")


def downgrade() -> None:
    # Re-create enum types and cast back (best effort)
    op.execute(
        "CREATE TYPE tyrereadingcondition AS ENUM ('GOOD','AVERAGE','WORN','DAMAGED')"
    )
    op.execute(
        "ALTER TABLE tyre_readings "
        "ALTER COLUMN condition TYPE tyrereadingcondition "
        "USING condition::tyrereadingcondition"
    )

    op.execute(
        "CREATE TYPE tyrealerttype AS ENUM "
        "('LOW_PSI','CRITICAL_PSI','HIGH_TEMP','LOW_TREAD','WORN','DAMAGED',"
        "'OVERDUE_INSPECTION','ROTATION_DUE')"
    )
    op.execute(
        "CREATE TYPE tyrealertseverity AS ENUM ('WARNING','CRITICAL')"
    )
    op.execute(
        "CREATE TYPE tyrealertstatus AS ENUM ('OPEN','ACKNOWLEDGED','RESOLVED')"
    )
    op.execute(
        "ALTER TABLE tyre_alerts "
        "ALTER COLUMN alert_type TYPE tyrealerttype USING alert_type::tyrealerttype, "
        "ALTER COLUMN severity TYPE tyrealertseverity USING severity::tyrealertseverity, "
        "ALTER COLUMN status TYPE tyrealertstatus USING status::tyrealertstatus"
    )
