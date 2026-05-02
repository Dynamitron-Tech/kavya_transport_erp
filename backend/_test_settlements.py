import asyncio, sys
sys.path.insert(0, '.')
from app.db.postgres.connection import AsyncSessionLocal
from sqlalchemy import select
from app.models.postgres.finance_automation import DriverSettlement, SettlementStatus
from app.models.postgres.driver import Driver
from app.models.postgres.trip import Trip
from app.models.postgres.user import User

async def test():
    async with AsyncSessionLocal() as db:
        # Test settlements query
        try:
            query = select(DriverSettlement).where(DriverSettlement.is_deleted == False)
            result = await db.execute(query)
            settlements = result.scalars().all()
            print(f'OK settlements - {len(settlements)} rows')
        except Exception as e:
            print(f'ERROR settlements: {e}')

        # Test user banking fields
        try:
            user_result = await db.execute(select(User).limit(1))
            u = user_result.scalar_one_or_none()
            if u:
                bank_name = getattr(u, 'bank_name', 'MISSING')
                acct = getattr(u, 'account_number', 'MISSING')
                print(f'User bank_name={bank_name}, account_number={acct}')
        except Exception as e:
            print(f'ERROR user: {e}')

        # Test with status filter
        try:
            query2 = select(DriverSettlement).where(
                DriverSettlement.is_deleted == False,
                DriverSettlement.status == SettlementStatus.PENDING
            )
            result2 = await db.execute(query2)
            rows2 = result2.scalars().all()
            print(f'OK settlements filtered - {len(rows2)} rows')
        except Exception as e:
            print(f'ERROR settlements filtered: {e}')

asyncio.run(test())
