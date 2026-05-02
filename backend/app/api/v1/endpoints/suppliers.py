# Supplier Management Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierVehicleCreate
from app.services import supplier_service

router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_suppliers(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=500),
    search: Optional[str] = None, status: Optional[str] = None,
    supplier_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    suppliers, total = await supplier_service.list_suppliers(db, page, limit, search, status, supplier_type)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(s, c.key) for c in s.__table__.columns} for s in suppliers]
    return APIResponse(
        success=True, data=items,
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


@router.get("/{supplier_id}", response_model=APIResponse)
async def get_supplier(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    supplier = await supplier_service.get_supplier(db, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    data = {c.key: getattr(supplier, c.key) for c in supplier.__table__.columns}
    vehicles = await supplier_service.list_supplier_vehicles(db, supplier_id)
    data["vehicles"] = [{c.key: getattr(v, c.key) for c in v.__table__.columns} for v in vehicles]
    return APIResponse(success=True, data=data)


@router.post("", response_model=APIResponse, status_code=201)
async def create_supplier(
    data: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    supplier = await supplier_service.create_supplier(db, data.model_dump(exclude_unset=True))
    return APIResponse(success=True, data={"id": supplier.id, "code": supplier.code}, message="Supplier created")


@router.put("/{supplier_id}", response_model=APIResponse)
async def update_supplier(
    supplier_id: int, data: SupplierUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    supplier = await supplier_service.update_supplier(db, supplier_id, data.model_dump(exclude_unset=True))
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return APIResponse(success=True, message="Supplier updated")


@router.delete("/{supplier_id}", response_model=APIResponse)
async def delete_supplier(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    success = await supplier_service.delete_supplier(db, supplier_id)
    if not success:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return APIResponse(success=True, message="Supplier deleted")


# --- Vehicles ---
@router.get("/{supplier_id}/vehicles", response_model=APIResponse)
async def list_vehicles(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    vehicles = await supplier_service.list_supplier_vehicles(db, supplier_id)
    items = [{c.key: getattr(v, c.key) for c in v.__table__.columns} for v in vehicles]
    return APIResponse(success=True, data=items)


@router.post("/{supplier_id}/vehicles", response_model=APIResponse, status_code=201)
async def add_vehicle(
    supplier_id: int, data: SupplierVehicleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    sv = await supplier_service.add_supplier_vehicle(db, supplier_id, data.model_dump(exclude_unset=True))
    return APIResponse(success=True, data={"id": sv.id}, message="Vehicle added to supplier")


@router.delete("/vehicles/{sv_id}", response_model=APIResponse)
async def remove_vehicle(
    sv_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    success = await supplier_service.remove_supplier_vehicle(db, sv_id)
    if not success:
        raise HTTPException(status_code=404, detail="Supplier vehicle not found")
    return APIResponse(success=True, message="Vehicle removed from supplier")


# --- Trips ---
@router.get("/{supplier_id}/trips", response_model=APIResponse)
async def list_trips(
    supplier_id: int,
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    trips, total = await supplier_service.list_supplier_trips(db, supplier_id, page, limit)
    pages = (total + limit - 1) // limit
    items = [{c.key: getattr(t, c.key) for c in t.__table__.columns} for t in trips]
    return APIResponse(
        success=True, data=items,
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


# --- Statement ---
@router.get("/{supplier_id}/statement", response_model=APIResponse)
async def get_statement(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    supplier = await supplier_service.get_supplier(db, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    statement = await supplier_service.get_supplier_statement(db, supplier_id)
    return APIResponse(success=True, data=statement)
