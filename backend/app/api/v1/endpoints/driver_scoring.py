# Driver Scoring API Endpoints
# Transport ERP — Phase C: Driver Behavior Scoring Engine

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime

from app.db.postgres.connection import get_db
from app.core.security import get_current_user, TokenData
from app.services import driver_scoring_service
from app.schemas.driver_scoring import CoachingNoteCreate
from app.middleware.permissions import require_permission, require_any_permission, Permissions

router = APIRouter()


async def _resolve_driver_id(current_user: TokenData, db: AsyncSession) -> int | None:
    """For driver role, resolve the driver.id linked to user."""
    if "driver" in [r.lower() for r in current_user.roles]:
        from app.models.postgres.driver import Driver
        result = await db.execute(select(Driver.id).where(Driver.user_id == current_user.user_id))
        row = result.scalar_one_or_none()
        return row
    return None


@router.get("/leaderboard")
async def get_leaderboard(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020, le=2100),
    branch_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.DRIVER_SCORE_READ)),
):
    # Drivers cannot see full leaderboard
    if "driver" in [r.lower() for r in current_user.roles]:
        raise HTTPException(status_code=403, detail="Drivers cannot view fleet leaderboard")
    now = datetime.utcnow()
    m = month or now.month
    y = year or now.year
    data = await driver_scoring_service.get_leaderboard(
        db, m, y,
        branch_id=branch_id,
        tenant_id=current_user.tenant_id,
        skip=skip, limit=limit,
    )
    return {"success": True, "data": data}


@router.get("/fleet-distribution")
async def get_fleet_score_distribution(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020, le=2100),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.DRIVER_SCORE_READ)),
):
    if "driver" in [r.lower() for r in current_user.roles]:
        raise HTTPException(status_code=403, detail="Access denied")
    now = datetime.utcnow()
    m = month or now.month
    y = year or now.year
    data = await driver_scoring_service.get_fleet_score_distribution(
        db, m, y, tenant_id=current_user.tenant_id,
    )
    return {"success": True, "data": data}


@router.get("/{driver_id}/score")
async def get_driver_score(
    driver_id: int,
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020, le=2100),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.DRIVER_SCORE_READ)),
):
    # Drivers can only view their own score
    own_driver_id = await _resolve_driver_id(current_user, db)
    if own_driver_id is not None and own_driver_id != driver_id:
        raise HTTPException(status_code=403, detail="Can only view own score")
    now = datetime.utcnow()
    m = month or now.month
    y = year or now.year
    data = await driver_scoring_service.compute_monthly_score(db, driver_id, m, y)
    return {"success": True, "data": data}


@router.get("/{driver_id}/score/breakdown")
async def get_driver_score_breakdown(
    driver_id: int,
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020, le=2100),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.DRIVER_SCORE_READ)),
):
    own_driver_id = await _resolve_driver_id(current_user, db)
    if own_driver_id is not None and own_driver_id != driver_id:
        raise HTTPException(status_code=403, detail="Can only view own score")
    now = datetime.utcnow()
    m = month or now.month
    y = year or now.year
    data = await driver_scoring_service.get_score_breakdown(db, driver_id, m, y)
    return {"success": True, "data": data}


@router.get("/{driver_id}/score/trend")
async def get_driver_score_trend(
    driver_id: int,
    months: int = Query(12, ge=1, le=36),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.DRIVER_SCORE_READ)),
):
    own_driver_id = await _resolve_driver_id(current_user, db)
    if own_driver_id is not None and own_driver_id != driver_id:
        raise HTTPException(status_code=403, detail="Can only view own score")
    data = await driver_scoring_service.get_score_trend(db, driver_id, months)
    return {"success": True, "data": data}


@router.get("/{driver_id}/coaching-notes")
async def get_coaching_notes(
    driver_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_permission(Permissions.DRIVER_SCORE_READ)),
):
    own_driver_id = await _resolve_driver_id(current_user, db)
    if own_driver_id is not None and own_driver_id != driver_id:
        raise HTTPException(status_code=403, detail="Can only view own coaching notes")
    notes = await driver_scoring_service.get_coaching_notes(db, driver_id, skip, limit)
    return {"success": True, "data": notes}


@router.post("/{driver_id}/coaching-notes")
async def add_coaching_note(
    driver_id: int,
    payload: CoachingNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_any_permission([Permissions.DRIVER_SCORE_READ, Permissions.ALERT_MANAGE])),
):
    # Only managers/admins/fleet_managers can add coaching notes
    if "driver" in [r.lower() for r in current_user.roles]:
        raise HTTPException(status_code=403, detail="Drivers cannot add coaching notes")
    note = await driver_scoring_service.add_coaching_note(
        db, driver_id,
        coach_id=current_user.user_id,
        note_text=payload.note_text,
        category=payload.category,
        tenant_id=current_user.tenant_id,
    )
    return {"success": True, "data": note, "message": "Coaching note added"}
