# Driver Management Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.driver import DriverCreate, DriverUpdate, DriverLicenseCreate
from app.services import driver_service

router = APIRouter()


@router.get("/dashboard", response_model=APIResponse)
async def get_driver_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Get driver dashboard summary."""
    stats = await driver_service.get_driver_stats(db)
    return APIResponse(success=True, data=stats)


@router.get("", response_model=APIResponse)
async def list_drivers(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None, status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.DRIVER_READ)),
):
    drivers, total = await driver_service.list_drivers(db, page, limit, search, status)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(d, c.key) for c in d.__table__.columns} for d in drivers]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/{driver_id}", response_model=APIResponse)
async def get_driver(driver_id: int, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    driver = await driver_service.get_driver(db, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    data = {c.key: getattr(driver, c.key) for c in driver.__table__.columns}
    licenses = await driver_service.get_driver_license(db, driver_id)
    data["licenses"] = [{c.key: getattr(l, c.key) for c in l.__table__.columns} for l in licenses]
    return APIResponse(success=True, data=data)


@router.post("", response_model=APIResponse, status_code=201)
async def create_driver(
    data: DriverCreate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.DRIVER_CREATE)),
):
    driver = await driver_service.create_driver(db, data.model_dump(exclude_unset=True))
    return APIResponse(success=True, data={"id": driver.id, "employee_code": driver.employee_code}, message="Driver created")


@router.put("/{driver_id}", response_model=APIResponse)
async def update_driver(
    driver_id: int, data: DriverUpdate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.DRIVER_UPDATE)),
):
    driver = await driver_service.update_driver(db, driver_id, data.model_dump(exclude_unset=True))
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return APIResponse(success=True, message="Driver updated")


@router.delete("/{driver_id}", response_model=APIResponse)
async def delete_driver(
    driver_id: int, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.DRIVER_DELETE)),
):
    success = await driver_service.delete_driver(db, driver_id)
    if not success:
        raise HTTPException(status_code=404, detail="Driver not found")
    return APIResponse(success=True, message="Driver deleted")


# --- License ---
@router.get("/{driver_id}/licenses", response_model=APIResponse)
async def list_licenses(driver_id: int, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    licenses = await driver_service.get_driver_license(db, driver_id)
    items = [{c.key: getattr(l, c.key) for c in l.__table__.columns} for l in licenses]
    return APIResponse(success=True, data=items)


@router.post("/{driver_id}/licenses", response_model=APIResponse, status_code=201)
async def add_license(driver_id: int, data: DriverLicenseCreate, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    lic = await driver_service.add_driver_license(db, driver_id, data.model_dump())
    return APIResponse(success=True, data={"id": lic.id}, message="License added")


# --- Attendance ---
@router.get("/attendance", response_model=APIResponse)
async def list_attendance(
    driver_id: Optional[int] = None,
    date_from: Optional[date] = None, date_to: Optional[date] = None,
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user),
):
    records, total = await driver_service.list_attendance(db, driver_id, date_from, date_to, page, limit)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(a, c.key) for c in a.__table__.columns} for a in records]
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))
