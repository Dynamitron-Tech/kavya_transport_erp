"""Test driver API endpoints."""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.postgres.connection import AsyncSessionLocal
from app.models.postgres.user import User
from sqlalchemy import select

async def get_driver_id():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == 'driver@kavyatransports.com'))
        user = result.scalar_one_or_none()
        if user:
            print(f"Driver user id: {user.id}")
        else:
            print("Driver not found")

asyncio.run(get_driver_id())
