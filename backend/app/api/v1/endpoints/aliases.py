from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData
from app.db.mongodb.connection import MongoDB
from app.db.postgres.connection import get_db
from app.middleware.permissions import Permissions, require_permission
from app.models.postgres.trip import TripExpense, TripFuelEntry
from app.schemas.base import APIResponse
from app.services import dashboard_service, driver_service, eway_service, finance_service

router = APIRouter()


@router.get('/routes', response_model=APIResponse)
async def alias_routes(
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.JOB_READ)),
):
    routes, total = await finance_service.list_routes(db, page=page, limit=limit, search=search)
    items = [{c.key: getattr(r, c.key) for c in r.__table__.columns} for r in routes]
    return APIResponse(success=True, data={'items': items, 'total': total, 'page': page, 'limit': limit}, message='ok')


@router.get('/ewb', response_model=APIResponse)
async def alias_ewb(
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.EWAY_READ)),
):
    bills, total = await eway_service.list_eway_bills(db, page=page, limit=limit, search=search, status=status)
    items = [await eway_service.get_eway_with_details(db, bill) for bill in bills]
    return APIResponse(success=True, data={'items': items, 'total': total, 'page': page, 'limit': limit}, message='ok')


@router.get('/expenses', response_model=APIResponse)
async def alias_expenses(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.EXPENSE_READ)),
):
    offset = max(page - 1, 0) * limit
    total = (await db.execute(select(TripExpense.id))).all()
    rows = (await db.execute(select(TripExpense).order_by(TripExpense.expense_date.desc()).offset(offset).limit(limit))).scalars().all()
    items = [{
        'id': e.id,
        'trip_id': e.trip_id,
        'category': e.category.value if hasattr(e.category, 'value') else str(e.category),
        'amount': float(e.amount),
        'payment_mode': e.payment_mode,
        'description': e.description,
        'expense_date': e.expense_date.isoformat() if e.expense_date else None,
        'is_verified': bool(e.is_verified),
    } for e in rows]
    return APIResponse(success=True, data={'items': items, 'total': len(total), 'page': page, 'limit': limit}, message='ok')


@router.get('/fuel', response_model=APIResponse)
async def alias_fuel(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.FUEL_READ)),
):
    offset = max(page - 1, 0) * limit
    total = (await db.execute(select(TripFuelEntry.id))).all()
    rows = (await db.execute(select(TripFuelEntry).order_by(TripFuelEntry.fuel_date.desc()).offset(offset).limit(limit))).scalars().all()
    items = [{
        'id': f.id,
        'trip_id': f.trip_id,
        'vehicle_id': f.vehicle_id,
        'fuel_date': f.fuel_date.isoformat() if f.fuel_date else None,
        'quantity_litres': float(f.quantity_litres),
        'rate_per_litre': float(f.rate_per_litre),
        'total_amount': float(f.total_amount),
        'pump_name': f.pump_name,
        'payment_mode': f.payment_mode,
    } for f in rows]
    return APIResponse(success=True, data={'items': items, 'total': len(total), 'page': page, 'limit': limit}, message='ok')


@router.get('/attendance', response_model=APIResponse)
async def alias_attendance(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.DRIVER_READ)),
):
    data = await driver_service.list_attendance(db, page=page, limit=limit)
    return APIResponse(success=True, data=data, message='ok')


@router.get('/checklists', response_model=APIResponse)
async def alias_checklists(
    page: int = 1,
    limit: int = 20,
    _user: TokenData = Depends(require_permission(Permissions.TRIP_READ)),
):
    if MongoDB.db is None:
        return APIResponse(success=True, data={'items': [], 'total': 0, 'page': page, 'limit': limit}, message='ok')

    skip = max(page - 1, 0) * limit
    cursor = MongoDB.db.driver_checklist_logs.find({}).sort('submitted_at', -1).skip(skip).limit(limit)
    items = []
    async for row in cursor:
        row['_id'] = str(row.get('_id'))
        items.append(row)

    total = await MongoDB.db.driver_checklist_logs.count_documents({})
    return APIResponse(success=True, data={'items': items, 'total': total, 'page': page, 'limit': limit}, message='ok')


@router.get('/invoices', response_model=APIResponse)
async def alias_invoices(
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    status: str | None = None,
    client_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.INVOICE_READ)),
):
    invoices, total = await finance_service.list_invoices(db, page=page, limit=limit, search=search, status=status, client_id=client_id)
    items = [await finance_service.get_invoice_with_details(db, inv) for inv in invoices]
    return APIResponse(success=True, data={'items': items, 'total': total, 'page': page, 'limit': limit}, message='ok')


@router.get('/banking', response_model=APIResponse)
async def alias_banking(
    page: int = 1,
    limit: int = 20,
    account_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.PAYMENT_READ)),
):
    txns, total = await finance_service.list_bank_transactions(db, account_id=account_id, page=page, limit=limit)
    items = [{c.key: getattr(t, c.key) for c in t.__table__.columns} for t in txns]
    return APIResponse(success=True, data={'items': items, 'total': total, 'page': page, 'limit': limit}, message='ok')


@router.get('/ledger', response_model=APIResponse)
async def alias_ledger(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _user: TokenData = Depends(require_permission(Permissions.LEDGER_READ)),
):
    entries, total = await finance_service.list_ledger(db, page=page, limit=limit)
    items = [{c.key: getattr(e, c.key) for c in e.__table__.columns} for e in entries]
    return APIResponse(success=True, data={'items': items, 'total': total, 'page': page, 'limit': limit}, message='ok')


@router.get('/notifications', response_model=APIResponse)
async def alias_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.ALERT_VIEW)),
):
    alerts = await dashboard_service.get_notifications(db, current_user.user_id)
    return APIResponse(success=True, data=alerts, message='ok')


@router.get('/notifications/unread-count', response_model=APIResponse)
async def alias_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.ALERT_VIEW)),
):
    alerts = await dashboard_service.get_notifications(db, current_user.user_id)
    unread = sum(1 for alert in alerts if not bool(alert.get('read')))
    return APIResponse(success=True, data={'count': unread}, message='ok')
