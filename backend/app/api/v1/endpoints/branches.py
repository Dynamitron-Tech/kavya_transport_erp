# Branch Management API Endpoints
# Transport ERP — Phase E: Multi-Branch

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date
from pydantic import BaseModel

from app.db.postgres.connection import get_db
from app.core.security import get_current_user, TokenData
from app.middleware.branch_isolation import require_branch_admin, get_branch_context, BranchContext
from app.services import branch_service

router = APIRouter()


# ── Schemas ─────────────────────────────────────────────────

class BranchCreate(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool = True
    tenant_id: int


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None


# ── Endpoints ───────────────────────────────────────────────

@router.get("")
async def list_branches(
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_branch_admin),
):
    """List all branches (admin only)."""
    branches = await branch_service.list_branches(
        db, tenant_id=current_user.tenant_id, search=search, is_active=is_active,
    )
    return {
        "success": True,
        "data": [_serialize_branch(b) for b in branches],
    }


@router.get("/comparison")
async def cross_branch_comparison(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_branch_admin),
):
    """Cross-branch comparison with resources and P&L (admin only)."""
    data = await branch_service.get_cross_branch_comparison(
        db, tenant_id=current_user.tenant_id, start_date=start_date, end_date=end_date,
    )
    return {"success": True, "data": data}


@router.get("/{branch_id}")
async def get_branch(
    branch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    branch_ctx: BranchContext = Depends(get_branch_context),
):
    """Get branch detail. Admin sees any branch; others see only their own."""
    if branch_ctx.should_filter and branch_ctx.branch_id != branch_id:
        raise HTTPException(status_code=403, detail="Access denied to this branch")
    branch = await branch_service.get_branch(db, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {"success": True, "data": _serialize_branch(branch)}


@router.post("")
async def create_branch(
    payload: BranchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_branch_admin),
):
    """Create a new branch (admin only)."""
    branch = await branch_service.create_branch(db, payload.model_dump())
    return {"success": True, "data": _serialize_branch(branch), "message": "Branch created"}


@router.put("/{branch_id}")
async def update_branch(
    branch_id: int,
    payload: BranchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_branch_admin),
):
    """Update branch (admin only)."""
    branch = await branch_service.update_branch(
        db, branch_id, payload.model_dump(exclude_unset=True),
    )
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {"success": True, "data": _serialize_branch(branch), "message": "Branch updated"}


@router.delete("/{branch_id}")
async def delete_branch(
    branch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_branch_admin),
):
    """Soft-delete a branch (admin only)."""
    ok = await branch_service.delete_branch(db, branch_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {"success": True, "message": "Branch deleted"}


@router.get("/{branch_id}/resources")
async def branch_resources(
    branch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    branch_ctx: BranchContext = Depends(get_branch_context),
):
    """Resource counts (vehicles, drivers, staff, clients) for a branch."""
    if branch_ctx.should_filter and branch_ctx.branch_id != branch_id:
        raise HTTPException(status_code=403, detail="Access denied to this branch")
    data = await branch_service.get_branch_resources(db, branch_id)
    return {"success": True, "data": data}


@router.get("/{branch_id}/pnl")
async def branch_pnl(
    branch_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    branch_ctx: BranchContext = Depends(get_branch_context),
):
    """P&L for a branch. Admin sees any; branch manager sees own only."""
    if branch_ctx.should_filter and branch_ctx.branch_id != branch_id:
        raise HTTPException(status_code=403, detail="Access denied to this branch")
    data = await branch_service.get_branch_pnl(db, branch_id, start_date, end_date)
    return {"success": True, "data": data}


# ── Serializer ──────────────────────────────────────────────

def _serialize_branch(branch) -> dict:
    return {
        "id": branch.id,
        "name": branch.name,
        "code": branch.code,
        "address": branch.address,
        "city": branch.city,
        "state": branch.state,
        "pincode": branch.pincode,
        "phone": branch.phone,
        "email": branch.email,
        "is_active": branch.is_active,
        "tenant_id": branch.tenant_id,
        "created_at": branch.created_at.isoformat() if branch.created_at else None,
    }
