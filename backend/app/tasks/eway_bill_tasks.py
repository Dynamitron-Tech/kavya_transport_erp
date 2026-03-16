# E-way Bill Tasks — background sync
import logging
import asyncio

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _sync_active():
    """Sync status of active E-way bills with government portal."""
    from app.db.postgres.connection import async_session_factory
    from sqlalchemy import select
    from app.models.postgres.eway_bill import EwayBill, EwayBillStatus
    from app.services import eway_bill_api_service

    async with async_session_factory() as db:
        result = await db.execute(
            select(EwayBill).where(
                EwayBill.is_deleted == False,
                EwayBill.status.in_([EwayBillStatus.ACTIVE, EwayBillStatus.GENERATED]),
            )
        )
        bills = result.scalars().all()
        updated = 0
        for bill in bills:
            if bill.eway_bill_number:
                details = await eway_bill_api_service.get_eway_bill_details(bill.eway_bill_number)
                if details.get("status") == "CANCELLED":
                    bill.status = EwayBillStatus.CANCELLED
                    updated += 1
        await db.commit()
        logger.info(f"E-way bill sync: {updated} of {len(bills)} updated")
        return {"total": len(bills), "updated": updated}


@celery_app.task(name="app.tasks.eway_bill_tasks.sync_active_eway_bills")
def sync_active_eway_bills():
    """Celery task: Sync active E-way bills."""
    return _run_async(_sync_active())
