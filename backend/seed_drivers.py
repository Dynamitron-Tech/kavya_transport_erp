"""
Seed realistic drivers and assign them to existing vehicles.

Usage:
    cd backend && python seed_drivers.py
"""
import asyncio
import sys
sys.path.insert(0, ".")

from sqlalchemy import select, update
from app.db.postgres.connection import AsyncSessionLocal
from app.models.postgres.driver import Driver, DriverStatus
from app.models.postgres.vehicle import Vehicle


DRIVERS = [
    {"employee_code": "KTD001", "first_name": "Murugan",   "last_name": "Selvam",    "phone": "9841001001"},
    {"employee_code": "KTD002", "first_name": "Rajan",     "last_name": "Pillai",     "phone": "9841001002"},
    {"employee_code": "KTD003", "first_name": "Senthil",   "last_name": "Kumar",      "phone": "9841001003"},
    {"employee_code": "KTD004", "first_name": "Anand",     "last_name": "Raj",        "phone": "9841001004"},
    {"employee_code": "KTD005", "first_name": "Karthik",   "last_name": "Shankar",    "phone": "9841001005"},
    {"employee_code": "KTD006", "first_name": "Vijay",     "last_name": "Mohan",      "phone": "9841001006"},
    {"employee_code": "KTD007", "first_name": "Suresh",    "last_name": "Babu",       "phone": "9841001007"},
    {"employee_code": "KTD008", "first_name": "Ramesh",    "last_name": "Naidu",      "phone": "9841001008"},
    {"employee_code": "KTD009", "first_name": "Dinesh",    "last_name": "Perumal",    "phone": "9841001009"},
    {"employee_code": "KTD010", "first_name": "Arun",      "last_name": "Krishnan",   "phone": "9841001010"},
    {"employee_code": "KTD011", "first_name": "Balan",     "last_name": "Raju",       "phone": "9841001011"},
    {"employee_code": "KTD012", "first_name": "Ganesh",    "last_name": "Sundaram",   "phone": "9841001012"},
    {"employee_code": "KTD013", "first_name": "Manoj",     "last_name": "Durai",      "phone": "9841001013"},
    {"employee_code": "KTD014", "first_name": "Praveen",   "last_name": "Muthu",      "phone": "9841001014"},
    {"employee_code": "KTD015", "first_name": "Santhosh",  "last_name": "Arumugam",   "phone": "9841001015"},
    {"employee_code": "KTD016", "first_name": "Rajesh",    "last_name": "Velu",       "phone": "9841001016"},
    {"employee_code": "KTD017", "first_name": "Tamil",     "last_name": "Selvan",     "phone": "9841001017"},
    {"employee_code": "KTD018", "first_name": "Saravanan", "last_name": "Pandi",      "phone": "9841001018"},
    {"employee_code": "KTD019", "first_name": "Kumaran",   "last_name": "Natarajan",  "phone": "9841001019"},
    {"employee_code": "KTD020", "first_name": "Palani",    "last_name": "Swamy",      "phone": "9841001020"},
    {"employee_code": "KTD021", "first_name": "Vivek",     "last_name": "Chandran",   "phone": "9841001021"},
]


async def main():
    async with AsyncSessionLocal() as db:
        # Fetch all vehicles ordered by id
        veh_result = await db.execute(
            select(Vehicle).where(Vehicle.is_deleted == False).order_by(Vehicle.id)
        )
        vehicles = veh_result.scalars().all()
        print(f"Found {len(vehicles)} vehicles")

        created_drivers = []
        for data in DRIVERS:
            # Skip if employee_code already exists
            existing = await db.execute(
                select(Driver).where(Driver.employee_code == data["employee_code"])
            )
            driver = existing.scalars().first()
            if driver:
                created_drivers.append(driver)
                print(f"  Existing: {data['employee_code']} {data['first_name']} {data['last_name']}")
                continue

            driver = Driver(
                employee_code=data["employee_code"],
                first_name=data["first_name"],
                last_name=data["last_name"],
                phone=data["phone"],
                status=DriverStatus.AVAILABLE,
                designation="driver",
            )
            db.add(driver)
            await db.flush()
            created_drivers.append(driver)
            print(f"  Created: {driver.employee_code} {driver.first_name} {driver.last_name} (id={driver.id})")

        await db.commit()

        # Re-fetch drivers to get fresh IDs
        for i, driver in enumerate(created_drivers):
            await db.refresh(driver)

        # Assign one driver per vehicle
        for i, vehicle in enumerate(vehicles):
            if i >= len(created_drivers):
                break
            driver = created_drivers[i]
            vehicle.default_driver_id = driver.id
            print(f"  Assigned {driver.first_name} {driver.last_name} -> {vehicle.registration_number}")

        await db.commit()
        print(f"\nDone: {len(created_drivers)} drivers created/updated, assigned to {min(len(vehicles), len(created_drivers))} vehicles.")


if __name__ == "__main__":
    asyncio.run(main())
