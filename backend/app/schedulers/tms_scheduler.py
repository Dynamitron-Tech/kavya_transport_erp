"""
TMS Automation Scheduler
========================
APScheduler-based cron jobs for all scheduled automations.

Registered in app/main.py lifespan.

Jobs:
  EVT-07  00:01 daily   — mark overdue invoices
  SCH-01  08:00 daily   — document expiry digest to fleet_manager
  SCH-02  09:00 Monday  — weekly payment reminders to accountant/manager
  SCH-03  07:00 daily   — predictive maintenance by odometer
  SCH-04  08:00 1st/mth — monthly P&L summary to admin/manager
  SCH-05  06:00 Sunday  — fuel efficiency anomaly detection
  SCH-06  09:00 daily   — stale trip detection
  GPS-01  every 60s     — iALERT GPS poll (Ashok Leyland telematics)
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")
    return _scheduler


def start_tms_scheduler() -> None:
    """Create and start the APScheduler with all TMS job schedules."""
    from app.services.tms_automation_service import (
        evt_07_mark_overdue_invoices,
        sch_01_expiry_digest,
        sch_02_payment_reminders,
        sch_03_predictive_maintenance,
        sch_04_monthly_pnl,
        sch_05_fuel_efficiency,
        sch_06_stale_trips,
    )

    scheduler = get_scheduler()

    # EVT-07: Mark overdue invoices — daily at 00:01
    scheduler.add_job(
        evt_07_mark_overdue_invoices,
        trigger=CronTrigger(hour=0, minute=1),
        id="evt_07_mark_overdue",
        replace_existing=True,
        name="EVT-07: Mark overdue invoices",
    )

    # SCH-01: Document expiry digest — daily at 08:00
    scheduler.add_job(
        sch_01_expiry_digest,
        trigger=CronTrigger(hour=8, minute=0),
        id="sch_01_expiry_digest",
        replace_existing=True,
        name="SCH-01: Document expiry digest",
    )

    # SCH-02: Weekly payment reminders — Monday at 09:00
    scheduler.add_job(
        sch_02_payment_reminders,
        trigger=CronTrigger(day_of_week="mon", hour=9, minute=0),
        id="sch_02_payment_reminders",
        replace_existing=True,
        name="SCH-02: Weekly payment reminders",
    )

    # SCH-03: Predictive maintenance — daily at 07:00
    scheduler.add_job(
        sch_03_predictive_maintenance,
        trigger=CronTrigger(hour=7, minute=0),
        id="sch_03_predictive_maintenance",
        replace_existing=True,
        name="SCH-03: Predictive maintenance",
    )

    # SCH-04: Monthly P&L — 1st of month at 08:00
    scheduler.add_job(
        sch_04_monthly_pnl,
        trigger=CronTrigger(day=1, hour=8, minute=0),
        id="sch_04_monthly_pnl",
        replace_existing=True,
        name="SCH-04: Monthly P&L summary",
    )

    # SCH-05: Fuel efficiency anomaly — Sunday at 06:00
    scheduler.add_job(
        sch_05_fuel_efficiency,
        trigger=CronTrigger(day_of_week="sun", hour=6, minute=0),
        id="sch_05_fuel_efficiency",
        replace_existing=True,
        name="SCH-05: Fuel efficiency anomaly",
    )

    # SCH-06: Stale trip detection — daily at 09:00
    scheduler.add_job(
        sch_06_stale_trips,
        trigger=CronTrigger(hour=9, minute=0),
        id="sch_06_stale_trips",
        replace_existing=True,
        name="SCH-06: Stale trip detection",
    )

    # GPS-01: iALERT GPS poll — every N seconds (Ashok Leyland telematics)
    from app.core.config import settings
    if settings.IALERT_ENABLED and settings.IALERT_API_TOKEN:
        from app.services.ialert_gps_service import poll_and_ingest
        scheduler.add_job(
            poll_and_ingest,
            trigger=IntervalTrigger(seconds=settings.IALERT_POLL_INTERVAL_SECONDS),
            id="gps_01_ialert_poll",
            replace_existing=True,
            name="GPS-01: iALERT GPS poll",
            max_instances=1,  # Prevent overlapping polls
        )
        logger.info("GPS-01: iALERT polling enabled (every %ds)", settings.IALERT_POLL_INTERVAL_SECONDS)
    else:
        logger.info("GPS-01: iALERT polling disabled (IALERT_ENABLED=False or no token)")

    scheduler.start()
    logger.info("TMS Automation Scheduler started with 7 jobs")


def stop_tms_scheduler() -> None:
    """Gracefully shut down the scheduler."""
    scheduler = get_scheduler()
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("TMS Automation Scheduler stopped")
