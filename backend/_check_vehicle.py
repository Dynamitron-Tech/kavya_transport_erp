import asyncio
from sqlalchemy import text
from app.db.postgres.connection import async_engine

async def check():
    async with async_engine.connect() as conn:
        r = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='vehicle_documents' ORDER BY ordinal_position"))
        cols = r.fetchall()
        if cols:
            print("vehicle_documents table columns:")
            for c in cols:
                print(f"  {c[0]}: {c[1]}")
        else:
            print("vehicle_documents table does NOT exist")

        try:
            r = await conn.execute(text("SELECT COUNT(*) FROM vehicle_documents"))
            print(f"Document rows: {r.scalar()}")
        except Exception as e:
            print(f"Error querying vehicle_documents: {e}")

        r = await conn.execute(text("SELECT COUNT(*) FROM vehicles"))
        print(f"Vehicles count: {r.scalar()}")

        r = await conn.execute(text("SELECT t.id, t.trip_number, t.vehicle_id, t.vehicle_registration, t.driver_id, t.status FROM trips t WHERE t.driver_id IS NOT NULL LIMIT 5"))
        rows = r.fetchall()
        print(f"Trips with drivers ({len(rows)}):")
        for row in rows:
            print(f"  trip={row[1]}, vehicle_id={row[2]}, reg={row[3]}, driver_id={row[4]}, status={row[5]}")

        r = await conn.execute(text("SELECT id, registration_number, status FROM vehicles LIMIT 5"))
        rows = r.fetchall()
        print(f"Sample vehicles:")
        for row in rows:
            print(f"  id={row[0]}, reg={row[1]}, status={row[2]}")

asyncio.run(check())
