"""Seed a trip in driver_assigned status for testing Accept/Decline flow."""
import asyncio
from app.db.postgres.connection import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        # Check driver
        r = await db.execute(text("SELECT id, user_id FROM drivers WHERE user_id = 6"))
        driver = r.fetchone()
        print("Driver:", driver)
        did = driver[0] if driver else 14

        # Check existing trips
        r2 = await db.execute(text(
            "SELECT id, trip_number, status, driver_id, vehicle_id "
            "FROM trips WHERE driver_id = :did ORDER BY id DESC LIMIT 5"
        ), {"did": did})
        for row in r2.fetchall():
            print("Trip:", row)

        # Get a vehicle
        r3 = await db.execute(text("SELECT id, registration_number FROM vehicles LIMIT 1"))
        veh = r3.fetchone()
        print("Vehicle:", veh)

        # Get a client
        r4 = await db.execute(text("SELECT id, name FROM clients LIMIT 1"))
        cli = r4.fetchone()
        print("Client:", cli)

        # Generate trip number
        import datetime
        now = datetime.datetime.now()
        date_part = now.strftime("%y%m%d")
        r5 = await db.execute(text(
            "SELECT COUNT(*) FROM trips WHERE trip_number LIKE :pat"
        ), {"pat": f"TRP-{date_part}-%"})
        count = r5.scalar() or 0
        trip_number = f"TRP-{date_part}-{count+1:03d}"

        # Insert trip in driver_assigned status
        await db.execute(text("""
            INSERT INTO trips (
                trip_number, status, origin, destination,
                vehicle_id, driver_id, job_id, trip_date,
                revenue, driver_pay, is_deleted,
                advance_settled, pod_collected, expenses_verified, is_invoiced,
                created_at, updated_at
            ) VALUES (
                :tn, 'DRIVER_ASSIGNED', 'Bangalore', 'Hyderabad',
                :vid, :did, 8, CURRENT_DATE,
                45000, 8000, false,
                false, false, false, false,
                NOW(), NOW()
            )
        """), {
            "tn": trip_number,
            "vid": veh[0] if veh else 1,
            "did": did,
        })
        await db.commit()
        print(f"\nCreated trip {trip_number} in driver_assigned status for driver {did}")

asyncio.run(main())
