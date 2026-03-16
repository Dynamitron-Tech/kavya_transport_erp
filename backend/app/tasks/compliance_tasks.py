# Compliance Tasks — scheduled checks for vehicle/driver documents
import logging
import asyncio
from datetime import date, timedelta

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run async coroutine from sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _check_compliance():
    """Check all vehicles and drivers for expiring documents."""
    from app.db.postgres.connection import async_session_factory
    from sqlalchemy import select
    from app.models.postgres.document import Document

    async with async_session_factory() as db:
        threshold = date.today() + timedelta(days=30)
        result = await db.execute(
            select(Document).where(
                Document.is_deleted == False,
                Document.expiry_date != None,
                Document.expiry_date <= threshold,
            )
        )
        expiring_docs = result.scalars().all()

        alerts = []
        for doc in expiring_docs:
            days_left = (doc.expiry_date - date.today()).days
            severity = "critical" if days_left <= 7 else "warning"
            alerts.append({
                "doc_id": doc.id,
                "doc_number": doc.doc_number,
                "entity_type": doc.entity_type.value if doc.entity_type else None,
                "entity_id": doc.entity_id,
                "expiry_date": str(doc.expiry_date),
                "days_left": days_left,
                "severity": severity,
            })

        logger.info(f"Compliance check: {len(alerts)} expiring documents found")
        return alerts


@celery_app.task(name="app.tasks.compliance_tasks.check_all_compliance")
def check_all_compliance():
    """Celery task: Run daily compliance check."""
    return _run_async(_check_compliance())


@celery_app.task(name="app.tasks.compliance_tasks.check_vehicle_compliance")
def check_vehicle_compliance(reg_number: str):
    """Check a single vehicle's compliance via VAHAN."""
    from app.services import vahan_service
    return _run_async(vahan_service.full_vehicle_check(reg_number))


@celery_app.task(name="app.tasks.compliance_tasks.check_driver_compliance")
def check_driver_compliance(dl_number: str, dob: str):
    """Check a single driver's licence via Sarathi."""
    from app.services import sarathi_service
    return _run_async(sarathi_service.verify_driving_licence(dl_number, dob))
