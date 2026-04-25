import asyncio, sys
sys.path.insert(0, '.')
from app.db.postgres.connection import AsyncSessionLocal
from sqlalchemy import text

async def test():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='driver_settlements' ORDER BY ordinal_position"
        ))
        cols = [r[0] for r in result.all()]
        print('DB columns:', cols)

asyncio.run(test())
