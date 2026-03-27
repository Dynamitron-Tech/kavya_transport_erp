"""Clean up duplicate drivers and create trip properly."""
import asyncio
from datetime import date, datetime
from sqlalchemy import select, text, delete
from app.db.postgres.connection import AsyncSessionLocal
from app.models.postgres.driver import Driver
from app.models.postgres.trip import Trip, TripStatusEnum

async def main():
    async with AsyncSessionLocal() as db:
        # Delete duplicate drivers for user_id=6, keep only the first one
        r = await db.execute(select(Driver).where(Driver.user_id == 6).order_by(Driver.id.asc()))
        drivers = r.scalars().all()
        if len(drivers) > 1:
            keep = drivers[0]
            for d in drivers[1:]:
                await db.delete(d)
                print(f'  Deleted duplicate driver_id={d.id}')
            print(f'Kept driver_id={keep.id}')
            driver_id = keep.id
        elif len(drivers) == 1:
            driver_id = drivers[0].id
            print(f'Driver exists: driver_id={driver_id}')
        else:
            d = Driver(user_id=6, employee_code='DRV006', first_name='Driver', last_name='User', phone='0000000000')
            db.add(d)
            await db.flush()
            driver_id = d.id
            print(f'Created driver_id={driver_id}')

        await db.flush()

        # Check existing trips for this driver
        r2 = await db.execute(select(Trip).where(Trip.driver_id == driver_id).limit(1))
        existing_trip = r2.scalar_one_or_none()
        if existing_trip:
            print(f'Trip already exists: trip_id={existing_trip.id}, status={existing_trip.status}')
        else:
            # Get last trip_number to generate next one
            r3 = await db.execute(text("SELECT trip_number FROM trips ORDER BY id DESC LIMIT 1"))
            last_tn = r3.scalar_one_or_none()
            if last_tn:
                prefix = last_tn.rsplit('-', 1)[0]
                num = int(last_tn.rsplit('-', 1)[1]) + 1
                new_tn = f'{prefix}-{num:03d}'
            else:
                new_tn = 'TRIP-001'
            print(f'New trip_number: {new_tn}')

            # Get vehicle from ref trip
            r4 = await db.execute(select(Trip).where(Trip.id == 4))
            ref = r4.scalar_one_or_none()
            vehicle_id = ref.vehicle_id if ref else 1

            new_trip = Trip(
                trip_number=new_tn,
                trip_date=date.today(),
                driver_id=driver_id,
                vehicle_id=vehicle_id,
                status=TripStatusEnum.STARTED,
                origin='Chennai',
                destination='Bangalore',
                actual_start=datetime.utcnow(),
            )
            db.add(new_trip)
            await db.flush()
            print(f'Created trip: trip_id={new_trip.id}, status={new_trip.status}')

        await db.commit()
        print('Done!')

asyncio.run(main())
