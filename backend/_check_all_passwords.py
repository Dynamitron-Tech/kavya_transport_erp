import asyncio
from passlib.context import CryptContext
from app.db.postgres.connection import get_db
from sqlalchemy import text

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

CANDIDATES = [
    "admin123", "Admin123", "kavya123", "Kavya123",
    "manager123", "fleet123", "accountant123", "pa123",
    "driver123", "Driver123", "password", "password123",
    "test123", "Test123", "kavya@123", "123456",
]

async def check():
    async for db in get_db():
        result = await db.execute(
            text("SELECT email, password_hash FROM users WHERE is_active = true ORDER BY id")
        )
        rows = result.fetchall()
        print("\n--- Password check for all active users ---\n")
        for email, h in rows:
            if not h:
                print(f"{email}: NO HASH")
                continue
            found = None
            for p in CANDIDATES:
                try:
                    if pwd_context.verify(p, h):
                        found = p
                        break
                except Exception:
                    pass
            print(f"{email}: {'password = ' + repr(found) if found else 'NO MATCH in common list'}")
        break

asyncio.run(check())
