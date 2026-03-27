import asyncio
from sqlalchemy import select
from app.db.postgres.connection import AsyncSessionLocal
from app.models.postgres.user import User

async def main():
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(User.id, User.email, User.is_active).order_by(User.id.desc()).limit(15))).all()
        for r in rows:
            print(r.id, r.email, r.is_active)

asyncio.run(main())
