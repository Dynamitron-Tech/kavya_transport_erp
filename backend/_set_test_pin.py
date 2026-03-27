"""Set PIN 123456 for driver with user_id=6 (for testing)."""
import asyncio
from sqlalchemy import select
from app.db.postgres.connection import AsyncSessionLocal
from app.models.postgres.driver import Driver
from app.core.security import get_password_hash

async def main():
    async with AsyncSessionLocal() as db:
        r = await db.execute(select(Driver).where(Driver.user_id == 6))
        driver = r.scalar_one_or_none()
        if driver:
            driver.security_pin_hash = get_password_hash("123456")
            await db.commit()
            print(f"PIN set for driver_id={driver.id}")
        else:
            print("No driver with user_id=6")

asyncio.run(main())
