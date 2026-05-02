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
    """Check all vehicles and drivers for expiring documents and generate alerts."""
    from app.db.postgres.connection import AsyncSessionLocal
    from sqlalchemy import select
    from app.models.postgres.document import Document

    async with AsyncSessionLocal() as db:
        today = date.today()
        threshold = today + timedelta(days=90)

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
            days_left = (doc.expiry_date - today).days

            if days_left <= 0:
                severity = "expired"
            elif days_left <= 7:
                severity = "critical"
            elif days_left <= 30:
                severity = "warning"
            elif days_left <= (doc.reminder_days or 30):
                severity = "info"
            else:
                continue

            entity_type = doc.entity_type.value if hasattr(doc.entity_type, 'value') else str(doc.entity_type) if doc.entity_type else "unknown"
            doc_type = doc.document_type.value if hasattr(doc.document_type, 'value') else str(doc.document_type) if doc.document_type else "document"

            alerts.append({
                "doc_id": doc.id,
                "doc_number": doc.doc_number,
                "document_type": doc_type,
                "entity_type": entity_type,
                "entity_id": doc.entity_id,
                "expiry_date": str(doc.expiry_date),
                "days_left": days_left,
                "severity": severity,
                "message": f"{doc_type} {'has EXPIRED' if days_left <= 0 else f'expires in {days_left} day(s)'}",
            })

        await db.commit()

        # Also check E-Way Bill expiry
        ewb_alerts = await _check_eway_bill_expiry(db)
        alerts.extend(ewb_alerts)

        logger.info(f"Compliance check: {len(alerts)} alerts ({len(ewb_alerts)} EWB)")

        # Broadcast critical/expired alerts via WebSocket
        critical_alerts = [a for a in alerts if a["severity"] in ("expired", "critical")]
        if critical_alerts:
            try:
                from app.websocket.manager import ws_manager
                await ws_manager.broadcast({
                    "type": "compliance_alert",
                    "count": len(critical_alerts),
                    "alerts": critical_alerts,
                }, channel="general")
                logger.info(f"Broadcast {len(critical_alerts)} critical compliance alerts")
            except Exception as e:
                logger.warning(f"Could not broadcast compliance alerts: {e}")

        return alerts


async def _check_eway_bill_expiry(db):
    """Check for E-Way Bills expiring within 24 hours or already expired."""
    from sqlalchemy import select
    from app.models.postgres.eway_bill import EwayBill
    from datetime import datetime

    now = datetime.utcnow()
    threshold = now + timedelta(hours=24)

    result = await db.execute(
        select(EwayBill).where(
            EwayBill.is_deleted == False,
            EwayBill.valid_until != None,
            EwayBill.valid_until <= threshold,
            EwayBill.status != "cancelled",
        )
    )
    expiring_ewbs = result.scalars().all()

    alerts = []
    for ewb in expiring_ewbs:
        hours_left = (ewb.valid_until - now).total_seconds() / 3600

        if hours_left <= 0:
            severity = "expired"
        elif hours_left <= 6:
            severity = "critical"
        else:
            severity = "warning"

        alerts.append({
            "doc_id": ewb.id,
            "doc_number": ewb.eway_bill_number,
            "document_type": "eway_bill",
            "entity_type": "job",
            "entity_id": ewb.job_id,
            "expiry_date": str(ewb.valid_until),
            "days_left": max(0, int(hours_left / 24)),
            "hours_left": round(hours_left, 1),
            "severity": severity,
            "message": f"E-Way Bill {ewb.eway_bill_number} {'has EXPIRED' if hours_left <= 0 else f'expires in {round(hours_left, 1)} hour(s)'}",
        })

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
