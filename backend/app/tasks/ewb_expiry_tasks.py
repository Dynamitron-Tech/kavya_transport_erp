# EWB Expiry Checking Celery Tasks — alerts + compliance checks
import asyncio
import logging
from datetime import datetime, timedelta

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="app.tasks.ewb_expiry_tasks.check_ewb_expiry")
def check_ewb_expiry():
    """Every 30 min — Check active/in-transit EWBs for approaching expiry.
    Sends alerts at 8h, 4h, 1h before expiry and marks expired EWBs.
    """
    logger.info("Running EWB expiry check")

    async def _run():
        from app.db.postgres.connection import AsyncSessionLocal
        from sqlalchemy import select, and_
        from app.models.postgres.eway_bill import EwayBill, EwayBillStatus
        from app.models.postgres.finance_automation import FinanceAlert, AlertType, AlertSeverity

        async with AsyncSessionLocal() as db:
            now = datetime.utcnow()
            alerts_sent = 0

            # 8-hour alert
            cutoff_8h = now + timedelta(hours=8)
            result = await db.execute(
                select(EwayBill).where(
                    and_(
                        EwayBill.is_deleted == False,
                        EwayBill.status.in_([EwayBillStatus.ACTIVE, EwayBillStatus.IN_TRANSIT]),
                        EwayBill.valid_until <= cutoff_8h,
                        EwayBill.valid_until > now,
                        EwayBill.alert_8h_sent == False,
                    )
                )
            )
            for bill in result.scalars().all():
                bill.alert_8h_sent = True
                hours_left = (bill.valid_until - now).total_seconds() / 3600
                alert = FinanceAlert(
                    alert_type=AlertType.RECONCILIATION_EXCEPTION,
                    severity=AlertSeverity.WARNING,
                    title=f"EWB {bill.eway_bill_number} expiring in {hours_left:.0f}h",
                    message=f"E-Way Bill for vehicle {bill.vehicle_number} expires at {bill.valid_until.strftime('%d/%m/%Y %H:%M')}. Extend or complete delivery.",
                )
                db.add(alert)
                alerts_sent += 1
                logger.info(f"8h alert: EWB {bill.eway_bill_number}")

            # 4-hour alert
            cutoff_4h = now + timedelta(hours=4)
            result = await db.execute(
                select(EwayBill).where(
                    and_(
                        EwayBill.is_deleted == False,
                        EwayBill.status.in_([EwayBillStatus.ACTIVE, EwayBillStatus.IN_TRANSIT]),
                        EwayBill.valid_until <= cutoff_4h,
                        EwayBill.valid_until > now,
                        EwayBill.alert_4h_sent == False,
                    )
                )
            )
            for bill in result.scalars().all():
                bill.alert_4h_sent = True
                hours_left = (bill.valid_until - now).total_seconds() / 3600
                alert = FinanceAlert(
                    alert_type=AlertType.RECONCILIATION_EXCEPTION,
                    severity=AlertSeverity.CRITICAL,
                    title=f"URGENT: EWB {bill.eway_bill_number} expiring in {hours_left:.0f}h",
                    message=f"E-Way Bill for vehicle {bill.vehicle_number} expires SOON. Immediate action required.",
                )
                db.add(alert)
                alerts_sent += 1

            # 1-hour alert
            cutoff_1h = now + timedelta(hours=1)
            result = await db.execute(
                select(EwayBill).where(
                    and_(
                        EwayBill.is_deleted == False,
                        EwayBill.status.in_([EwayBillStatus.ACTIVE, EwayBillStatus.IN_TRANSIT]),
                        EwayBill.valid_until <= cutoff_1h,
                        EwayBill.valid_until > now,
                        EwayBill.alert_1h_sent == False,
                    )
                )
            )
            for bill in result.scalars().all():
                bill.alert_1h_sent = True
                alert = FinanceAlert(
                    alert_type=AlertType.RECONCILIATION_EXCEPTION,
                    severity=AlertSeverity.CRITICAL,
                    title=f"CRITICAL: EWB {bill.eway_bill_number} expires in < 1 hour!",
                    message=f"E-Way Bill for vehicle {bill.vehicle_number} is about to expire! Extend immediately or face penalty.",
                )
                db.add(alert)
                alerts_sent += 1

            # Mark expired
            expired_result = await db.execute(
                select(EwayBill).where(
                    and_(
                        EwayBill.is_deleted == False,
                        EwayBill.status.in_([EwayBillStatus.ACTIVE, EwayBillStatus.IN_TRANSIT]),
                        EwayBill.valid_until <= now,
                    )
                )
            )
            expired_count = 0
            for bill in expired_result.scalars().all():
                bill.status = EwayBillStatus.EXPIRED
                expired_count += 1
                logger.warning(f"EWB {bill.eway_bill_number} EXPIRED")

            await db.commit()
            logger.info(f"EWB expiry check: {alerts_sent} alerts, {expired_count} expired")
            return {"alerts_sent": alerts_sent, "expired": expired_count}

    return _run_async(_run())


@celery_app.task(name="app.tasks.ewb_expiry_tasks.trip_dispatched_ewb_check")
def trip_dispatched_ewb_check(trip_id: int, db=None) -> dict:
    """Called before trip status → IN_TRANSIT. Checks for valid EWB.
    Can be called directly with an existing db session or as a Celery task.
    """
    logger.info(f"Checking EWB compliance for trip {trip_id}")

    async def _check(session):
        from sqlalchemy import select, and_
        from app.models.postgres.eway_bill import EwayBill, EwayBillStatus

        result = await session.execute(
            select(EwayBill).where(
                and_(
                    EwayBill.is_deleted == False,
                    EwayBill.trip_id == trip_id,
                    EwayBill.status.in_([
                        EwayBillStatus.GENERATED,
                        EwayBillStatus.ACTIVE,
                        EwayBillStatus.IN_TRANSIT,
                    ]),
                )
            )
        )
        bills = result.scalars().all()
        if not bills:
            return {"valid": False, "reason": "No valid E-Way Bill found for this trip. Generate EWB first."}

        for bill in bills:
            if bill.valid_until and bill.valid_until < datetime.utcnow():
                return {"valid": False, "reason": f"EWB {bill.eway_bill_number} expired. Extend or regenerate before dispatch."}

        return {"valid": True, "ewb_numbers": [b.eway_bill_number for b in bills]}

    # If called directly with a db session (from trip_service), use it
    if db is not None:
        # We're already in an async context — just await
        return _check(db)

    # Called as Celery task — create own session
    async def _run():
        from app.db.postgres.connection import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            return await _check(session)

    return _run_async(_run())


@celery_app.task(name="app.tasks.ewb_expiry_tasks.trip_delivered_ewb_complete")
def trip_delivered_ewb_complete(trip_id: int, db=None):
    """Called when trip → COMPLETED. Marks linked EWBs as completed.
    Can be called directly with an existing db session or as a Celery task.
    """
    logger.info(f"Completing EWBs for trip {trip_id}")

    async def _complete(session, should_commit=True):
        from sqlalchemy import select, and_
        from app.models.postgres.eway_bill import EwayBill, EwayBillStatus

        result = await session.execute(
            select(EwayBill).where(
                and_(
                    EwayBill.is_deleted == False,
                    EwayBill.trip_id == trip_id,
                    EwayBill.status.in_([
                        EwayBillStatus.ACTIVE,
                        EwayBillStatus.IN_TRANSIT,
                        EwayBillStatus.EXTENDED,
                    ]),
                )
            )
        )
        count = 0
        for bill in result.scalars().all():
            bill.status = EwayBillStatus.COMPLETED
            count += 1
        if should_commit:
            await session.commit()
        else:
            await session.flush()
        logger.info(f"Completed {count} EWBs for trip {trip_id}")

    # If called directly with a db session (from trip_service)
    if db is not None:
        return _complete(db, should_commit=False)

    # Called as Celery task — create own session
    async def _run():
        from app.db.postgres.connection import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            await _complete(session, should_commit=True)

    return _run_async(_run())
