"""Quick test of GET /expenses logic."""
import asyncio
from app.db.postgres.connection import AsyncSessionLocal
from sqlalchemy import text, select, func
from app.models.postgres.trip import TripExpense


async def main():
    async with AsyncSessionLocal() as db:
        # Check all expenses
        total_all = (await db.execute(select(func.count(TripExpense.id)))).scalar() or 0
        print(f"Total expenses in DB: {total_all}")

        # Check per user
        for uid in [1, 2, 3, 4, 5]:
            q = select(func.count(TripExpense.id)).where(TripExpense.entered_by == uid)
            cnt = (await db.execute(q)).scalar() or 0
            if cnt > 0:
                print(f"  user_id={uid}: {cnt} expenses")

        # Simulate serialization for ALL rows
        rows = (
            await db.execute(
                select(TripExpense).order_by(TripExpense.expense_date.desc()).limit(10)
            )
        ).scalars().all()
        print(f"\nSerializing {len(rows)} rows:")
        for e in rows:
            try:
                item = {
                    "id": e.id,
                    "trip_id": e.trip_id,
                    "category": e.category.value if hasattr(e.category, "value") else str(e.category),
                    "amount": float(e.amount),
                    "payment_mode": e.payment_mode,
                    "description": e.description,
                    "expense_date": e.expense_date.isoformat() if e.expense_date else None,
                    "is_verified": bool(e.is_verified),
                }
                print(f"  OK: {item}")
            except Exception as ex:
                print(f"  ERROR serializing id={e.id}: {type(ex).__name__}: {ex}")


asyncio.run(main())
