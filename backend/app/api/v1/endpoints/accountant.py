# Accountant Module Endpoints
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse, PaginationMeta
from app.services import dashboard_service, finance_service

router = APIRouter()


@router.get("/dashboard", response_model=APIResponse)
async def accountant_dashboard(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    data = await dashboard_service.get_accountant_dashboard(db)
    return APIResponse(success=True, data=data)


@router.get("/invoices", response_model=APIResponse)
async def accountant_invoices(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None, status: Optional[str] = None,
    client_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
):
    invoices, total = await finance_service.list_invoices(db, page, limit, search, status, client_id)
    pages = (total + limit - 1) // limit
    items = []
    for inv in invoices:
        items.append(await finance_service.get_invoice_with_details(db, inv))
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/payments", response_model=APIResponse)
async def accountant_payments(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    payment_type: Optional[str] = None, client_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
):
    payments, total = await finance_service.list_payments(db, page, limit, payment_type, client_id)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(p, c.key) for c in p.__table__.columns} for p in payments]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/ledger", response_model=APIResponse)
async def accountant_ledger(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    ledger_type: Optional[str] = None, client_id: Optional[int] = None,
    date_from: Optional[date] = None, date_to: Optional[date] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
):
    entries, total = await finance_service.list_ledger(db, page, limit, ledger_type, client_id, date_from, date_to)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(e, c.key) for c in e.__table__.columns} for e in entries]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/receivables", response_model=APIResponse)
async def accountant_receivables(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    from sqlalchemy import select, func
    from app.models.postgres.finance import Invoice, InvoiceStatus
    from app.models.postgres.client import Client

    result = await db.execute(
        select(
            Client.id, Client.name, Client.code,
            func.sum(Invoice.amount_due).label("total_due"),
            func.count(Invoice.id).label("invoice_count"),
        )
        .join(Invoice, Invoice.client_id == Client.id)
        .where(Invoice.is_deleted == False, Invoice.amount_due > 0, Invoice.status != InvoiceStatus.CANCELLED)
        .group_by(Client.id, Client.name, Client.code)
        .order_by(func.sum(Invoice.amount_due).desc())
    )
    items = [{"client_id": r[0], "client_name": r[1], "client_code": r[2], "total_due": float(r[3]), "invoice_count": r[4]} for r in result.all()]
    return APIResponse(success=True, data=items)


@router.get("/expenses", response_model=APIResponse)
async def accountant_expenses(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    verified: Optional[bool] = None,
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
):
    from sqlalchemy import select, func
    from app.models.postgres.trip import TripExpense

    query = select(TripExpense)
    count_query = select(func.count(TripExpense.id))

    if verified is not None:
        query = query.where(TripExpense.is_verified == verified)
        count_query = count_query.where(TripExpense.is_verified == verified)

    total = (await db.execute(count_query)).scalar() or 0
    pages = (total + limit - 1) // limit
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(TripExpense.expense_date.desc()))
    expenses = result.scalars().all()
    items = [{c.key: getattr(e, c.key) for c in e.__table__.columns} for e in expenses]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/banking", response_model=APIResponse)
async def accountant_banking(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    accounts = await finance_service.list_bank_accounts(db)
    items = [{c.key: getattr(a, c.key) for c in a.__table__.columns} for a in accounts]
    return APIResponse(success=True, data=items)
