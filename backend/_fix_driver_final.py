"""Clean up and properly create driver + trip for user_id=6 using raw SQL."""
import asyncio
from app.db.postgres.connection import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        # 1. Delete all duplicate drivers for user_id=6
        await db.execute(text("DELETE FROM drivers WHERE user_id = 6"))
        await db.flush()
        print("Cleaned up old driver records for user_id=6")

        # 2. Create a single driver record
        r = await db.execute(text("""
            INSERT INTO drivers (user_id, employee_code, first_name, last_name, phone, status, created_at, updated_at, is_deleted)
            VALUES (6, 'DRV006', 'Driver', 'User', '0000000000', 'AVAILABLE', NOW(), NOW(), false)
            RETURNING id
        """))
        driver_id = r.scalar_one()
        print(f"Created driver_id={driver_id}")

        # 3. Create trip by cloning trip 4 but changing driver_id and trip_number
        r2 = await db.execute(text("SELECT trip_number FROM trips ORDER BY id DESC LIMIT 1"))
        last_tn = r2.scalar_one()
        prefix = last_tn.rsplit('-', 1)[0]
        num = int(last_tn.rsplit('-', 1)[1]) + 1
        new_tn = f'{prefix}-{num:03d}'
        print(f"New trip_number: {new_tn}")

        await db.execute(text("""
            INSERT INTO trips (
                trip_number, trip_date, job_id, vehicle_id, driver_id,
                origin, destination, status,
                created_at, updated_at, is_deleted
            )
            SELECT
                :new_tn, trip_date, job_id, vehicle_id, :driver_id,
                origin, destination, 'STARTED',
                NOW(), NOW(), false
            FROM trips WHERE id = 4
        """), {"new_tn": new_tn, "driver_id": driver_id})
        
        r3 = await db.execute(text("SELECT id, status FROM trips WHERE driver_id = :did ORDER BY id DESC LIMIT 1"), {"did": driver_id})
        trip = r3.fetchone()
        print(f"Created trip: trip_id={trip[0]}, status={trip[1]}")

        await db.commit()
        print("Done!")

asyncio.run(main())
