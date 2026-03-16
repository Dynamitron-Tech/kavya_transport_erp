# Finance Endpoints - Invoice, Payment, Ledger, Vendor, Banking, Routes
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.finance import (
    InvoiceCreate, InvoiceUpdate, PaymentCreate,
    LedgerEntryCreate, VendorCreate,
    BankAccountCreate, BankTransactionCreate,
    RouteCreate, RouteUpdate,
)
from app.services import finance_service

router = APIRouter()


# --- Invoices ---
@router.get("/invoices", response_model=APIResponse)
async def list_invoices(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None, status: Optional[str] = None,
    client_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_READ)),
):
    invoices, total = await finance_service.list_invoices(db, page, limit, search, status, client_id)
    pages = (total + limit - 1) // limit
    items = []
    for inv in invoices:
        items.append(await finance_service.get_invoice_with_details(db, inv))
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/invoices/{invoice_id}", response_model=APIResponse)
async def get_invoice(invoice_id: int, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    inv = await finance_service.get_invoice(db, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return APIResponse(success=True, data=await finance_service.get_invoice_with_details(db, inv))


@router.post("/invoices", response_model=APIResponse, status_code=201)
async def create_invoice(
    data: InvoiceCreate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_CREATE)),
):
    inv = await finance_service.create_invoice(db, data.model_dump(), current_user.user_id)
    return APIResponse(success=True, data={"id": inv.id, "invoice_number": inv.invoice_number}, message="Invoice created")


@router.put("/invoices/{invoice_id}", response_model=APIResponse)
async def update_invoice(
    invoice_id: int, data: InvoiceUpdate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_UPDATE)),
):
    inv = await finance_service.update_invoice(db, invoice_id, data.model_dump(exclude_unset=True))
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return APIResponse(success=True, message="Invoice updated")


@router.delete("/invoices/{invoice_id}", response_model=APIResponse)
async def delete_invoice(
    invoice_id: int, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.INVOICE_DELETE)),
):
    success = await finance_service.delete_invoice(db, invoice_id)
    if not success:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return APIResponse(success=True, message="Invoice deleted")


# --- Payments ---
@router.get("/payments", response_model=APIResponse)
async def list_payments(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    payment_type: Optional[str] = None, client_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_READ)),
):
    payments, total = await finance_service.list_payments(db, page, limit, payment_type, client_id)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(p, c.key) for c in p.__table__.columns} for p in payments]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.post("/payments", response_model=APIResponse, status_code=201)
async def create_payment(
    data: PaymentCreate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.PAYMENT_CREATE)),
):
    payment = await finance_service.create_payment(db, data.model_dump(), current_user.user_id)
    return APIResponse(success=True, data={"id": payment.id, "payment_number": payment.payment_number}, message="Payment recorded")


# --- Ledger ---
@router.get("/ledger", response_model=APIResponse)
async def list_ledger(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    ledger_type: Optional[str] = None, client_id: Optional[int] = None,
    date_from: Optional[date] = None, date_to: Optional[date] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.LEDGER_READ)),
):
    entries, total = await finance_service.list_ledger(db, page, limit, ledger_type, client_id, date_from, date_to)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(e, c.key) for c in e.__table__.columns} for e in entries]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.post("/ledger", response_model=APIResponse, status_code=201)
async def create_ledger(
    data: LedgerEntryCreate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    entry = await finance_service.create_ledger_entry(db, data.model_dump(), current_user.user_id)
    return APIResponse(success=True, data={"id": entry.id, "entry_number": entry.entry_number}, message="Ledger entry created")


# --- Vendors ---
@router.get("/vendors", response_model=APIResponse)
async def list_vendors(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
):
    vendors, total = await finance_service.list_vendors(db, page, limit, search)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(v, c.key) for c in v.__table__.columns} for v in vendors]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.post("/vendors", response_model=APIResponse, status_code=201)
async def create_vendor(data: VendorCreate, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    vendor = await finance_service.create_vendor(db, data.model_dump())
    return APIResponse(success=True, data={"id": vendor.id}, message="Vendor created")


# --- Bank Accounts ---
@router.get("/bank-accounts", response_model=APIResponse)
async def list_bank_accounts(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    accounts = await finance_service.list_bank_accounts(db)
    items = [{c.key: getattr(a, c.key) for c in a.__table__.columns} for a in accounts]
    return APIResponse(success=True, data=items)


@router.post("/bank-accounts", response_model=APIResponse, status_code=201)
async def create_bank_account(data: BankAccountCreate, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    account = await finance_service.create_bank_account(db, data.model_dump())
    return APIResponse(success=True, data={"id": account.id}, message="Bank account created")


# --- Bank Transactions ---
@router.get("/bank-transactions", response_model=APIResponse)
async def list_bank_transactions(
    account_id: Optional[int] = None,
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
):
    txns, total = await finance_service.list_bank_transactions(db, account_id, page, limit)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(t, c.key) for c in t.__table__.columns} for t in txns]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.post("/bank-transactions", response_model=APIResponse, status_code=201)
async def create_bank_transaction(data: BankTransactionCreate, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    txn = await finance_service.create_bank_transaction(db, data.model_dump())
    return APIResponse(success=True, data={"id": txn.id}, message="Transaction recorded")


# --- Routes ---
@router.get("/routes", response_model=APIResponse)
async def list_routes(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
):
    routes, total = await finance_service.list_routes(db, page, limit, search)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(r, c.key) for c in r.__table__.columns} for r in routes]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/routes/{route_id}", response_model=APIResponse)
async def get_route(route_id: int, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    route = await finance_service.get_route(db, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return APIResponse(success=True, data={c.key: getattr(route, c.key) for c in route.__table__.columns})


@router.post("/routes", response_model=APIResponse, status_code=201)
async def create_route(data: RouteCreate, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    route = await finance_service.create_route(db, data.model_dump())
    return APIResponse(success=True, data={"id": route.id, "route_code": route.route_code}, message="Route created")


@router.put("/routes/{route_id}", response_model=APIResponse)
async def update_route(route_id: int, data: RouteUpdate, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    route = await finance_service.update_route(db, route_id, data.model_dump(exclude_unset=True))
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return APIResponse(success=True, message="Route updated")
