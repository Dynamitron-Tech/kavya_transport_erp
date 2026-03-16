# Finance Service - Invoice, Payment, Ledger, Banking
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from datetime import datetime, date
from decimal import Decimal

from app.models.postgres.finance import (
    Invoice, InvoiceItem, InvoiceStatus, InvoiceType,
    Payment, PaymentStatus, PaymentMethod,
    Ledger, LedgerType, GSTEntry, Vendor, Receivable, Payable,
)
from app.models.postgres.route import BankAccount, BankTransaction
from app.models.postgres.client import Client
from app.utils.generators import generate_invoice_number, generate_payment_number, generate_ledger_number


def _coerce_enum(enum_cls, raw_value):
    if raw_value is None:
        return None
    if isinstance(raw_value, enum_cls):
        return raw_value

    text = str(raw_value).strip()
    if not text:
        return None

    for member in enum_cls:
        if text.lower() == str(member.value).lower() or text.upper() == member.name.upper():
            return member

    return raw_value


# ==================== INVOICES ====================
async def list_invoices(db: AsyncSession, page: int = 1, limit: int = 20, search: str = None, status: str = None, client_id: int = None):
    query = select(Invoice).where(Invoice.is_deleted == False)
    count_query = select(func.count(Invoice.id)).where(Invoice.is_deleted == False)

    if search:
        sf = or_(Invoice.invoice_number.ilike(f"%{search}%"), Invoice.billing_name.ilike(f"%{search}%"))
        query = query.where(sf)
        count_query = count_query.where(sf)
    if status:
        normalized_status = _coerce_enum(InvoiceStatus, status)
        query = query.where(Invoice.status == normalized_status)
        count_query = count_query.where(Invoice.status == normalized_status)
    if client_id:
        query = query.where(Invoice.client_id == client_id)
        count_query = count_query.where(Invoice.client_id == client_id)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(Invoice.id.desc()))
    return result.scalars().all(), total


async def get_invoice(db: AsyncSession, invoice_id: int):
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.is_deleted == False))
    return result.scalar_one_or_none()


async def create_invoice(db: AsyncSession, data: dict, user_id: int = None) -> Invoice:
    data = dict(data)
    items_data = data.pop("items", [])
    data["invoice_number"] = generate_invoice_number()
    data["created_by"] = user_id
    data["invoice_type"] = _coerce_enum(InvoiceType, data.get("invoice_type", "tax_invoice"))
    data["status"] = _coerce_enum(InvoiceStatus, data.get("status", "draft"))

    # Get client details
    client_result = await db.execute(select(Client).where(Client.id == data["client_id"]))
    client = client_result.scalar_one_or_none()
    if client and not data.get("billing_name"):
        data["billing_name"] = client.name

    # Set company GSTIN from config (or leave None)
    data.setdefault("company_name", "Kavya Transports")

    invoice = Invoice(**data)
    db.add(invoice)
    await db.flush()

    # Add items and calculate totals
    subtotal = Decimal("0")
    for idx, item_data in enumerate(items_data, 1):
        qty = Decimal(str(item_data.get("quantity", 1)))
        rate = Decimal(str(item_data["rate"]))
        amount = qty * rate
        tax_rate = Decimal(str(item_data.get("tax_rate", 18)))
        tax_amount = amount * tax_rate / 100
        total = amount + tax_amount

        item = InvoiceItem(
            invoice_id=invoice.id, item_number=idx,
            description=item_data["description"],
            hsn_sac_code=item_data.get("hsn_sac_code"),
            trip_id=item_data.get("trip_id"),
            lr_id=item_data.get("lr_id"),
            quantity=qty, unit=item_data.get("unit"),
            rate=rate, amount=amount,
            tax_rate=tax_rate, tax_amount=tax_amount, total=total,
        )
        db.add(item)
        subtotal += amount

    # Calculate GST
    discount_pct = Decimal(str(data.get("discount_percent", 0)))
    discount_amount = subtotal * discount_pct / 100
    taxable = subtotal - discount_amount

    # Determine IGST vs CGST+SGST (interstate vs intrastate)
    billing_state = data.get("billing_state_code", "")
    company_state = data.get("company_state_code", "")
    gst_rate = Decimal("18")  # Default 18%

    if billing_state and company_state and billing_state != company_state:
        igst = taxable * gst_rate / 100
        invoice.igst_rate = gst_rate
        invoice.igst_amount = igst
        invoice.cgst_amount = 0
        invoice.sgst_amount = 0
        total_tax = igst
    else:
        half_rate = gst_rate / 2
        cgst = taxable * half_rate / 100
        sgst = taxable * half_rate / 100
        invoice.cgst_rate = half_rate
        invoice.cgst_amount = cgst
        invoice.sgst_rate = half_rate
        invoice.sgst_amount = sgst
        invoice.igst_amount = 0
        total_tax = cgst + sgst

    invoice.subtotal = subtotal
    invoice.discount_amount = discount_amount
    invoice.taxable_amount = taxable
    invoice.total_tax = total_tax
    invoice.total_amount = taxable + total_tax
    invoice.amount_due = invoice.total_amount

    await db.flush()
    return invoice


async def update_invoice(db: AsyncSession, invoice_id: int, data: dict):
    invoice = await get_invoice(db, invoice_id)
    if not invoice:
        return None
    for k, v in data.items():
        if v is not None:
            setattr(invoice, k, v)
    return invoice


async def delete_invoice(db: AsyncSession, invoice_id: int) -> bool:
    invoice = await get_invoice(db, invoice_id)
    if not invoice:
        return False
    invoice.is_deleted = True
    return True


async def get_invoice_with_details(db: AsyncSession, invoice: Invoice) -> dict:
    client_name = None
    if invoice.client_id:
        result = await db.execute(select(Client.name).where(Client.id == invoice.client_id))
        client_name = result.scalar_one_or_none()

    items_result = await db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id).order_by(InvoiceItem.item_number))
    items = items_result.scalars().all()

    return {
        **{c.key: getattr(invoice, c.key) for c in invoice.__table__.columns},
        "client_name": client_name,
        "status": invoice.status.value if hasattr(invoice.status, 'value') else str(invoice.status),
        "invoice_type": invoice.invoice_type.value if hasattr(invoice.invoice_type, 'value') else str(invoice.invoice_type) if invoice.invoice_type else None,
        "items": [{c.key: getattr(item, c.key) for c in item.__table__.columns} for item in items],
    }


# ==================== PAYMENTS ====================
async def list_payments(db: AsyncSession, page: int = 1, limit: int = 20, payment_type: str = None, client_id: int = None):
    query = select(Payment).where(Payment.is_deleted == False)
    count_query = select(func.count(Payment.id)).where(Payment.is_deleted == False)

    if payment_type:
        query = query.where(Payment.payment_type == payment_type)
        count_query = count_query.where(Payment.payment_type == payment_type)
    if client_id:
        query = query.where(Payment.client_id == client_id)
        count_query = count_query.where(Payment.client_id == client_id)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(Payment.id.desc()))
    return result.scalars().all(), total


async def create_payment(db: AsyncSession, data: dict, user_id: int = None) -> Payment:
    data["payment_number"] = generate_payment_number()
    data["created_by"] = user_id

    # Calculate net amount
    amount = Decimal(str(data["amount"]))
    tds = Decimal(str(data.get("tds_amount", 0)))
    data["net_amount"] = amount - tds

    payment = Payment(**data)
    db.add(payment)
    await db.flush()

    # Update invoice if linked
    if payment.invoice_id:
        inv = await get_invoice(db, payment.invoice_id)
        if inv:
            inv.amount_paid = Decimal(str(inv.amount_paid or 0)) + amount
            inv.amount_due = Decimal(str(inv.total_amount or 0)) - Decimal(str(inv.amount_paid or 0))
            if inv.amount_due <= 0:
                inv.status = InvoiceStatus.PAID
                inv.amount_due = 0
            else:
                inv.status = InvoiceStatus.PARTIALLY_PAID

    # Create ledger entry
    ledger_data = {
        "entry_date": data["payment_date"],
        "account_name": "Accounts Receivable" if data["payment_type"] == "received" else "Accounts Payable",
        "client_id": data.get("client_id"),
        "vendor_id": data.get("vendor_id"),
        "invoice_id": data.get("invoice_id"),
        "payment_id": payment.id,
        "narration": data.get("remarks", f"Payment {payment.payment_number}"),
        "reference_type": "payment",
        "reference_number": payment.payment_number,
    }
    if data["payment_type"] == "received":
        ledger_data["ledger_type"] = "receivable"
        ledger_data["debit"] = float(amount)
        ledger_data["credit"] = 0
    else:
        ledger_data["ledger_type"] = "payable"
        ledger_data["debit"] = 0
        ledger_data["credit"] = float(amount)

    await create_ledger_entry(db, ledger_data, user_id)

    return payment


# ==================== LEDGER ====================
async def list_ledger(db: AsyncSession, page: int = 1, limit: int = 20, ledger_type: str = None, client_id: int = None, date_from: date = None, date_to: date = None):
    query = select(Ledger)
    count_query = select(func.count(Ledger.id))

    if ledger_type:
        query = query.where(Ledger.ledger_type == LedgerType(ledger_type))
        count_query = count_query.where(Ledger.ledger_type == LedgerType(ledger_type))
    if client_id:
        query = query.where(Ledger.client_id == client_id)
        count_query = count_query.where(Ledger.client_id == client_id)
    if date_from:
        query = query.where(Ledger.entry_date >= date_from)
        count_query = count_query.where(Ledger.entry_date >= date_from)
    if date_to:
        query = query.where(Ledger.entry_date <= date_to)
        count_query = count_query.where(Ledger.entry_date <= date_to)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(Ledger.id.desc()))
    return result.scalars().all(), total


async def create_ledger_entry(db: AsyncSession, data: dict, user_id: int = None) -> Ledger:
    data["entry_number"] = generate_ledger_number()
    data["created_by"] = user_id

    # Calculate running balance
    data["balance"] = float(data.get("debit", 0)) - float(data.get("credit", 0))

    entry = Ledger(**data)
    db.add(entry)
    await db.flush()
    return entry


# ==================== VENDORS ====================
async def list_vendors(db: AsyncSession, page: int = 1, limit: int = 20, search: str = None):
    query = select(Vendor).where(Vendor.is_deleted == False)
    count_query = select(func.count(Vendor.id)).where(Vendor.is_deleted == False)

    if search:
        sf = or_(Vendor.name.ilike(f"%{search}%"), Vendor.code.ilike(f"%{search}%"))
        query = query.where(sf)
        count_query = count_query.where(sf)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(Vendor.id.desc()))
    return result.scalars().all(), total


async def create_vendor(db: AsyncSession, data: dict) -> Vendor:
    vendor = Vendor(**data)
    db.add(vendor)
    await db.flush()
    return vendor


# ==================== BANK ACCOUNTS ====================
async def list_bank_accounts(db: AsyncSession):
    result = await db.execute(select(BankAccount).where(BankAccount.is_deleted == False, BankAccount.is_active == True))
    return result.scalars().all()


async def create_bank_account(db: AsyncSession, data: dict) -> BankAccount:
    account = BankAccount(**data)
    db.add(account)
    await db.flush()
    return account


async def create_bank_transaction(db: AsyncSession, data: dict) -> BankTransaction:
    txn = BankTransaction(**data)
    db.add(txn)
    await db.flush()

    # Update balance
    account_result = await db.execute(select(BankAccount).where(BankAccount.id == data["account_id"]))
    account = account_result.scalar_one_or_none()
    if account:
        if data["transaction_type"] == "credit":
            account.current_balance = float(account.current_balance or 0) + float(data["amount"])
        else:
            account.current_balance = float(account.current_balance or 0) - float(data["amount"])
        txn.balance_after = account.current_balance

    return txn


async def list_bank_transactions(db: AsyncSession, account_id: int = None, page: int = 1, limit: int = 20):
    query = select(BankTransaction)
    count_query = select(func.count(BankTransaction.id))

    if account_id:
        query = query.where(BankTransaction.account_id == account_id)
        count_query = count_query.where(BankTransaction.account_id == account_id)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(BankTransaction.id.desc()))
    return result.scalars().all(), total


# ==================== ROUTES ====================
async def list_routes(db: AsyncSession, page: int = 1, limit: int = 20, search: str = None):
    from app.models.postgres.route import Route
    query = select(Route).where(Route.is_deleted == False)
    count_query = select(func.count(Route.id)).where(Route.is_deleted == False)

    if search:
        sf = or_(Route.route_name.ilike(f"%{search}%"), Route.origin_city.ilike(f"%{search}%"), Route.destination_city.ilike(f"%{search}%"))
        query = query.where(sf)
        count_query = count_query.where(sf)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(Route.id.desc()))
    return result.scalars().all(), total


async def get_route(db: AsyncSession, route_id: int):
    from app.models.postgres.route import Route
    result = await db.execute(select(Route).where(Route.id == route_id, Route.is_deleted == False))
    return result.scalar_one_or_none()


async def create_route(db: AsyncSession, data: dict):
    from app.models.postgres.route import Route
    from app.utils.generators import generate_route_code
    data["route_code"] = generate_route_code(data["origin_city"], data["destination_city"])
    route = Route(**data)
    db.add(route)
    await db.flush()
    return route


async def update_route(db: AsyncSession, route_id: int, data: dict):
    route = await get_route(db, route_id)
    if not route:
        return None
    for k, v in data.items():
        if v is not None:
            setattr(route, k, v)
    return route
