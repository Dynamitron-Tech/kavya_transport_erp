"""Link driver@kavyatransports.com (user_id=6) to a drivers record."""
import asyncio
from sqlalchemy import select
from app.db.postgres.connection import AsyncSessionLocal
from app.models.postgres.driver import Driver
from app.models.postgres.trip import Trip, TripStatusEnum

async def main():
    async with AsyncSessionLocal() as db:
        # Check existing
        r = await db.execute(select(Driver).where(Driver.user_id == 6))
        existing = r.scalar_one_or_none()
        if existing:
            print(f'Driver already linked: driver_id={existing.id}')
            driver_id = existing.id
        else:
            d = Driver(user_id=6, employee_code='DRV006', first_name='Driver', last_name='User', phone='0000000000')
            db.add(d)
            await db.flush()
            print(f'Created driver record: driver_id={d.id}')
            driver_id = d.id

        # Check if this driver has a trip
        r2 = await db.execute(select(Trip).where(Trip.driver_id == driver_id).order_by(Trip.id.desc()).limit(1))
        trip = r2.scalar_one_or_none()
        if trip:
            print(f'Driver already has trip: trip_id={trip.id}, status={trip.status}')
        else:
            # Copy trip 4 info to create a new trip for this driver
            r3 = await db.execute(select(Trip).where(Trip.id == 4))
            ref_trip = r3.scalar_one_or_none()
            if ref_trip:
                new_trip = Trip(
                    driver_id=driver_id,
                    vehicle_id=ref_trip.vehicle_id,
                    status=TripStatusEnum.STARTED,
                    origin=ref_trip.origin,
                    destination=ref_trip.destination,
                )
                db.add(new_trip)
                await db.flush()
                print(f'Created trip: trip_id={new_trip.id}, status={new_trip.status}')
            else:
                print('No reference trip found')

        await db.commit()

asyncio.run(main())
