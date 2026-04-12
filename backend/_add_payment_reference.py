import asyncio, sys
sys.path.insert(0, '.')
from app.db.postgres.connection import AsyncSessionLocal
from sqlalchemy import text

async def fix():
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text(
                "ALTER TABLE driver_settlements ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100)"
            ))
            await db.commit()
            print("OK - payment_reference column added")
        except Exception as e:
            await db.rollback()
            print(f"ERROR: {e}")

asyncio.run(fix())
