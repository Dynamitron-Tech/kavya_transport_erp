"""
Seed 20 Ashok Leyland iALERT vehicles into the database.
Run:  cd backend && python seed_ialert_vehicles.py
"""
import asyncio
from app.db.postgres.connection import AsyncSessionLocal
from sqlalchemy import text

# ── 20 Ashok Leyland vehicles registered for iALERT ──
VEHICLES = [
    {"reg": "TN72CE8913", "vin": "MB1A5PCD0RELN5126"},
    {"reg": "TN72CE8939", "vin": "MB1A5PCDXREJN9162"},
    {"reg": "TN72CE9420", "vin": "MB1A5PCD5REGP3679"},
    {"reg": "TN72CE9435", "vin": "MB1A5PCDXREGP3676"},
    {"reg": "TN72CE9469", "vin": "MB1A5PCD3REGP3678"},
    {"reg": "TN72CE9474", "vin": "MB1A5PCD8REJN9161"},
    {"reg": "TN72CF2624", "vin": "MB1A5PCD1REDP7039"},
    {"reg": "TN72CF2638", "vin": "MB1A5PCDXREDP7038"},
    {"reg": "TN72CJ3255", "vin": "MB1CWKHD3SPJG3979"},
    {"reg": "TN72CJ3259", "vin": "MB1CWKHD8SPKG1390"},
    {"reg": "TN72CJ3282", "vin": "MB1CWKHD1SPJG3981"},
    {"reg": "TN72CJ3793", "vin": "MB1CWKHD5SPHG6922"},
    {"reg": "TN72CJ5960", "vin": "MB1CWKHD8SPGH1187"},
    {"reg": "TN72CJ5979", "vin": "MB1CWKHD2SPGH1184"},
    {"reg": "TN72CJ5996", "vin": "MB1CWKHD2SPHG6926"},
    {"reg": "TN72CJ9158", "vin": "MB1CWCHD4SPHG7775"},
    {"reg": "TN72CJ9198", "vin": "MB1CWCHD3SPDH2812"},
    {"reg": "TN72CJ9443", "vin": "MB1CWCHD1SPDH2811"},
    {"reg": "TN72CJ9482", "vin": "MB1CWCHD5SPDH2813"},
    {"reg": "TN92L5088",  "vin": "MB1A5PCD8RECP9545"},
]


async def seed():
    async with AsyncSessionLocal() as db:
        inserted = 0
        updated = 0
        for v in VEHICLES:
            # Check if vehicle already exists
            result = await db.execute(
                text("SELECT id FROM vehicles WHERE registration_number = :reg"),
                {"reg": v["reg"]},
            )
            existing = result.scalar_one_or_none()

            if existing:
                # Update GPS provider + chassis number
                await db.execute(
                    text("""
                        UPDATE vehicles SET
                            make = 'ASHOK LEYLAND',
                            gps_provider = 'iALERT',
                            gps_device_id = :vin,
                            chassis_number = :vin
                        WHERE id = :id
                    """),
                    {"vin": v["vin"], "id": existing},
                )
                updated += 1
                print(f"  ✓ Updated {v['reg']} (id={existing})")
            else:
                # Insert new vehicle
                await db.execute(
                    text("""
                        INSERT INTO vehicles (
                            registration_number, vehicle_type, make, ownership_type,
                            status, fuel_type, gps_provider, gps_device_id,
                            chassis_number, owner_name, created_at, updated_at, is_deleted
                        ) VALUES (
                            :reg, 'TRUCK', 'ASHOK LEYLAND', 'OWNED',
                            'AVAILABLE', 'diesel', 'iALERT', :vin,
                            :vin, 'Kavya Transports', NOW(), NOW(), false
                        )
                    """),
                    {"reg": v["reg"], "vin": v["vin"]},
                )
                inserted += 1
                print(f"  + Inserted {v['reg']}")

        await db.commit()
        print(f"\nDone: {inserted} inserted, {updated} updated, {len(VEHICLES)} total")

        # Verify
        result = await db.execute(
            text("SELECT id, registration_number, gps_provider, gps_device_id FROM vehicles WHERE gps_provider = 'iALERT' ORDER BY registration_number")
        )
        print("\niALERT vehicles in DB:")
        for row in result.all():
            print(f"  V{row[0]}: {row[1]} | GPS: {row[2]} | VIN: {row[3]}")


if __name__ == "__main__":
    asyncio.run(seed())
