import asyncio
from sqlalchemy import text
from app.db.postgres.connection import async_engine

async def seed():
    async with async_engine.begin() as conn:
        # Fix trip TRP-260319-025: set vehicle_registration from vehicles table
        await conn.execute(text("""
            UPDATE trips SET vehicle_registration = v.registration_number
            FROM vehicles v WHERE trips.vehicle_id = v.id
            AND trips.vehicle_registration IS NULL
        """))
        print("Fixed NULL vehicle_registration in trips")

        # Seed vehicle_documents for vehicle_id=3 (the one assigned to driver 14)
        # and also for vehicle_id=1 as sample
        await conn.execute(text("""
            INSERT INTO vehicle_documents (vehicle_id, document_type, document_number, issue_date, expiry_date, is_verified, created_at, updated_at)
            VALUES
            (3, 'rc_book', 'TN72-2024-RC-4831', '2024-01-15', '2034-01-14', true, NOW(), NOW()),
            (3, 'insurance', 'POL-INS-2025-7721', '2025-01-01', '2026-01-01', true, NOW(), NOW()),
            (3, 'pollution_certificate', 'PUC-2025-3349', '2025-06-10', '2025-12-09', true, NOW(), NOW()),
            (3, 'fitness_certificate', 'FC-TN72-2025-112', '2025-03-01', '2026-02-28', true, NOW(), NOW()),
            (1, 'rc_book', 'TN72BC-RC-0091', '2023-05-20', '2033-05-19', true, NOW(), NOW()),
            (1, 'insurance', 'POL-INS-2024-5510', '2024-04-01', '2025-04-01', false, NOW(), NOW()),
            (1, 'pollution_certificate', 'PUC-2024-8821', '2024-11-01', '2025-05-01', true, NOW(), NOW()),
            (1, 'fitness_certificate', 'FC-TN72-2024-303', '2024-06-15', '2025-06-14', true, NOW(), NOW())
            ON CONFLICT DO NOTHING
        """))
        print("Seeded vehicle_documents")

        # Verify
        r = await conn.execute(text("SELECT id, vehicle_id, document_type, document_number, expiry_date FROM vehicle_documents ORDER BY vehicle_id, document_type"))
        rows = r.fetchall()
        print(f"Vehicle documents ({len(rows)}):")
        for row in rows:
            print(f"  id={row[0]}, vehicle={row[1]}, type={row[2]}, num={row[3]}, expires={row[4]}")

        # Check trips for driver 14
        r = await conn.execute(text("SELECT id, trip_number, vehicle_id, vehicle_registration, status FROM trips WHERE driver_id=14"))
        rows = r.fetchall()
        print(f"Driver 14 trips:")
        for row in rows:
            print(f"  id={row[0]}, trip={row[1]}, vehicle_id={row[2]}, reg={row[3]}, status={row[4]}")

asyncio.run(seed())
