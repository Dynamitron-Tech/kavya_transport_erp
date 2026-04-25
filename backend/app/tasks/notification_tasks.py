# Notification Celery Tasks
# Transport ERP — Phase D: Milestone notifications & payment reminders

import logging
from datetime import datetime
from app.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.notification_tasks.send_milestone_notifications")
def send_milestone_notifications():
    """
    Periodic task (every 5 minutes): check for jobs with recent status changes
    and send WhatsApp notifications to customers.
    """
    logger.info("Checking for milestone notifications to send")
    # In production, with async event loop:
    # 1. Query jobs with status changes in last 5 minutes
    # 2. For each job, look up client phone
    # 3. Call whatsapp_service.send_milestone_notification
    #
    # import asyncio
    # from app.db.postgres.connection import async_session_maker
    # from app.models.postgres.job import Job
    # from app.models.postgres.client import Client
    # from app.services.whatsapp_service import send_milestone_notification
    # from sqlalchemy import select
    #
    # async def _run():
    #     async with async_session_maker() as db:
    #         cutoff = datetime.utcnow() - timedelta(minutes=5)
    #         result = await db.execute(
    #             select(Job).where(Job.updated_at >= cutoff)
    #         )
    #         jobs = result.scalars().all()
    #         for job in jobs:
    #             client = await db.get(Client, job.client_id)
    #             if client and client.phone:
    #                 await send_milestone_notification(
    #                     phone=client.phone,
    #                     customer_name=client.name,
    #                     job_number=job.job_number,
    #                     milestone=job.status,
    #                 )
    # asyncio.run(_run())
    logger.info("Milestone notification check complete")


@celery_app.task(name="app.tasks.notification_tasks.send_payment_reminders")
def send_payment_reminders():
    """
    Periodic task (daily at 10 AM): send payment reminders for overdue invoices.
    """
    logger.info("Sending payment reminders for overdue invoices")
    # In production:
    # 1. Query invoices where status = 'overdue' or due_date < today
    # 2. For each, look up client phone
    # 3. Send WhatsApp reminder with invoice number and amount due
    #
    # import asyncio
    # from app.db.postgres.connection import async_session_maker
    # from app.models.postgres.finance import Invoice
    # from app.models.postgres.client import Client
    # from app.services.whatsapp_service import send_whatsapp_message
    # from sqlalchemy import select
    #
    # async def _run():
    #     async with async_session_maker() as db:
    #         result = await db.execute(
    #             select(Invoice).where(Invoice.status == "overdue")
    #         )
    #         invoices = result.scalars().all()
    #         for inv in invoices:
    #             client = await db.get(Client, inv.client_id)
    #             if client and client.phone:
    #                 await send_whatsapp_message(
    #                     phone=client.phone,
    #                     message=f"Hi {client.name}, reminder: Invoice {inv.invoice_number} "
    #                             f"of ₹{inv.amount_due} is overdue. Please clear at your earliest."
    #                 )
    # asyncio.run(_run())
    logger.info("Payment reminder check complete")


# ─────────────────────────────────────────────────────────────────────────────
# EWB EXPIRY NOTIFICATION TASK  (runs every hour)
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(name="app.tasks.notification_tasks.check_ewb_expiry_notify")
def check_ewb_expiry_notify():
    """Hourly: flag EWBs expiring within 6 hours and notify PA + Fleet Manager."""
    import asyncio
    from datetime import timedelta

    async def _run():
        from app.db.postgres.connection import AsyncSessionLocal
        from app.models.postgres.eway_bill import EwayBill
        from app.models.postgres.lr import LR
        from app.services.notification_service import notification_service
        from sqlalchemy import select, and_

        now = datetime.utcnow()
        cutoff = now + timedelta(hours=6)

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(EwayBill, LR)
                .join(LR, LR.id == EwayBill.lr_id, isouter=True)
                .where(
                    and_(
                        EwayBill.status.in_(["active", "generated"]),
                        EwayBill.valid_until <= cutoff,
                        EwayBill.valid_until >= now,
                    )
                )
                .order_by(EwayBill.valid_until.asc())
            )
            rows = result.fetchall()

            for ewb, lr in rows:
                delta = ewb.valid_until - now
                hours_left = delta.total_seconds() / 3600
                lr_num = lr.lr_number if lr else f"LR#{ewb.lr_id}"
                await notification_service.send(
                    db,
                    event_type="EWB_EXPIRY_ALERT",
                    title="EWB EXPIRING SOON",
                    body=f"EWB {ewb.eway_bill_number} for {lr_num} expires in {hours_left:.1f} hrs",
                    target_roles=["PROJECT_ASSOCIATE", "FLEET_MANAGER"],
                    data={"ewb_id": str(ewb.id), "route": f"/pa/ewb/{ewb.id}"},
                    urgency="urgent",
                )
            await db.commit()
            logger.info(f"EWB expiry check: notified for {len(rows)} EWB(s)")

    asyncio.run(_run())


# ─────────────────────────────────────────────────────────────────────────────
# SERVICE DUE NOTIFICATION TASK  (runs daily 7 AM)
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(name="app.tasks.notification_tasks.check_service_due_notify")
def check_service_due_notify():
    """Daily at 7 AM: alert Fleet Manager for vehicles approaching service due."""
    import asyncio

    async def _run():
        from app.db.postgres.connection import AsyncSessionLocal
        from app.models.postgres.vehicle import Vehicle
        from app.services.notification_service import notification_service
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Vehicle).where(Vehicle.is_deleted.is_(False))
            )
            vehicles = result.scalars().all()
            for v in vehicles:
                if v.next_service_km and v.current_odometer_km:
                    km_left = v.next_service_km - v.current_odometer_km
                    if 0 < km_left < 500:
                        await notification_service.send(
                            db,
                            event_type="SERVICE_DUE_SOON",
                            title="Service due soon",
                            body=f"{v.registration_number} service due in {km_left:,.0f} km",
                            target_roles=["FLEET_MANAGER"],
                            urgency="urgent",
                        )
                        await notification_service.send(
                            db,
                            event_type="SERVICE_DUE_ALERT",
                            title="Vehicle service alert",
                            body=f"{v.registration_number} needs service soon",
                            target_roles=["MANAGER"],
                            urgency="normal",
                        )
            await db.commit()
            logger.info("Service due check complete")

    asyncio.run(_run())


# ─────────────────────────────────────────────────────────────────────────────
# OVERDUE INVOICES NOTIFICATION TASK  (runs daily 9 AM)
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(name="app.tasks.notification_tasks.check_overdue_invoices_notify")
def check_overdue_invoices_notify():
    """Daily at 9 AM: alert Admin + Manager for overdue invoices."""
    import asyncio

    async def _run():
        from app.db.postgres.connection import AsyncSessionLocal
        from app.models.postgres.finance import Invoice
        from app.models.postgres.client import Client
        from app.services.notification_service import notification_service
        from sqlalchemy import select, and_
        from datetime import date

        today = date.today()

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Invoice, Client)
                .join(Client, Client.id == Invoice.client_id, isouter=True)
                .where(
                    and_(
                        Invoice.due_date < today,
                        Invoice.status.in_(["pending", "sent", "partially_paid", "overdue"]),
                    )
                )
            )
            rows = result.fetchall()
            for inv, client in rows:
                days_overdue = (today - inv.due_date).days
                client_name = client.name if client else f"Client#{inv.client_id}"
                await notification_service.send(
                    db,
                    event_type="INVOICE_OVERDUE",
                    title="Overdue invoice alert",
                    body=f"{client_name} – {inv.invoice_number} overdue by {days_overdue} days",
                    target_roles=["ADMIN", "MANAGER"],
                    data={"invoice_id": str(inv.id)},
                    urgency="urgent",
                )
            await db.commit()
            logger.info(f"Overdue invoice check: {len(rows)} overdue invoices processed")

    asyncio.run(_run())

