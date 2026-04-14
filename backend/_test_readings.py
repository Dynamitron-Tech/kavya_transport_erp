"""Test tyre readings insert to diagnose 500 error."""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://transport_erp:password@127.0.0.1:5432/transport_erp"

async def main():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # 1. Check column nullability
        result = await session.execute(text(
            "SELECT column_name, is_nullable FROM information_schema.columns "
            "WHERE table_name='tyre_readings' AND column_name='vehicle_tyre_id'"
        ))
        row = result.fetchone()
        print(f"\n=== vehicle_tyre_id is_nullable: {row} ===\n")

        # 2. Check if table exists and get all columns
        result = await session.execute(text(
            "SELECT column_name, is_nullable, data_type FROM information_schema.columns "
            "WHERE table_name='tyre_readings' ORDER BY ordinal_position"
        ))
        cols = result.fetchall()
        print("Columns in tyre_readings:")
        for c in cols:
            print(f"  {c[0]}: {c[2]}, nullable={c[1]}")

        # 3. Get a real vehicle_id to test with
        v = await session.execute(text("SELECT id FROM vehicles LIMIT 1"))
        vid = v.scalar()
        print(f"\nTest vehicle_id: {vid}")

        if vid:
            # 4. Try inserting with vehicle_tyre_id=NULL
            try:
                await session.execute(text(
                    "INSERT INTO tyre_readings "
                    "(vehicle_tyre_id, vehicle_id, position, psi, condition, created_at, updated_at) "
                    "VALUES (NULL, :vid, 'FL', 85.0, 'GOOD', NOW(), NOW())"
                ), {"vid": vid})
                await session.commit()
                print("\n✅ Insert with NULL vehicle_tyre_id SUCCEEDED")
            except Exception as e:
                await session.rollback()
                print(f"\n❌ Insert FAILED: {e}")

asyncio.run(main())
