# Fuel Pump Management Endpoints
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, require_any_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.fuel_pump import (
    DepotFuelTankCreate, DepotFuelTankUpdate,
    FuelIssueCreate, FuelStockTransactionCreate,
    FuelTheftAlertResolve,
)
from app.services import fuel_pump_service

router = APIRouter()


# ──────────────────── Tanks ────────────────────

@router.get("/tanks", response_model=APIResponse)
async def list_tanks(
    current_user: TokenData = Depends(require_any_permission([
        Permissions.FUEL_STOCK_VIEW, Permissions.FUEL_READ,
    ])),
    db: AsyncSession = Depends(get_db),
):
    tanks = await fuel_pump_service.get_tanks(db, current_user.tenant_id)
    from app.schemas.fuel_pump import DepotFuelTankResponse
    return APIResponse(
        success=True,
        data=[DepotFuelTankResponse.model_validate(t).model_dump() for t in tanks],
    )


@router.post("/tanks", response_model=APIResponse)
async def create_tank(
    data: DepotFuelTankCreate,
    current_user: TokenData = Depends(require_permission(Permissions.FUEL_STOCK_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    tank = await fuel_pump_service.create_tank(db, data, current_user.tenant_id)
    await db.commit()
    from app.schemas.fuel_pump import DepotFuelTankResponse
    return APIResponse(
        success=True,
        data=DepotFuelTankResponse.model_validate(tank).model_dump(),
        message="Tank created successfully",
    )


@router.get("/tanks/{tank_id}", response_model=APIResponse)
async def get_tank(
    tank_id: int,
    current_user: TokenData = Depends(require_any_permission([
        Permissions.FUEL_STOCK_VIEW, Permissions.FUEL_READ,
    ])),
    db: AsyncSession = Depends(get_db),
):
    tank = await fuel_pump_service.get_tank(db, tank_id)
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")
    from app.schemas.fuel_pump import DepotFuelTankResponse
    return APIResponse(success=True, data=DepotFuelTankResponse.model_validate(tank).model_dump())


@router.put("/tanks/{tank_id}", response_model=APIResponse)
async def update_tank(
    tank_id: int,
    data: DepotFuelTankUpdate,
    current_user: TokenData = Depends(require_permission(Permissions.FUEL_STOCK_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    tank = await fuel_pump_service.update_tank(db, tank_id, data)
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")
    await db.commit()
    from app.schemas.fuel_pump import DepotFuelTankResponse
    return APIResponse(
        success=True,
        data=DepotFuelTankResponse.model_validate(tank).model_dump(),
        message="Tank updated",
    )


@router.delete("/tanks/{tank_id}", response_model=APIResponse)
async def delete_tank(
    tank_id: int,
    current_user: TokenData = Depends(require_permission(Permissions.FUEL_STOCK_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    ok = await fuel_pump_service.delete_tank(db, tank_id, current_user.user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Tank not found")
    await db.commit()
    return APIResponse(success=True, message="Tank deleted")


# ──────────────────── Fuel Issues ────────────────────

@router.post("/issues", response_model=APIResponse)
async def issue_fuel(
    data: FuelIssueCreate,
    current_user: TokenData = Depends(require_any_permission([
        Permissions.FUEL_ISSUE, Permissions.FUEL_CREATE,
    ])),
    db: AsyncSession = Depends(get_db),
):
    try:
        issue, alert = await fuel_pump_service.issue_fuel(
            db, data, current_user.user_id,
            branch_id=current_user.branch_id,
            tenant_id=current_user.tenant_id,
        )
        await db.commit()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    from app.schemas.fuel_pump import FuelIssueResponse
    result = FuelIssueResponse.model_validate(issue).model_dump()
    if alert:
        result["theft_alert"] = {"id": alert.id, "severity": alert.severity, "description": alert.description}
    return APIResponse(success=True, data=result, message="Fuel issued successfully")


@router.get("/issues", response_model=APIResponse)
async def list_fuel_issues(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    vehicle_id: Optional[int] = None,
    driver_id: Optional[int] = None,
    tank_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    flagged_only: bool = False,
    current_user: TokenData = Depends(require_any_permission([
        Permissions.FUEL_READ, Permissions.FUEL_STOCK_VIEW,
    ])),
    db: AsyncSession = Depends(get_db),
):
    issues, total = await fuel_pump_service.get_fuel_issues(
        db, page, limit, vehicle_id, driver_id, tank_id,
        date_from, date_to, flagged_only, current_user.tenant_id,
    )
    from app.schemas.fuel_pump import FuelIssueResponse
    pages = (total + limit - 1) // limit if limit else 1
    return APIResponse(
        success=True,
        data=[FuelIssueResponse.model_validate(i).model_dump() for i in issues],
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


@router.get("/issues/{issue_id}", response_model=APIResponse)
async def get_fuel_issue(
    issue_id: int,
    current_user: TokenData = Depends(require_permission(Permissions.FUEL_READ)),
    db: AsyncSession = Depends(get_db),
):
    issue = await fuel_pump_service.get_fuel_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Fuel issue not found")
    from app.schemas.fuel_pump import FuelIssueResponse
    return APIResponse(success=True, data=FuelIssueResponse.model_validate(issue).model_dump())


# ──────────────────── Stock Transactions ────────────────────

@router.post("/stock", response_model=APIResponse)
async def add_stock(
    data: FuelStockTransactionCreate,
    current_user: TokenData = Depends(require_permission(Permissions.FUEL_STOCK_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    try:
        txn = await fuel_pump_service.add_stock_transaction(
            db, data, current_user.user_id,
            branch_id=current_user.branch_id,
            tenant_id=current_user.tenant_id,
        )
        await db.commit()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    from app.schemas.fuel_pump import FuelStockTransactionResponse
    return APIResponse(
        success=True,
        data=FuelStockTransactionResponse.model_validate(txn).model_dump(),
        message="Stock transaction recorded",
    )


@router.get("/stock", response_model=APIResponse)
async def list_stock_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    tank_id: Optional[int] = None,
    current_user: TokenData = Depends(require_any_permission([
        Permissions.FUEL_STOCK_VIEW, Permissions.FUEL_READ,
    ])),
    db: AsyncSession = Depends(get_db),
):
    txns, total = await fuel_pump_service.get_stock_transactions(
        db, tank_id, page, limit, current_user.tenant_id,
    )
    from app.schemas.fuel_pump import FuelStockTransactionResponse
    pages = (total + limit - 1) // limit if limit else 1
    return APIResponse(
        success=True,
        data=[FuelStockTransactionResponse.model_validate(t).model_dump() for t in txns],
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


# ──────────────────── Theft Alerts ────────────────────

@router.get("/alerts", response_model=APIResponse)
async def list_theft_alerts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    status: Optional[str] = None,
    current_user: TokenData = Depends(require_any_permission([
        Permissions.FUEL_REPORTS, Permissions.FUEL_READ, Permissions.ALERT_VIEW,
    ])),
    db: AsyncSession = Depends(get_db),
):
    alerts, total = await fuel_pump_service.get_theft_alerts(
        db, status, page, limit, current_user.tenant_id,
    )
    from app.schemas.fuel_pump import FuelTheftAlertResponse
    pages = (total + limit - 1) // limit if limit else 1
    return APIResponse(
        success=True,
        data=[FuelTheftAlertResponse.model_validate(a).model_dump() for a in alerts],
        pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages),
    )


@router.put("/alerts/{alert_id}", response_model=APIResponse)
async def resolve_alert(
    alert_id: int,
    data: FuelTheftAlertResolve,
    current_user: TokenData = Depends(require_any_permission([
        Permissions.FUEL_REPORTS, Permissions.ALERT_MANAGE,
    ])),
    db: AsyncSession = Depends(get_db),
):
    alert = await fuel_pump_service.resolve_theft_alert(db, alert_id, data, current_user.user_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    await db.commit()
    from app.schemas.fuel_pump import FuelTheftAlertResponse
    return APIResponse(
        success=True,
        data=FuelTheftAlertResponse.model_validate(alert).model_dump(),
        message="Alert updated",
    )


# ──────────────────── Dashboard ────────────────────

@router.get("/verification", response_model=APIResponse)
async def get_fuel_verification(
    days: int = Query(30, ge=1, le=365),
    current_user: TokenData = Depends(require_any_permission([
        Permissions.FUEL_READ, Permissions.FUEL_REPORTS,
    ])),
    db: AsyncSession = Depends(get_db),
):
    """Cross-verify depot fuel issues vs driver expense claims. Returns MATCHED/MISMATCH/PUMP_ONLY/DRIVER_ONLY."""
    records = await fuel_pump_service.get_fuel_verification(db, current_user.tenant_id, days)
    return APIResponse(success=True, data=records)


@router.get("/dashboard", response_model=APIResponse)
async def fuel_dashboard(
    current_user: TokenData = Depends(require_any_permission([
        Permissions.FUEL_READ, Permissions.FUEL_STOCK_VIEW, Permissions.FUEL_REPORTS,
    ])),
    db: AsyncSession = Depends(get_db),
):
    stats = await fuel_pump_service.get_dashboard_stats(db, current_user.tenant_id)
    return APIResponse(success=True, data=stats.model_dump())


# ──────────────────── Shifts ────────────────────
# Lightweight in-memory shift tracker.  A persistent PumpShift model can be
# added in a future migration; for now the app gets a working API contract.

from datetime import datetime
from typing import Any, Dict

_shifts: Dict[int, Dict[str, Any]] = {}  # shift_id → shift data
_shift_counter = 0


def _next_shift_id() -> int:
    global _shift_counter
    _shift_counter += 1
    return _shift_counter


@router.get("/shifts/active", response_model=APIResponse)
async def get_active_shift(
    current_user: TokenData = Depends(get_current_user),
):
    """Return the currently open shift for this user, or null if none."""
    active = [
        s for s in _shifts.values()
        if s.get("status") == "open" and s.get("started_by") == current_user.user_id
    ]
    return APIResponse(success=True, data=active[0] if active else None)


@router.post("/shifts", response_model=APIResponse, status_code=201)
async def start_shift(
    payload: dict,
    current_user: TokenData = Depends(get_current_user),
):
    """Open a new pump shift."""
    # Check for already-open shift
    for s in _shifts.values():
        if s.get("status") == "open" and s.get("started_by") == current_user.user_id:
            raise HTTPException(status_code=400, detail="A shift is already open. Close it first.")

    shift_id = _next_shift_id()
    shift = {
        "id": shift_id,
        "shift_type": payload.get("shift_type", "day"),
        "started_at": payload.get("started_at", datetime.utcnow().isoformat()),
        "started_by": current_user.user_id,
        "tank_readings": payload.get("tank_readings", []),
        "notes": payload.get("notes", ""),
        "status": "open",
    }
    _shifts[shift_id] = shift
    return APIResponse(success=True, data=shift, message="Shift started")


@router.post("/shifts/{shift_id}/close", response_model=APIResponse)
async def close_shift(
    shift_id: int,
    payload: dict,
    current_user: TokenData = Depends(get_current_user),
):
    """Close an open pump shift."""
    shift = _shifts.get(shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    if shift.get("started_by") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your shift")
    if shift.get("status") != "open":
        raise HTTPException(status_code=400, detail="Shift already closed")

    shift["status"] = "closed"
    shift["closed_at"] = payload.get("closed_at", datetime.utcnow().isoformat())
    shift["closing_readings"] = payload.get("tank_readings", [])
    return APIResponse(success=True, data=shift, message="Shift closed")
