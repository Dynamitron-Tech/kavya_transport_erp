"""Seed Data Script - Create initial database records for testing.

Usage:
    cd backend
    python seed_data.py
"""
import asyncio
import sys
import os
from datetime import date, datetime, timedelta
from decimal import Decimal

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.postgres.connection import AsyncSessionLocal, async_engine
from app.models.postgres.base import Base
from app.models.postgres.user import User, Role, UserRole, RoleType, Branch, Tenant
from app.models.postgres.client import Client, ClientContact
from app.models.postgres.vehicle import Vehicle, VehicleType, VehicleStatus, OwnershipType
from app.models.postgres.driver import Driver, DriverLicense
from app.models.postgres.job import Job, JobStatusEnum
from app.models.postgres.lr import LR, LRItem, LRStatus, PaymentMode
from app.models.postgres.trip import Trip, TripStatusEnum
from app.models.postgres.route import Route, BankAccount
from app.models.postgres.finance import Vendor, Invoice, InvoiceItem, InvoiceStatus
from app.core.security import get_password_hash


async def create_tables():
    """Drop all tables with CASCADE and recreate."""
    async with async_engine.begin() as conn:
        # Use raw SQL to drop schema with CASCADE
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO postgres"))
        # Now create all tables fresh
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] Database tables dropped and recreated")


async def seed_roles(db: AsyncSession):
    """Create default roles."""
    roles = [
        {"name": "admin", "display_name": "Administrator", "role_type": RoleType.ADMIN, "is_system": True},
        {"name": "manager", "display_name": "Manager", "role_type": RoleType.MANAGER, "is_system": True},
        {"name": "fleet_manager", "display_name": "Fleet Manager", "role_type": RoleType.FLEET_MANAGER, "is_system": True},
        {"name": "accountant", "display_name": "Accountant", "role_type": RoleType.ACCOUNTANT, "is_system": True},
        {"name": "project_associate", "display_name": "Project Associate", "role_type": RoleType.PROJECT_ASSOCIATE, "is_system": True},
        {"name": "driver", "display_name": "Driver", "role_type": RoleType.DRIVER, "is_system": True},
    ]
    created = []
    for role_data in roles:
        from sqlalchemy import select
        existing = await db.execute(select(Role).where(Role.name == role_data["name"]))
        if not existing.scalar_one_or_none():
            role = Role(**role_data)
            db.add(role)
            created.append(role_data["name"])
    await db.flush()
    print(f"✅ Roles created: {created or 'already exist'}")


async def seed_admin_user(db: AsyncSession):
    """Create admin user."""
    from sqlalchemy import select

    # Check if admin exists
    result = await db.execute(select(User).where(User.email == "admin@kavyatransports.com"))
    if result.scalar_one_or_none():
        print("✅ Admin user already exists")
        return

    user = User(
        email="admin@kavyatransports.com",
        phone="9876543210",
        password_hash=get_password_hash("admin123"),
        first_name="Admin",
        last_name="User",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    await db.flush()

    # Assign admin role
    role_result = await db.execute(select(Role).where(Role.name == "admin"))
    admin_role = role_result.scalar_one_or_none()
    if admin_role:
        db.add(UserRole(user_id=user.id, role_id=admin_role.id))
        await db.flush()

    print(f"✅ Admin user created: admin@kavyatransports.com / admin123")


async def seed_demo_users(db: AsyncSession):
    """Create demo users for each role (for quick login testing)."""
    from sqlalchemy import select

    demo_users = [
        {"email": "manager@kavyatransports.com", "first_name": "Demo", "last_name": "Manager", "role": "manager"},
        {"email": "fleet@kavyatransports.com", "first_name": "Demo", "last_name": "FleetManager", "role": "fleet_manager"},
        {"email": "accountant@kavyatransports.com", "first_name": "Demo", "last_name": "Accountant", "role": "accountant"},
        {"email": "pa@kavyatransports.com", "first_name": "Demo", "last_name": "ProjectAssociate", "role": "project_associate"},
        {"email": "driver@kavyatransports.com", "first_name": "Demo", "last_name": "Driver", "role": "driver"},
    ]

    created = []
    for user_data in demo_users:
        # Check if user exists
        result = await db.execute(select(User).where(User.email == user_data["email"]))
        if result.scalar_one_or_none():
            continue

        user = User(
            email=user_data["email"],
            phone=f"98765{len(created)+10000}",
            password_hash=get_password_hash("demo123"),
            first_name=user_data["first_name"],
            last_name=user_data["last_name"],
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.flush()

        # Assign role
        role_result = await db.execute(select(Role).where(Role.name == user_data["role"]))
        role = role_result.scalar_one_or_none()
        if role:
            db.add(UserRole(user_id=user.id, role_id=role.id))
            await db.flush()

        created.append(f"{user_data['role']}:{user_data['email']}")

    print(f"✅ Demo users created: {created or 'already exist'}")


async def seed_clients(db: AsyncSession):
    """Create sample clients."""
    from sqlalchemy import select

    clients_data = [
        {
            "name": "Reliance Industries Ltd",
            "code": "REL001",
            "client_type": "premium",
            "email": "logistics@ril.com",
            "phone": "02222785000",
            "address_line1": "Maker Chambers IV, 222 Nariman Point",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400021",
            "gstin": "27AAACR5055K1ZS",
            "credit_limit": Decimal("5000000"),
            "credit_days": 30,
        },
        {
            "name": "Tata Steel Ltd",
            "code": "TAT001",
            "client_type": "premium",
            "email": "transport@tatasteel.com",
            "phone": "06572325522",
            "address_line1": "Bombay House, 24 Homi Mody Street",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001",
            "gstin": "27AAACT2727Q1ZX",
            "credit_limit": Decimal("3000000"),
            "credit_days": 45,
        },
        {
            "name": "ACC Cement",
            "code": "ACC001",
            "client_type": "regular",
            "email": "logistics@acclimited.com",
            "phone": "02233024567",
            "address_line1": "121 ACC House, Lala Lajpat Rai Road",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400034",
            "gstin": "27AAACA1234K1Z1",
            "credit_limit": Decimal("1000000"),
            "credit_days": 30,
        },
    ]

    created = []
    for client_data in clients_data:
        existing = await db.execute(select(Client).where(Client.code == client_data["code"]))
        if not existing.scalar_one_or_none():
            client = Client(**client_data)
            db.add(client)
            await db.flush()

            # Add contact
            contact = ClientContact(
                client_id=client.id,
                name=f"{client_data['name']} Manager",
                designation="Logistics Manager",
                phone=client_data["phone"],
                email=client_data["email"],
                is_primary=True,
            )
            db.add(contact)
            created.append(client_data["code"])

    await db.flush()
    print(f"✅ Clients created: {created or 'already exist'}")


async def seed_vehicles(db: AsyncSession):
    """Create sample vehicles."""
    from sqlalchemy import select

    vehicles_data = [
        {
            "registration_number": "MH04AB1234",
            "vehicle_type": VehicleType.TRUCK,
            "make": "TATA",
            "model": "LPT 1613",
            "year_of_manufacture": 2022,
            "capacity_tons": Decimal("16"),
            "num_tyres": 10,
            "ownership_type": OwnershipType.OWNED,
            "status": VehicleStatus.AVAILABLE,
            "fuel_type": "diesel",
            "mileage_per_litre": Decimal("4.5"),
            "fitness_valid_until": date.today() + timedelta(days=180),
            "permit_valid_until": date.today() + timedelta(days=365),
            "insurance_valid_until": date.today() + timedelta(days=300),
            "puc_valid_until": date.today() + timedelta(days=150),
        },
        {
            "registration_number": "MH04CD5678",
            "vehicle_type": VehicleType.TRAILER,
            "make": "ASHOK LEYLAND",
            "model": "Captain 4019",
            "year_of_manufacture": 2021,
            "capacity_tons": Decimal("25"),
            "num_tyres": 14,
            "ownership_type": OwnershipType.OWNED,
            "status": VehicleStatus.AVAILABLE,
            "fuel_type": "diesel",
            "mileage_per_litre": Decimal("3.8"),
            "fitness_valid_until": date.today() + timedelta(days=200),
            "permit_valid_until": date.today() + timedelta(days=400),
            "insurance_valid_until": date.today() + timedelta(days=250),
            "puc_valid_until": date.today() + timedelta(days=120),
        },
        {
            "registration_number": "MH04EF9012",
            "vehicle_type": VehicleType.TANKER,
            "make": "BHARAT BENZ",
            "model": "3723C",
            "year_of_manufacture": 2023,
            "capacity_tons": Decimal("20"),
            "num_tyres": 12,
            "ownership_type": OwnershipType.LEASED,
            "owner_name": "Supreme Logistics Ltd",
            "owner_phone": "9876543000",
            "status": VehicleStatus.AVAILABLE,
            "fuel_type": "diesel",
            "mileage_per_litre": Decimal("4.0"),
            "fitness_valid_until": date.today() + timedelta(days=350),
            "permit_valid_until": date.today() + timedelta(days=500),
            "insurance_valid_until": date.today() + timedelta(days=400),
            "puc_valid_until": date.today() + timedelta(days=180),
        },
        {
            "registration_number": "MH04GH3456",
            "vehicle_type": VehicleType.CONTAINER,
            "make": "EICHER",
            "model": "Pro 6040",
            "year_of_manufacture": 2020,
            "capacity_tons": Decimal("18"),
            "num_tyres": 10,
            "ownership_type": OwnershipType.ATTACHED,
            "owner_name": "Ganesh Transporters",
            "owner_phone": "9876544000",
            "status": VehicleStatus.MAINTENANCE,
            "fuel_type": "diesel",
            "mileage_per_litre": Decimal("4.2"),
            "fitness_valid_until": date.today() + timedelta(days=90),
            "permit_valid_until": date.today() + timedelta(days=200),
            "insurance_valid_until": date.today() + timedelta(days=150),
            "puc_valid_until": date.today() + timedelta(days=60),
        },
        {
            "registration_number": "MH04IJ7890",
            "vehicle_type": VehicleType.LCV,
            "make": "MAHINDRA",
            "model": "Bolero Pickup",
            "year_of_manufacture": 2023,
            "capacity_tons": Decimal("1.5"),
            "num_tyres": 4,
            "ownership_type": OwnershipType.OWNED,
            "status": VehicleStatus.AVAILABLE,
            "fuel_type": "diesel",
            "mileage_per_litre": Decimal("12.0"),
            "fitness_valid_until": date.today() + timedelta(days=400),
            "permit_valid_until": date.today() + timedelta(days=500),
            "insurance_valid_until": date.today() + timedelta(days=450),
            "puc_valid_until": date.today() + timedelta(days=200),
        },
    ]

    created = []
    for vehicle_data in vehicles_data:
        existing = await db.execute(select(Vehicle).where(Vehicle.registration_number == vehicle_data["registration_number"]))
        if not existing.scalar_one_or_none():
            vehicle = Vehicle(**vehicle_data)
            db.add(vehicle)
            created.append(vehicle_data["registration_number"])

    await db.flush()
    print(f"✅ Vehicles created: {created or 'already exist'}")


async def seed_drivers(db: AsyncSession):
    """Create sample drivers."""
    from sqlalchemy import select
    from app.models.postgres.driver import DriverStatus, LicenseType

    drivers_data = [
        {
            "employee_code": "DRV001",
            "first_name": "Ramesh",
            "last_name": "Sharma",
            "phone": "9876500001",
            "email": "ramesh.sharma@kavyatransports.com",
            "date_of_birth": date(1985, 5, 15),
            "date_of_joining": date(2020, 1, 10),
            "permanent_address": "123 MG Road, Andheri East",
            "current_address": "123 MG Road, Andheri East",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400069",
            "aadhaar_number": "123456789012",
            "pan_number": "ABCDE1234F",
            "status": DriverStatus.AVAILABLE,
            "salary_type": "monthly",
            "base_salary": Decimal("35000"),
            "per_km_rate": Decimal("3.5"),
        },
        {
            "employee_code": "DRV002",
            "first_name": "Suresh",
            "last_name": "Patil",
            "phone": "9876500002",
            "email": "suresh.patil@kavyatransports.com",
            "date_of_birth": date(1990, 8, 22),
            "date_of_joining": date(2021, 3, 15),
            "permanent_address": "456 Station Road, Thane",
            "current_address": "456 Station Road, Thane",
            "city": "Thane",
            "state": "Maharashtra",
            "pincode": "400601",
            "aadhaar_number": "234567890123",
            "pan_number": "BCDEF2345G",
            "status": DriverStatus.AVAILABLE,
            "salary_type": "monthly",
            "base_salary": Decimal("32000"),
            "per_km_rate": Decimal("3.0"),
        },
        {
            "employee_code": "DRV003",
            "first_name": "Mahesh",
            "last_name": "Verma",
            "phone": "9876500003",
            "email": "mahesh.verma@kavyatransports.com",
            "date_of_birth": date(1988, 12, 10),
            "date_of_joining": date(2019, 6, 1),
            "permanent_address": "789 Highway Colony, Pune",
            "current_address": "789 Highway Colony, Pune",
            "city": "Pune",
            "state": "Maharashtra",
            "pincode": "411001",
            "aadhaar_number": "345678901234",
            "pan_number": "CDEFG3456H",
            "status": DriverStatus.AVAILABLE,
            "salary_type": "monthly",
            "base_salary": Decimal("38000"),
            "per_km_rate": Decimal("4.0"),
        },
    ]

    created = []
    for driver_data in drivers_data:
        existing = await db.execute(select(Driver).where(Driver.employee_code == driver_data["employee_code"]))
        if not existing.scalar_one_or_none():
            driver = Driver(**driver_data)
            db.add(driver)
            await db.flush()

            # Add license
            license_data = DriverLicense(
                driver_id=driver.id,
                license_number=f"MH03{driver_data['employee_code']}000",
                license_type=LicenseType.HMV,
                issue_date=date.today() - timedelta(days=365 * 3),
                expiry_date=date.today() + timedelta(days=365 * 2),
                issuing_authority="RTO Mumbai",
            )
            db.add(license_data)
            created.append(driver_data["employee_code"])

    await db.flush()
    print(f"[OK] Drivers created: {created or 'already exist'}")


async def seed_routes(db: AsyncSession):
    """Create sample routes."""
    from sqlalchemy import select

    routes_data = [
        {
            "route_code": "MUM-PUN",
            "route_name": "Mumbai to Pune",
            "origin_city": "Mumbai",
            "origin_state": "Maharashtra",
            "destination_city": "Pune",
            "destination_state": "Maharashtra",
            "distance_km": Decimal("150"),
            "estimated_hours": Decimal("4"),
            "toll_gates": 3,
        },
        {
            "route_code": "MUM-AHM",
            "route_name": "Mumbai to Ahmedabad",
            "origin_city": "Mumbai",
            "origin_state": "Maharashtra",
            "destination_city": "Ahmedabad",
            "destination_state": "Gujarat",
            "distance_km": Decimal("530"),
            "estimated_hours": Decimal("9"),
            "toll_gates": 8,
        },
        {
            "route_code": "MUM-BLR",
            "route_name": "Mumbai to Bangalore",
            "origin_city": "Mumbai",
            "origin_state": "Maharashtra",
            "destination_city": "Bangalore",
            "destination_state": "Karnataka",
            "distance_km": Decimal("980"),
            "estimated_hours": Decimal("16"),
            "toll_gates": 12,
        },
    ]

    created = []
    for route_data in routes_data:
        existing = await db.execute(select(Route).where(Route.route_code == route_data["route_code"]))
        if not existing.scalar_one_or_none():
            route = Route(**route_data)
            db.add(route)
            created.append(route_data["route_code"])

    await db.flush()
    print(f"✅ Routes created: {created or 'already exist'}")


async def seed_bank_accounts(db: AsyncSession):
    """Create sample bank accounts."""
    from sqlalchemy import select

    accounts_data = [
        {
            "account_name": "Kavya Transports Current Account",
            "account_number": "12345678901234",
            "bank_name": "HDFC Bank",
            "branch_name": "Mumbai Main",
            "ifsc_code": "HDFC0001234",
            "account_type": "current",
            "current_balance": Decimal("500000"),
            "is_default": True,
        },
        {
            "account_name": "Kavya Transports Savings",
            "account_number": "98765432109876",
            "bank_name": "ICICI Bank",
            "branch_name": "Andheri East",
            "ifsc_code": "ICIC0005678",
            "account_type": "savings",
            "current_balance": Decimal("250000"),
            "is_default": False,
        },
    ]

    created = []
    for account_data in accounts_data:
        existing = await db.execute(select(BankAccount).where(BankAccount.account_number == account_data["account_number"]))
        if not existing.scalar_one_or_none():
            account = BankAccount(**account_data)
            db.add(account)
            created.append(account_data["account_number"][-4:])

    await db.flush()
    print(f"✅ Bank accounts created: {created or 'already exist'}")


async def seed_vendors(db: AsyncSession):
    """Create sample vendors."""
    from sqlalchemy import select

    vendors_data = [
        {
            "name": "Indian Oil Corporation",
            "code": "IOCL001",
            "vendor_type": "fuel",
            "phone": "18002425115",
            "email": "bulk@iocl.com",
            "gstin": "06AAACI8577H1ZL",
        },
        {
            "name": "MRF Tyres Ltd",
            "code": "MRF001",
            "vendor_type": "tyre",
            "phone": "04424321000",
            "email": "sales@mrftyres.com",
            "gstin": "33AABCM2456K1ZP",
        },
        {
            "name": "Bosch Service Center",
            "code": "BOSCH001",
            "vendor_type": "maintenance",
            "phone": "02222784500",
            "email": "service@boschindia.com",
            "gstin": "27AABCB1234K1ZQ",
        },
    ]

    created = []
    for vendor_data in vendors_data:
        existing = await db.execute(select(Vendor).where(Vendor.code == vendor_data["code"]))
        if not existing.scalar_one_or_none():
            vendor = Vendor(**vendor_data)
            db.add(vendor)
            created.append(vendor_data["code"])

    await db.flush()
    print(f"✅ Vendors created: {created or 'already exist'}")


async def seed_sample_job(db: AsyncSession):
    """Create a sample job with LR and trip."""
    from sqlalchemy import select

    # Check if sample job exists
    result = await db.execute(select(Job).where(Job.job_number == "JOB-250312-0001"))
    if result.scalar_one_or_none():
        print("✅ Sample job already exists")
        return

    # Get client
    client_result = await db.execute(select(Client).where(Client.code == "REL001"))
    client = client_result.scalar_one_or_none()
    if not client:
        print("⚠️ Client not found, skipping sample job")
        return

    # Get vehicle and driver
    vehicle_result = await db.execute(select(Vehicle).where(Vehicle.registration_number == "MH04AB1234"))
    vehicle = vehicle_result.scalar_one_or_none()

    driver_result = await db.execute(select(Driver).where(Driver.employee_code == "DRV001"))
    driver = driver_result.scalar_one_or_none()

    if not vehicle or not driver:
        print("⚠️ Vehicle or driver not found, skipping sample job")
        return

    # Create Job
    job = Job(
        job_number="JOB-250312-0001",
        job_date=date.today(),
        client_id=client.id,
        origin_address="Maker Chambers IV, 222 Nariman Point",
        origin_city="Mumbai",
        origin_state="Maharashtra",
        destination_address="Hadapsar Industrial Area",
        destination_city="Pune",
        destination_state="Maharashtra",
        material_type="Polymer Granules",
        quantity=Decimal("1000"),
        quantity_unit="kgs",
        status=JobStatusEnum.APPROVED,
        approved_by=1,
        rate_type="per_trip",
        agreed_rate=Decimal("25000"),
        total_amount=Decimal("25000"),
    )
    db.add(job)
    await db.flush()

    # Create LR
    lr = LR(
        lr_number="LR-250312-0001",
        lr_date=date.today(),
        job_id=job.id,
        consignor_name="Reliance Industries Ltd",
        consignor_address="Maker Chambers IV, 222 Nariman Point, Mumbai",
        consignor_gstin="27AAACR5055K1ZS",
        consignor_phone="02222785000",
        consignee_name="Reliance Warehouse Pune",
        consignee_address="Hadapsar Industrial Area, Pune",
        consignee_phone="02026127000",
        origin="Mumbai",
        destination="Pune",
        vehicle_id=vehicle.id,
        driver_id=driver.id,
        payment_mode=PaymentMode.TO_BE_BILLED,
        freight_amount=Decimal("25000"),
        total_freight=Decimal("25000"),
        status=LRStatus.GENERATED,
    )
    db.add(lr)
    await db.flush()

    # Add LR Item
    lr_item = LRItem(
        lr_id=lr.id,
        item_number=1,
        description="Polymer Granules",
        hsn_code="39012000",
        packages=50,
        package_type="bags",
        quantity=Decimal("1000"),
        quantity_unit="kgs",
        actual_weight=Decimal("1000"),
        charged_weight=Decimal("1000"),
    )
    db.add(lr_item)
    await db.flush()

    # Create Trip
    trip = Trip(
        trip_number="TRP-250312-0001",
        trip_date=date.today(),
        job_id=job.id,
        vehicle_id=vehicle.id,
        vehicle_registration=vehicle.registration_number,
        driver_id=driver.id,
        driver_name=f"{driver.first_name} {driver.last_name}",
        driver_phone=driver.phone,
        origin="Mumbai",
        destination="Pune",
        planned_distance_km=Decimal("150"),
        status=TripStatusEnum.PLANNED,
        budgeted_expense=Decimal("8000"),
        revenue=Decimal("25000"),
    )
    db.add(trip)
    await db.flush()

    # Link LR to Trip
    lr.trip_id = trip.id
    await db.flush()

    print("✅ Sample job created: JOB-250312-0001 with LR and Trip")


async def main():
    """Run all seed functions."""
    print("\n🌱 Starting database seeding...\n")

    # Create tables first
    await create_tables()

    async with AsyncSessionLocal() as db:
        try:
            await seed_roles(db)
            await seed_admin_user(db)

            await db.commit()
            print("\n✅ Base seed committed successfully!")
            print("\n📋 Summary:")
            print("   - Admin: admin@kavyatransports.com / admin123")
            print("   - Roles: system roles created")
            print("\n🚀 System bootstrap complete (no demo/mock business records seeded).")

        except Exception as e:
            await db.rollback()
            print(f"\n❌ Error seeding data: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(main())
