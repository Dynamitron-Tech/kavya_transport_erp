"""Diagnose 500 on POST /tyre/readings"""
import asyncio
import os
import sys
os.chdir(os.path.dirname(__file__))
sys.path.insert(0, '.')

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

async def test():
    from app.core.config import settings
    engine = create_async_engine(settings.POSTGRES_URL, echo=False)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as db:
        # Check last_reading_at column
        r = await db.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='vehicle_tyres' AND column_name='last_reading_at'"
        ))
        col = r.scalar()
        print(f"last_reading_at in vehicle_tyres: {col}")

        # Check tyre_readings count
        r2 = await db.execute(text("SELECT COUNT(*) FROM tyre_readings"))
        print(f"tyre_readings row count: {r2.scalar()}")

        # Get a real vehicle_id
        v = await db.execute(text("SELECT id FROM vehicles LIMIT 1"))
        vid = v.scalar()
        print(f"Test vehicle_id: {vid}")

        if vid:
            from app.models.postgres.vehicle import TyreReading, TyreReadingCondition
            reading = TyreReading(
                vehicle_tyre_id=None,
                vehicle_id=vid,
                position='FL',
                psi=85.0,
                tread_depth_mm=7.5,
                condition=TyreReadingCondition.GOOD,
            )
            db.add(reading)
            try:
                await db.flush()
                print(f"ORM flush OK, reading.id={reading.id}")
                await db.rollback()
            except Exception as e:
                await db.rollback()
                print(f"ORM flush FAILED: {type(e).__name__}: {e}")

    await engine.dispose()

asyncio.run(test())
