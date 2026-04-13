import asyncio, sys, os
sys.path.insert(0, '.')

async def test():
    from app.db.postgres.connection import AsyncSessionLocal
    from sqlalchemy import text

    async with AsyncSessionLocal() as db:
        # Check tyre_alerts columns
        q1 = "SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name='tyre_alerts' ORDER BY ordinal_position"
        r = await db.execute(text(q1))
        print('tyre_alerts columns:')
        for row in r.fetchall():
            print(' ', row)

        # Check tyre_readings columns
        q2 = "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='tyre_readings' ORDER BY ordinal_position"
        r2 = await db.execute(text(q2))
        print('tyre_readings columns:')
        for row in r2.fetchall():
            print(' ', row)

        # Try a full reading + alert insert (mimicking the endpoint with PSI=32 < 80)
        from app.models.postgres.vehicle import (
            TyreReading, TyreReadingCondition, TyreAlert,
            TyreAlertType, TyreAlertSeverity, TyreAlertStatus
        )
        from sqlalchemy import select

        reading = TyreReading(
            vehicle_tyre_id=None,
            vehicle_id=10,
            position='2R1',
            psi=32.0,
            tread_depth_mm=1.0,
            condition=TyreReadingCondition.GOOD,
            temperature_c=32.0,
            driver_id=1,
            odometer_at_reading=70100,
        )
        db.add(reading)
        await db.flush()
        print('Reading INSERT OK, id=', reading.id)

        # Try inserting an alert (PSI 32 < critical 60)
        alert = TyreAlert(
            vehicle_tyre_id=None,
            vehicle_id=10,
            position='2R1',
            alert_type=TyreAlertType.CRITICAL_PSI,
            severity=TyreAlertSeverity.CRITICAL,
            current_value=32.0,
            threshold_value=60.0,
            status=TyreAlertStatus.OPEN,
            source='field',
        )
        db.add(alert)
        await db.flush()
        print('Alert INSERT OK, id=', alert.id)

        await db.rollback()
        print('All OK — rollback done')

asyncio.run(test())
