"""
Seed demo accounts for "Rhenius Abraham" — one per non-admin role.
Employee IDs and auto-generated passwords are printed on completion.

Usage:
    cd backend && python seed_rhenius.py
"""
import asyncio
import secrets
import string

from sqlalchemy import select
from app.db.postgres.connection import AsyncSessionLocal
from app.models.postgres.user import User, Role, UserRole
from app.core.security import get_password_hash

PHONE_BASE = "+91747004740"   # last digit varies per account

DEMO_ACCOUNTS = [
    {
        "email": "rhenius.driver@kavya.com",
        "first_name": "Rhenius",
        "last_name": "Abraham",
        "role": "driver",
        "employee_id": "KTD01",
        "phone": "+917470047400",   # real test number — OTP lands here
    },
    {
        "email": "rhenius.pump@kavya.com",
        "first_name": "Rhenius",
        "last_name": "Abraham",
        "role": "pump_operator",
        "employee_id": "KTP01",
        "phone": "+917470047401",
    },
    {
        "email": "rhenius.manager@kavya.com",
        "first_name": "Rhenius",
        "last_name": "Abraham",
        "role": "manager",
        "employee_id": "KTM01",
        "phone": "+917470047402",
    },
    {
        "email": "rhenius.fleet@kavya.com",
        "first_name": "Rhenius",
        "last_name": "Abraham",
        "role": "fleet_manager",
        "employee_id": "KTFM01",
        "phone": "+917470047403",
    },
    {
        "email": "rhenius.accounts@kavya.com",
        "first_name": "Rhenius",
        "last_name": "Abraham",
        "role": "accountant",
        "employee_id": "KTA01",
        "phone": "+917470047404",
    },
    {
        "email": "rhenius.pa@kavya.com",
        "first_name": "Rhenius",
        "last_name": "Abraham",
        "role": "project_associate",
        "employee_id": "KTPA01",
        "phone": "+917470047405",
    },
]


def _gen_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def main():
    async with AsyncSessionLocal() as db:
        results = []
        for acc in DEMO_ACCOUNTS:
            # Check if user already exists
            existing = (
                await db.execute(select(User).where(User.email == acc["email"]))
            ).scalar_one_or_none()
            if existing:
                # Reset employee_id + password
                existing.phone = acc["phone"]
                existing.employee_id = acc["employee_id"]
                plain = _gen_password()
                existing.password_hash = get_password_hash(plain)
                await db.flush()
                results.append((acc["employee_id"], acc["email"], plain, acc["role"], acc["phone"], "(updated)"))
                continue

            # Fetch role
            role_obj = (
                await db.execute(select(Role).where(Role.name == acc["role"]))
            ).scalar_one_or_none()
            if not role_obj:
                print(f"[WARN] Role {acc['role']} not found — skipping {acc['email']}")
                continue

            plain = _gen_password()
            user = User(
                email=acc["email"],
                first_name=acc["first_name"],
                last_name=acc["last_name"],
                phone=acc["phone"],
                password_hash=get_password_hash(plain),
                employee_id=acc["employee_id"],
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            await db.flush()
            db.add(UserRole(user_id=user.id, role_id=role_obj.id))

            # Create driver profile if DRIVER role
            if acc["role"] == "driver":
                from app.services.user_service import _ensure_driver_profile_for_user
                await _ensure_driver_profile_for_user(db, user)

            await db.flush()
            results.append((acc["employee_id"], acc["email"], plain, acc["role"], acc["phone"], "(created)"))

        await db.commit()

    print("\n" + "=" * 80)
    print("  DEMO ACCOUNTS — RHENIUS ABRAHAM")
    print("  Note: KTD01 uses real WhatsApp number +91 7470047400 for OTP")
    print("=" * 80)
    print(f"{'Emp ID':<10}  {'Role':<20}  {'Phone':<16}  {'Password':<16}  Status")
    print("-" * 80)
    for emp_id, email, pwd, role, phone, status in results:
        print(f"{emp_id:<10}  {role:<20}  {phone:<16}  {pwd:<16}  {status}")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
