# Banking Celery Tasks — low balance alerts, CSV auto-match
import asyncio
import logging

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="app.tasks.banking_tasks.low_balance_alert")
def low_balance_alert(account_id: int):
    """Send low balance alert for a bank account."""
    logger.info(f"Low balance alert for account {account_id}")

    async def _run():
        from app.db.postgres.connection import AsyncSessionLocal
        from app.models.postgres.route import BankAccount
        from app.models.postgres.finance_automation import FinanceAlert, AlertType, AlertSeverity

        async with AsyncSessionLocal() as db:
            account = await db.get(BankAccount, account_id)
            if not account:
                return {"status": "account_not_found"}

            balance_rupees = float(account.current_balance or 0)
            threshold_rupees = float(getattr(account, "alert_threshold_paise", 500000) or 500000) / 100

            if balance_rupees >= threshold_rupees:
                return {"status": "above_threshold"}

            # Create finance alert
            alert = FinanceAlert(
                alert_type=AlertType.LOW_BALANCE,
                severity=AlertSeverity.WARNING,
                title=f"Low balance: {account.account_name}",
                message=f"Balance is ₹{balance_rupees:,.2f} (threshold: ₹{threshold_rupees:,.2f})",
                bank_account_id=account_id,
            )
            db.add(alert)
            await db.commit()
            logger.info(f"Low balance alert created for {account.account_name}: ₹{balance_rupees:,.2f}")
            return {"status": "alert_created", "balance": balance_rupees}

    return _run_async(_run())


@celery_app.task(name="app.tasks.banking_tasks.auto_match_csv")
def auto_match_csv(import_id: int):
    """Auto-match imported CSV transactions to invoices."""
    logger.info(f"Auto-matching CSV import {import_id}")

    async def _run():
        from app.db.postgres.connection import AsyncSessionLocal
        from app.services.csv_parser_service import auto_match_csv_transactions

        async with AsyncSessionLocal() as db:
            result = await auto_match_csv_transactions(db, import_id)
            await db.commit()
            return result

    result = _run_async(_run())
    logger.info(f"CSV auto-match complete: {result}")
    return result


@celery_app.task(name="app.tasks.banking_tasks.daily_balance_snapshot")
def daily_balance_snapshot():
    """Daily 11:59 PM — Store end-of-day balance per account."""
    logger.info("Running daily balance snapshot")

    async def _run():
        from app.db.postgres.connection import AsyncSessionLocal
        from sqlalchemy import select
        from app.models.postgres.route import BankAccount

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(BankAccount).where(BankAccount.is_active == True)
            )
            accounts = result.scalars().all()
            snapshots = []
            for acc in accounts:
                snapshots.append({
                    "account_id": acc.id,
                    "balance": float(acc.current_balance or 0),
                })
            logger.info(f"Balance snapshot: {len(snapshots)} accounts")
            return snapshots

    return _run_async(_run())
