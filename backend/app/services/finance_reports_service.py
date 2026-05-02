# Finance Reports Service — daily digest, weekly P&L, monthly close, GSTR-1
# Transport ERP

import json
import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.postgres.finance import (
    Invoice, InvoiceStatus, Payment, PaymentStatus,
    Ledger, LedgerType, GSTEntry, Receivable, Payable,
)
from app.models.postgres.finance_automation import FinanceReportCache
from app.models.postgres.route import BankAccount

logger = logging.getLogger(__name__)


async def generate_daily_digest(db: AsyncSession, report_date: date = None) -> dict:
    """
    Group 7.1 — Daily finance digest.
    Summary of day's invoices, payments, collections, outstanding.
    """
    report_date = report_date or date.today()

    # Invoices created today
    inv_result = await db.execute(
        select(
            func.count(Invoice.id),
            func.coalesce(func.sum(Invoice.total_amount), 0),
        ).where(
            Invoice.invoice_date == report_date,
            Invoice.is_deleted == False,
        )
    )
    inv_count, inv_total = inv_result.one()

    # Payments received today
    pay_result = await db.execute(
        select(
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        ).where(
            Payment.payment_date == report_date,
            Payment.payment_type == "received",
            Payment.status == PaymentStatus.COMPLETED,
            Payment.is_deleted == False,
        )
    )
    pay_count, pay_total = pay_result.one()

    # Payments made today
    paid_result = await db.execute(
        select(
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        ).where(
            Payment.payment_date == report_date,
            Payment.payment_type == "paid",
            Payment.status == PaymentStatus.COMPLETED,
            Payment.is_deleted == False,
        )
    )
    paid_count, paid_total = paid_result.one()

    # Outstanding receivables
    recv_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.amount_due), 0)).where(
            Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]),
            Invoice.is_deleted == False,
        )
    )
    total_receivable = recv_result.scalar() or 0

    # Overdue count
    overdue_result = await db.execute(
        select(func.count(Invoice.id)).where(
            Invoice.status == InvoiceStatus.OVERDUE,
            Invoice.is_deleted == False,
        )
    )
    overdue_count = overdue_result.scalar() or 0

    # Bank balances
    bank_result = await db.execute(
        select(
            func.count(BankAccount.id),
            func.coalesce(func.sum(BankAccount.current_balance), 0),
        ).where(BankAccount.is_active == True, BankAccount.is_deleted == False)
    )
    bank_count, bank_total = bank_result.one()

    report = {
        "date": report_date.isoformat(),
        "invoices": {"count": int(inv_count), "total": float(inv_total)},
        "collections": {"count": int(pay_count), "total": float(pay_total)},
        "payments_made": {"count": int(paid_count), "total": float(paid_total)},
        "outstanding_receivable": float(total_receivable),
        "overdue_invoices": int(overdue_count),
        "bank_balance": {"accounts": int(bank_count), "total": float(bank_total)},
        "net_cash_flow": float(Decimal(str(pay_total)) - Decimal(str(paid_total))),
    }

    # Cache the report
    await _cache_report(db, "daily_digest", report_date, report_date, report_date, report)
    return report


async def generate_weekly_pl(db: AsyncSession, week_ending: date = None) -> dict:
    """
    Group 7.2 — Weekly Profit & Loss report.
    """
    week_ending = week_ending or date.today()
    week_start = week_ending - timedelta(days=6)

    # Revenue: payments received in the week
    rev_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.payment_date.between(week_start, week_ending),
            Payment.payment_type == "received",
            Payment.status == PaymentStatus.COMPLETED,
            Payment.is_deleted == False,
        )
    )
    revenue = Decimal(str(rev_result.scalar() or 0))

    # Expenses: payments made in the week
    exp_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.payment_date.between(week_start, week_ending),
            Payment.payment_type == "paid",
            Payment.status == PaymentStatus.COMPLETED,
            Payment.is_deleted == False,
        )
    )
    expenses = Decimal(str(exp_result.scalar() or 0))

    # Ledger breakdown
    ledger_result = await db.execute(
        select(
            Ledger.ledger_type,
            func.coalesce(func.sum(Ledger.debit), 0),
            func.coalesce(func.sum(Ledger.credit), 0),
        ).where(
            Ledger.entry_date.between(week_start, week_ending),
        ).group_by(Ledger.ledger_type)
    )
    ledger_breakdown = {}
    for lt, debit, credit in ledger_result.all():
        key = lt.value if hasattr(lt, 'value') else str(lt)
        ledger_breakdown[key] = {"debit": float(debit), "credit": float(credit)}

    net_profit = revenue - expenses

    report = {
        "period": {"from": week_start.isoformat(), "to": week_ending.isoformat()},
        "revenue": float(revenue),
        "expenses": float(expenses),
        "net_profit": float(net_profit),
        "margin_percent": float(net_profit / revenue * 100) if revenue > 0 else 0,
        "ledger_breakdown": ledger_breakdown,
    }

    await _cache_report(db, "weekly_pl", week_ending, week_start, week_ending, report)
    return report


async def generate_monthly_close(db: AsyncSession, year: int, month: int) -> dict:
    """
    Group 7.3 — Monthly close report.
    """
    month_start = date(year, month, 1)
    if month == 12:
        month_end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(year, month + 1, 1) - timedelta(days=1)

    # Invoiced amount
    inv_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.total_amount), 0)).where(
            Invoice.invoice_date.between(month_start, month_end),
            Invoice.is_deleted == False,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
    )
    total_invoiced = Decimal(str(inv_result.scalar() or 0))

    # Collected
    coll_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.payment_date.between(month_start, month_end),
            Payment.payment_type == "received",
            Payment.status == PaymentStatus.COMPLETED,
            Payment.is_deleted == False,
        )
    )
    total_collected = Decimal(str(coll_result.scalar() or 0))

    # Paid out
    paid_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.payment_date.between(month_start, month_end),
            Payment.payment_type == "paid",
            Payment.status == PaymentStatus.COMPLETED,
            Payment.is_deleted == False,
        )
    )
    total_paid = Decimal(str(paid_result.scalar() or 0))

    # Outstanding receivables at month end
    recv_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.amount_due), 0)).where(
            Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]),
            Invoice.is_deleted == False,
        )
    )
    outstanding_recv = Decimal(str(recv_result.scalar() or 0))

    # Outstanding payables
    payable_result = await db.execute(
        select(func.coalesce(func.sum(Payable.total_outstanding), 0))
    )
    outstanding_pay = Decimal(str(payable_result.scalar() or 0))

    report = {
        "period": {"year": year, "month": month, "from": month_start.isoformat(), "to": month_end.isoformat()},
        "total_invoiced": float(total_invoiced),
        "total_collected": float(total_collected),
        "total_paid_out": float(total_paid),
        "net_profit": float(total_collected - total_paid),
        "outstanding_receivables": float(outstanding_recv),
        "outstanding_payables": float(outstanding_pay),
        "collection_rate": float(total_collected / total_invoiced * 100) if total_invoiced > 0 else 0,
    }

    await _cache_report(db, "monthly_close", month_end, month_start, month_end, report)
    return report


async def generate_gstr1_data(db: AsyncSession, year: int, month: int) -> dict:
    """
    Group 7.4 — GSTR-1 data preparation.
    Aggregates all outward supply invoices for the tax period.
    """
    tax_period = f"{year}{month:02d}"
    month_start = date(year, month, 1)
    if month == 12:
        month_end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(year, month + 1, 1) - timedelta(days=1)

    # Get all issued invoices for the month
    inv_result = await db.execute(
        select(Invoice).where(
            Invoice.invoice_date.between(month_start, month_end),
            Invoice.is_deleted == False,
            Invoice.status != InvoiceStatus.CANCELLED,
            Invoice.invoice_type == InvoiceStatus.PAID.name,  # just TAX_INVOICE
        ).order_by(Invoice.invoice_date)
    )
    # Actually get all non-cancelled invoices
    inv_result2 = await db.execute(
        select(Invoice).where(
            Invoice.invoice_date.between(month_start, month_end),
            Invoice.is_deleted == False,
            Invoice.status != InvoiceStatus.CANCELLED,
        ).order_by(Invoice.invoice_date)
    )
    invoices = inv_result2.scalars().all()

    b2b_invoices = []
    total_taxable = Decimal("0")
    total_cgst = Decimal("0")
    total_sgst = Decimal("0")
    total_igst = Decimal("0")
    total_value = Decimal("0")

    for inv in invoices:
        taxable = Decimal(str(inv.taxable_amount or 0))
        cgst = Decimal(str(inv.cgst_amount or 0))
        sgst = Decimal(str(inv.sgst_amount or 0))
        igst = Decimal(str(inv.igst_amount or 0))
        total = Decimal(str(inv.total_amount or 0))

        b2b_invoices.append({
            "invoice_number": inv.invoice_number,
            "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
            "gstin": inv.billing_gstin or "",
            "party_name": inv.billing_name or "",
            "taxable_value": float(taxable),
            "cgst": float(cgst),
            "sgst": float(sgst),
            "igst": float(igst),
            "total": float(total),
        })

        total_taxable += taxable
        total_cgst += cgst
        total_sgst += sgst
        total_igst += igst
        total_value += total

    report = {
        "tax_period": tax_period,
        "period": {"from": month_start.isoformat(), "to": month_end.isoformat()},
        "invoice_count": len(invoices),
        "b2b_invoices": b2b_invoices,
        "summary": {
            "total_taxable_value": float(total_taxable),
            "total_cgst": float(total_cgst),
            "total_sgst": float(total_sgst),
            "total_igst": float(total_igst),
            "total_tax": float(total_cgst + total_sgst + total_igst),
            "total_value": float(total_value),
        },
    }

    await _cache_report(db, "gstr1", month_end, month_start, month_end, report)
    return report


async def get_cached_report(db: AsyncSession, report_type: str, report_date: date) -> dict | None:
    """Get a cached report."""
    result = await db.execute(
        select(FinanceReportCache).where(
            FinanceReportCache.report_type == report_type,
            FinanceReportCache.report_date == report_date,
        )
    )
    cache = result.scalar_one_or_none()
    if cache and cache.report_data:
        return json.loads(cache.report_data)
    return None


async def _cache_report(
    db: AsyncSession, report_type: str, report_date: date,
    period_from: date, period_to: date, data: dict,
) -> None:
    """Cache a report result."""
    result = await db.execute(
        select(FinanceReportCache).where(
            FinanceReportCache.report_type == report_type,
            FinanceReportCache.report_date == report_date,
        )
    )
    cache = result.scalar_one_or_none()

    if cache:
        cache.report_data = json.dumps(data, default=str)
        cache.total_revenue = Decimal(str(data.get("total_collected", data.get("revenue", 0)) or 0))
        cache.total_expenses = Decimal(str(data.get("total_paid_out", data.get("expenses", 0)) or 0))
        cache.net_profit = Decimal(str(data.get("net_profit", 0) or 0))
    else:
        cache = FinanceReportCache(
            report_type=report_type,
            report_date=report_date,
            period_from=period_from,
            period_to=period_to,
            report_data=json.dumps(data, default=str),
            total_revenue=Decimal(str(data.get("total_collected", data.get("revenue", 0)) or 0)),
            total_expenses=Decimal(str(data.get("total_paid_out", data.get("expenses", 0)) or 0)),
            net_profit=Decimal(str(data.get("net_profit", 0) or 0)),
        )
        db.add(cache)

    await db.flush()
