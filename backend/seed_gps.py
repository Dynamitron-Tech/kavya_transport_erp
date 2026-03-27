import asyncio
from app.db.postgres.connection import AsyncSessionLocal
from sqlalchemy import text

async def seed_gps():
    async with AsyncSessionLocal() as db:
        # Set GPS coordinates for vehicles that don't have them yet (7, 8)
        await db.execute(text(
            "UPDATE vehicles SET "
            "current_latitude = 9.9252, current_longitude = 78.1198, "
            "gps_device_id = 'GPS-' || registration_number, "
            "gps_provider = 'iTriangle', "
            "odometer_reading = 41000 "
            "WHERE id = 7 AND current_latitude IS NULL"
        ))
        await db.execute(text(
            "UPDATE vehicles SET "
            "current_latitude = 13.0569, current_longitude = 80.2425, "
            "gps_device_id = 'GPS-' || registration_number, "
            "gps_provider = 'iTriangle', "
            "odometer_reading = 28000 "
            "WHERE id = 8 AND current_latitude IS NULL"
        ))
        await db.commit()
        result = await db.execute(text(
            'SELECT id, registration_number, gps_device_id, current_latitude, current_longitude, odometer_reading FROM vehicles ORDER BY id'
        ))
        for row in result.all():
            print(f'  V{row[0]}: {row[1]} | GPS: {row[2]} | Lat: {row[3]} Lng: {row[4]} | Odo: {row[5]}')

asyncio.run(seed_gps())
