# Finance Automation Celery Tasks — scheduled cron jobs
# Transport ERP

import asyncio
import logging
from datetime import date

from app.celery_app import celery_app
from app.db.postgres.connection import AsyncSessionLocal

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run async coroutine from sync celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="app.tasks.finance_tasks.detect_overdue_invoices")
def detect_overdue_invoices():
    """Daily 7 AM — Detect overdue invoices and update status."""
    logger.info("Running overdue invoice detection")

    async def _run():
        async with AsyncSessionLocal() as db:
            from app.services.invoice_automation_service import detect_overdue_invoices
            result = await detect_overdue_invoices(db)
            await db.commit()
            return result

    result = _run_async(_run())
    logger.info(f"Overdue detection complete: {len(result)} invoices flagged")
    return len(result)


@celery_app.task(name="app.tasks.finance_tasks.recalculate_aging")
def recalculate_aging():
    """Daily 7:30 AM — Recalculate receivable aging buckets."""
    logger.info("Running receivable aging recalculation")

    async def _run():
        async with AsyncSessionLocal() as db:
            from app.services.settlement_service import recalculate_receivable_aging
            count = await recalculate_receivable_aging(db)
            await db.commit()
            return count

    count = _run_async(_run())
    logger.info(f"Aging recalculation complete: {count} clients updated")
    return count


@celery_app.task(name="app.tasks.finance_tasks.check_payable_due_dates")
def check_payable_due_dates():
    """Daily 8 AM — Check supplier payable due dates and generate alerts."""
    logger.info("Running payable due date check")

    async def _run():
        async with AsyncSessionLocal() as db:
            from app.services.settlement_service import check_payable_due_dates
            alerts = await check_payable_due_dates(db)
            await db.commit()
            return alerts

    alerts = _run_async(_run())
    logger.info(f"Payable due date check complete: {len(alerts)} alerts created")
    return len(alerts)


@celery_app.task(name="app.tasks.finance_tasks.check_low_bank_balance")
def check_low_bank_balance():
    """Daily 9 AM — Check bank balances and alert if low."""
    logger.info("Running low bank balance check")

    async def _run():
        async with AsyncSessionLocal() as db:
            from app.services.settlement_service import check_low_bank_balance
            alerts = await check_low_bank_balance(db)
            await db.commit()
            return alerts

    alerts = _run_async(_run())
    logger.info(f"Low balance check complete: {len(alerts)} alerts")
    return len(alerts)


@celery_app.task(name="app.tasks.finance_tasks.generate_daily_digest")
def generate_daily_digest():
    """Daily 9 PM — Generate daily finance digest report."""
    logger.info("Generating daily finance digest")

    async def _run():
        async with AsyncSessionLocal() as db:
            from app.services.finance_reports_service import generate_daily_digest
            report = await generate_daily_digest(db)
            await db.commit()
            return report

    report = _run_async(_run())
    logger.info(f"Daily digest generated: net cash flow = {report.get('net_cash_flow', 0)}")
    return report


@celery_app.task(name="app.tasks.finance_tasks.generate_weekly_pl")
def generate_weekly_pl():
    """Monday 7 AM — Generate weekly P&L report."""
    logger.info("Generating weekly P&L report")

    async def _run():
        async with AsyncSessionLocal() as db:
            from app.services.finance_reports_service import generate_weekly_pl
            report = await generate_weekly_pl(db)
            await db.commit()
            return report

    report = _run_async(_run())
    logger.info(f"Weekly P&L: revenue={report.get('revenue', 0)}, expenses={report.get('expenses', 0)}")
    return report


@celery_app.task(name="app.tasks.finance_tasks.generate_monthly_close")
def generate_monthly_close():
    """1st of month 6 AM — Generate monthly close report for previous month."""
    logger.info("Generating monthly close report")

    async def _run():
        today = date.today()
        if today.month == 1:
            year, month = today.year - 1, 12
        else:
            year, month = today.year, today.month - 1

        async with AsyncSessionLocal() as db:
            from app.services.finance_reports_service import generate_monthly_close
            report = await generate_monthly_close(db, year, month)
            await db.commit()
            return report

    report = _run_async(_run())
    logger.info(f"Monthly close: net_profit={report.get('net_profit', 0)}")
    return report


@celery_app.task(name="app.tasks.finance_tasks.gst_filing_reminder")
def gst_filing_reminder():
    """20th of month — GST filing reminder."""
    logger.info("Sending GST filing reminder")

    async def _run():
        async with AsyncSessionLocal() as db:
            from app.models.postgres.finance_automation import (
                FinanceAlert, FinanceAlertType, FinanceAlertSeverity,
            )
            today = date.today()
            alert = FinanceAlert(
                alert_type=FinanceAlertType.GST_REMINDER,
                severity=FinanceAlertSeverity.WARNING,
                title=f"GST filing reminder for {today.strftime('%B %Y')}",
                message="GSTR-1 filing deadline approaching. Please review and file returns.",
            )
            db.add(alert)
            await db.commit()

    _run_async(_run())
    logger.info("GST filing reminder sent")
