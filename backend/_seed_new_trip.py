import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.postgres.trip import Trip, TripStatus, TripStatusEnum
from app.models.postgres.driver import Driver
from app.models.postgres.vehicle import Vehicle
from app.utils.generators import generate_trip_number
from datetime import datetime, timezone

DATABASE_URL = "postgresql+asyncpg://ajaikumarn@localhost:5432/kavya_transports_db"

async def seed():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        driver = await db.get(Driver, 14)
        vehicle_result = await db.execute(select(Vehicle).limit(1))
        vehicle = vehicle_result.scalar_one_or_none()

        if not driver:
            print("Driver id=14 not found"); return
        if not vehicle:
            print("No vehicle found"); return

        trip_number = generate_trip_number()
        trip = Trip(
            trip_number=trip_number,
            origin="Chennai",
            destination="Coimbatore",
            status=TripStatusEnum.DRIVER_ASSIGNED,
            driver_id=14,
            vehicle_id=vehicle.id,
            trip_date=datetime.now(timezone.utc),
            freight_amount=18000.0,
            distance_km=500.0,
            remarks="Test trip — Chennai to Coimbatore",
        )
        db.add(trip)
        await db.flush()

        log = TripStatus(
            trip_id=trip.id,
            from_status=None,
            to_status=TripStatusEnum.DRIVER_ASSIGNED,
            changed_by=6,
            remarks="Seeded for driver testing",
        )
        db.add(log)
        await db.commit()
        print(f"Trip {trip_number} (id={trip.id}) created: Chennai -> Coimbatore | status=driver_assigned | driver_id=14")

asyncio.run(seed())
