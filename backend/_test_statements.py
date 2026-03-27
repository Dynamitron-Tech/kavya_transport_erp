import asyncio, sys
sys.path.insert(0, '.')

async def main():
    from app.db.postgres.connection import get_db
    from app.models.postgres.finance import Invoice, InvoiceStatus, GSTEntry, Ledger
    from sqlalchemy import select, func
    from datetime import date

    async for db in get_db():
        today = date.today()
        start = today.replace(day=1)
        end = today
        # Revenue
        try:
            r = await db.execute(
                select(func.coalesce(func.sum(Invoice.amount_paid), 0))
                .where(Invoice.is_deleted == False, Invoice.invoice_date >= start,
                       Invoice.invoice_date <= end,
                       Invoice.status.in_([InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID]))
            )
            print('revenue ok:', r.scalar())
        except Exception as e:
            print('revenue error:', e)
        # Expenses
        try:
            e2 = await db.execute(
                select(func.coalesce(func.sum(Ledger.credit), 0))
                .where(Ledger.ledger_type == "payable", Ledger.entry_date >= start, Ledger.entry_date <= end)
            )
            print('expenses ok:', e2.scalar())
        except Exception as ex:
            print('expenses error:', ex)
        # GST
        try:
            g = await db.execute(
                select(func.coalesce(func.sum(GSTEntry.cgst_amount + GSTEntry.sgst_amount + GSTEntry.igst_amount), 0))
                .where(GSTEntry.transaction_type == "outward", GSTEntry.invoice_date >= start, GSTEntry.invoice_date <= end)
            )
            print('gst ok:', g.scalar())
        except Exception as ex:
            print('gst error:', ex)
        break

asyncio.run(main())
