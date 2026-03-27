"""Reset passwords for all seed users to known values."""
import asyncio
from app.db.postgres.connection import get_db
from app.core.security import get_password_hash
from sqlalchemy import text

# Map email → new password
RESET_MAP = {
    "admin@kavyatransports.com":       "admin123",
    "manager@kavyatransports.com":     "manager123",
    "fleet@kavyatransports.com":       "fleet123",
    "accountant@kavyatransports.com":  "accountant123",
    "pa@kavyatransports.com":          "pa123456",
    "driver@kavyatransports.com":      "driver123",
    "pump@kavyatransports.com":        "pump123",
}

async def reset():
    async for db in get_db():
        for email, pw in RESET_MAP.items():
            h = get_password_hash(pw)
            await db.execute(
                text("UPDATE users SET password_hash = :h WHERE email = :e"),
                {"h": h, "e": email}
            )
            print(f"  ✓  {email}  →  {pw}")
        await db.commit()
        print("\nAll passwords reset successfully.")
        break

asyncio.run(reset())
