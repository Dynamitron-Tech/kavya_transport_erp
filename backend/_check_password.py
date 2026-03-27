import asyncio
from passlib.context import CryptContext
from app.db.postgres.connection import get_db
from sqlalchemy import text

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def check():
    async for db in get_db():
        result = await db.execute(
            text("SELECT id, email, password_hash, is_active FROM users ORDER BY id LIMIT 20")
        )
        rows = result.fetchall()
        print(f"\nFound {len(rows)} users:\n")
        for r in rows:
            print(f"  id={r[0]}  email={r[1]}  is_active={r[3]}  hash={r[2][:30] if r[2] else 'NULL'}...")

        # Check admin specifically
        result2 = await db.execute(
            text("SELECT password_hash FROM users WHERE email = 'admin@kavyatransports.com'")
        )
        row = result2.fetchone()
        if not row:
            print("\nAdmin user NOT found!")
            return

        h = row[0]
        candidates = [
            "admin123", "Admin123", "admin@123", "Admin@123",
            "kavya123", "Kavya123", "kavya@123", "Kavya@123",
            "password", "admin", "transport123",
            "Admin@2024", "Admin@2026", "Admin2024", "Admin2026",
            "kavya2024", "Kavya2024", "kavya2026", "Kavya2026",
            "admin1234", "admin@1234", "Admin@1234",
            "123456", "password123",
        ]
        print("\nTrying common passwords against admin@kavyatransports.com ...")
        matched = False
        for p in candidates:
            try:
                if pwd_context.verify(p, h):
                    print(f"\n  ✓ MATCH FOUND: password = '{p}'\n")
                    matched = True
                    break
            except Exception as e:
                print(f"  Error with {p!r}: {e}")
        if not matched:
            print("  None matched. Reset the password using --reset option.\n")
        break

asyncio.run(check())
