"""Seed driver settlements for testing the My Earnings screen."""
import asyncio
from datetime import date, datetime
from decimal import Decimal

async def main():
    from app.db.postgres.connection import async_engine, AsyncSessionLocal
    from app.models.postgres.finance_automation import DriverSettlement, SettlementStatus
    from app.models.postgres.driver import Driver
    from app.models.postgres.trip import Trip
    from app.utils.generators import generate_settlement_number
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        # Find driver linked to user_id=6
        result = await db.execute(
            select(Driver).where(Driver.user_id == 6, Driver.is_deleted == False)
        )
        driver = result.scalar_one_or_none()
        if not driver:
            # Fallback: check all drivers
            result = await db.execute(select(Driver).where(Driver.is_deleted == False))
            drivers = result.scalars().all()
            for d in drivers:
                print(f"  Driver id={d.id}, user_id={d.user_id}, name={d.first_name} {d.last_name}")
            if drivers:
                driver = drivers[0]
            else:
                print("No drivers found!")
                return

        print(f"Using driver: id={driver.id}, user_id={driver.user_id}, name={driver.first_name} {driver.last_name}")

        # Find completed trips for this driver
        trip_result = await db.execute(
            select(Trip).where(
                Trip.driver_id == driver.id,
                Trip.is_deleted == False,
            ).order_by(Trip.trip_date.desc())
        )
        trips = trip_result.scalars().all()
        print(f"Found {len(trips)} trips for driver {driver.id}")

        # Check existing settlements
        existing = await db.execute(
            select(DriverSettlement).where(DriverSettlement.driver_id == driver.id)
        )
        existing_count = len(existing.scalars().all())
        print(f"Existing settlements: {existing_count}")

        if existing_count > 0:
            print("Settlements already exist, skipping seed.")
            return

        # Seed sample settlements
        settlements_data = [
            {
                "trip_id": trips[0].id if len(trips) > 0 else None,
                "trip_date": trips[0].trip_date if len(trips) > 0 else date(2025, 1, 15),
                "gross": Decimal("15000"),
                "advance": Decimal("3000"),
                "expenses": Decimal("2500"),
                "status": SettlementStatus.PAID,
                "paid_date": date(2025, 1, 20),
                "payment_method": "NEFT",
            },
            {
                "trip_id": trips[1].id if len(trips) > 1 else None,
                "trip_date": trips[1].trip_date if len(trips) > 1 else date(2025, 2, 10),
                "gross": Decimal("12000"),
                "advance": Decimal("2000"),
                "expenses": Decimal("1800"),
                "status": SettlementStatus.PAID,
                "paid_date": date(2025, 2, 15),
                "payment_method": "UPI",
            },
            {
                "trip_id": trips[2].id if len(trips) > 2 else None,
                "trip_date": trips[2].trip_date if len(trips) > 2 else date(2025, 6, 5),
                "gross": Decimal("18000"),
                "advance": Decimal("5000"),
                "expenses": Decimal("3200"),
                "status": SettlementStatus.APPROVED,
                "paid_date": None,
                "payment_method": None,
            },
            {
                "trip_id": trips[3].id if len(trips) > 3 else None,
                "trip_date": trips[3].trip_date if len(trips) > 3 else date(2025, 6, 20),
                "gross": Decimal("20000"),
                "advance": Decimal("4000"),
                "expenses": Decimal("2800"),
                "status": SettlementStatus.PENDING,
                "paid_date": None,
                "payment_method": None,
            },
        ]

        for i, sd in enumerate(settlements_data):
            net = sd["gross"] - sd["advance"] - sd["expenses"]
            trip_date = sd["trip_date"]
            settlement = DriverSettlement(
                settlement_number=generate_settlement_number(),
                settlement_date=trip_date,
                driver_id=driver.id,
                trip_id=sd["trip_id"],
                period_from=trip_date,
                period_to=trip_date,
                base_salary=Decimal("0"),
                trip_allowance=Decimal("0"),
                gross_amount=sd["gross"],
                advance_deducted=sd["advance"],
                total_deductions=sd["advance"] + sd["expenses"],
                net_amount=net,
                trips_completed=1,
                total_km=Decimal("350"),
                status=sd["status"],
                paid_date=sd["paid_date"],
                payment_method_str=sd["payment_method"],
            )
            if sd["status"] == SettlementStatus.PAID:
                settlement.paid_at = datetime.utcnow()
            if sd["status"] in (SettlementStatus.APPROVED, SettlementStatus.PAID):
                settlement.approved_at = datetime.utcnow()
                settlement.approved_by = 1
            db.add(settlement)
            print(f"  Created settlement #{i+1}: gross={sd['gross']}, net={net}, status={sd['status'].value}")

        await db.commit()
        print("Done! Seeded 4 driver settlements.")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, ".")
    asyncio.run(main())
