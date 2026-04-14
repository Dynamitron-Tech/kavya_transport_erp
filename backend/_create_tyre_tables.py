"""Create new tyre field tables: tyre_readings, tyre_alerts, tyre_thresholds, tyre_simulation_sessions"""
import sys, asyncio, os
sys.path.insert(0, 'c:/Users/BALAN/Desktop/kavya_erp-feature-ajai-dev/kavya_erp-feature-ajai-dev/backend')
os.chdir('c:/Users/BALAN/Desktop/kavya_erp-feature-ajai-dev/kavya_erp-feature-ajai-dev/backend')
from app.db.postgres.connection import AsyncSessionLocal
from sqlalchemy import text


async def table_exists(db, table):
    r = await db.execute(text(
        f"SELECT 1 FROM information_schema.tables WHERE table_name='{table}'"
    ))
    return r.scalar() is not None


async def type_exists(db, typename):
    r = await db.execute(text(
        f"SELECT 1 FROM pg_type WHERE typname='{typename}'"
    ))
    return r.scalar() is not None


async def main():
    async with AsyncSessionLocal() as db:

        # ── ENUM types ────────────────────────────────────────────────
        if not await type_exists(db, 'tyrereadingcondition'):
            await db.execute(text("CREATE TYPE tyrereadingcondition AS ENUM ('GOOD','AVERAGE','WORN','DAMAGED')"))
            print("Created enum tyrereadingcondition")

        if not await type_exists(db, 'tyrealerttype'):
            await db.execute(text("""
                CREATE TYPE tyrealerttype AS ENUM (
                    'LOW_PSI','CRITICAL_PSI','HIGH_TEMP','LOW_TREAD',
                    'WORN','DAMAGED','OVERDUE_INSPECTION','ROTATION_DUE'
                )
            """))
            print("Created enum tyrealerttype")

        if not await type_exists(db, 'tyrealertseverity'):
            await db.execute(text("CREATE TYPE tyrealertseverity AS ENUM ('WARNING','CRITICAL')"))
            print("Created enum tyrealertseverity")

        if not await type_exists(db, 'tyrealertstatus'):
            await db.execute(text("CREATE TYPE tyrealertstatus AS ENUM ('OPEN','ACKNOWLEDGED','RESOLVED')"))
            print("Created enum tyrealertstatus")

        if not await type_exists(db, 'roadtype'):
            await db.execute(text("CREATE TYPE roadtype AS ENUM ('HIGHWAY','CITY','OFFROAD','MIXED')"))
            print("Created enum roadtype")

        # ── tyre_readings ───────────────────────────────────────────
        if not await table_exists(db, 'tyre_readings'):
            await db.execute(text("""
                CREATE TABLE tyre_readings (
                    id SERIAL PRIMARY KEY,
                    vehicle_tyre_id INTEGER REFERENCES vehicle_tyres(id) ON DELETE CASCADE,
                    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
                    position VARCHAR(20) NOT NULL,
                    psi NUMERIC(5,1) NOT NULL,
                    tread_depth_mm NUMERIC(4,1),
                    condition tyrereadingcondition NOT NULL DEFAULT 'GOOD',
                    temperature_c NUMERIC(5,1),
                    notes TEXT,
                    photo_url VARCHAR(500),
                    driver_id INTEGER REFERENCES users(id),
                    odometer_at_reading NUMERIC(12,2),
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """))
            await db.execute(text("CREATE INDEX ix_tyre_readings_vehicle_id ON tyre_readings(vehicle_id)"))
            await db.execute(text("CREATE INDEX ix_tyre_readings_vehicle_tyre_id ON tyre_readings(vehicle_tyre_id)"))
            await db.execute(text("CREATE INDEX ix_tyre_readings_driver_id ON tyre_readings(driver_id)"))
            print("Created table tyre_readings")
        else:
            print("tyre_readings already exists")

        # ── tyre_alerts ─────────────────────────────────────────────
        if not await table_exists(db, 'tyre_alerts'):
            await db.execute(text("""
                CREATE TABLE tyre_alerts (
                    id SERIAL PRIMARY KEY,
                    vehicle_tyre_id INTEGER REFERENCES vehicle_tyres(id) ON DELETE CASCADE,
                    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
                    position VARCHAR(20) NOT NULL,
                    alert_type tyrealerttype NOT NULL,
                    severity tyrealertseverity NOT NULL,
                    current_value NUMERIC(8,2),
                    threshold_value NUMERIC(8,2),
                    status tyrealertstatus NOT NULL DEFAULT 'OPEN',
                    acknowledged_by INTEGER REFERENCES users(id),
                    resolved_at TIMESTAMP,
                    source VARCHAR(20) DEFAULT 'field',
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """))
            await db.execute(text("CREATE INDEX ix_tyre_alerts_vehicle_id ON tyre_alerts(vehicle_id)"))
            await db.execute(text("CREATE INDEX ix_tyre_alerts_vehicle_tyre_id ON tyre_alerts(vehicle_tyre_id)"))
            print("Created table tyre_alerts")
        else:
            print("tyre_alerts already exists")

        # ── tyre_thresholds ─────────────────────────────────────────
        if not await table_exists(db, 'tyre_thresholds'):
            await db.execute(text("""
                CREATE TABLE tyre_thresholds (
                    id SERIAL PRIMARY KEY,
                    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
                    min_psi NUMERIC(5,1) DEFAULT 80.0,
                    critical_psi NUMERIC(5,1) DEFAULT 60.0,
                    min_tread_mm NUMERIC(4,1) DEFAULT 3.0,
                    worn_tread_mm NUMERIC(4,1) DEFAULT 1.6,
                    inspection_interval_days INTEGER DEFAULT 7,
                    rotation_interval_km INTEGER DEFAULT 20000,
                    created_by INTEGER REFERENCES users(id),
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """))
            await db.execute(text("CREATE INDEX ix_tyre_thresholds_vehicle_id ON tyre_thresholds(vehicle_id)"))
            print("Created table tyre_thresholds")

            # Seed one fleet-wide default (vehicle_id = NULL)
            await db.execute(text("""
                INSERT INTO tyre_thresholds (vehicle_id, min_psi, critical_psi, min_tread_mm, worn_tread_mm,
                    inspection_interval_days, rotation_interval_km)
                VALUES (NULL, 80.0, 60.0, 3.0, 1.6, 7, 20000)
            """))
            print("Seeded fleet-wide default threshold")
        else:
            print("tyre_thresholds already exists")

        # ── tyre_simulation_sessions ────────────────────────────────
        if not await table_exists(db, 'tyre_simulation_sessions'):
            await db.execute(text("""
                CREATE TABLE tyre_simulation_sessions (
                    id SERIAL PRIMARY KEY,
                    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
                    simulated_km INTEGER NOT NULL,
                    simulated_load_kg INTEGER,
                    road_type roadtype NOT NULL DEFAULT 'HIGHWAY',
                    climate VARCHAR(20) DEFAULT 'NORMAL',
                    result_json TEXT,
                    created_by INTEGER REFERENCES users(id),
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """))
            await db.execute(text("CREATE INDEX ix_tyre_simulation_sessions_vehicle_id ON tyre_simulation_sessions(vehicle_id)"))
            print("Created table tyre_simulation_sessions")
        else:
            print("tyre_simulation_sessions already exists")

        await db.commit()
        print("\nAll tyre field tables ready.")


asyncio.run(main())
