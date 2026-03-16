# E-way Bill Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from pydantic import BaseModel

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.eway_bill import EwayBillCreate, EwayBillUpdate
from app.services import eway_service
from app.services import eway_bill_api_service

router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_eway_bills(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None, status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EWAY_BILL_READ)),
):
    bills, total = await eway_service.list_eway_bills(db, page, limit, search, status)
    pages = (total + limit - 1) // limit
    items = []
    for bill in bills:
        items.append(await eway_service.get_eway_with_details(db, bill))
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/{eway_id}", response_model=APIResponse)
async def get_eway_bill(
    eway_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EWAY_BILL_READ)),
):
    bill = await eway_service.get_eway_bill(db, eway_id)
    if not bill:
        raise HTTPException(status_code=404, detail="E-way bill not found")
    data = await eway_service.get_eway_with_details(db, bill)
    return APIResponse(success=True, data=data)


@router.post("", response_model=APIResponse, status_code=201)
async def create_eway_bill(
    data: EwayBillCreate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EWAY_BILL_CREATE)),
):
    bill = await eway_service.create_eway_bill(db, data.model_dump(), current_user.user_id)
    return APIResponse(success=True, data={"id": bill.id}, message="E-way bill created")


@router.put("/{eway_id}", response_model=APIResponse)
async def update_eway_bill(
    eway_id: int, data: EwayBillUpdate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EWAY_BILL_UPDATE)),
):
    bill = await eway_service.update_eway_bill(db, eway_id, data.model_dump(exclude_unset=True))
    if not bill:
        raise HTTPException(status_code=404, detail="E-way bill not found")
    return APIResponse(success=True, message="E-way bill updated")


# ── Government E-way Bill API endpoints ─────────────────────────

class EwayBillCancelRequest(BaseModel):
    ewb_number: str
    reason: str
    reason_code: int = 1


class EwayBillExtendRequest(BaseModel):
    ewb_number: str
    vehicle_no: str
    remaining_distance: int
    reason: str
    reason_code: int = 4


@router.post("/api/generate", response_model=APIResponse)
async def generate_eway_bill_api(
    payload: dict,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EWAY_BILL_CREATE)),
):
    """Generate E-way Bill via government portal."""
    result = await eway_bill_api_service.generate_eway_bill(payload)
    return APIResponse(success=True, data=result, message="E-way bill generated")


@router.post("/api/cancel", response_model=APIResponse)
async def cancel_eway_bill_api(
    payload: EwayBillCancelRequest,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EWAY_BILL_UPDATE)),
):
    """Cancel E-way Bill via government portal."""
    result = await eway_bill_api_service.cancel_eway_bill(payload.ewb_number, payload.reason, payload.reason_code)
    return APIResponse(success=True, data=result, message="E-way bill cancelled")


@router.post("/api/extend", response_model=APIResponse)
async def extend_eway_bill_api(
    payload: EwayBillExtendRequest,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EWAY_BILL_UPDATE)),
):
    """Extend E-way Bill validity via government portal."""
    result = await eway_bill_api_service.extend_eway_bill(
        payload.ewb_number, payload.vehicle_no, payload.remaining_distance, payload.reason, payload.reason_code,
    )
    return APIResponse(success=True, data=result, message="E-way bill extended")


@router.get("/api/details/{ewb_number}", response_model=APIResponse)
async def get_eway_bill_api_details(
    ewb_number: str,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.EWAY_BILL_READ)),
):
    """Get E-way Bill details from government portal."""
    result = await eway_bill_api_service.get_eway_bill_details(ewb_number)
    return APIResponse(success=True, data=result, message="E-way bill details fetched")
