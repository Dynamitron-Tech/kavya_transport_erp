# Fuel Pump Service Layer
# Business logic for fuel management with theft detection

from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Optional, List, Tuple

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.postgres.fuel_pump import (
    DepotFuelTank, DepotFuelPump, FuelIssue, FuelStockTransaction, FuelTheftAlert,
    FuelTopUpRequest, FuelType, TransactionType, TheftAlertStatus,
)
from app.models.postgres.vehicle import Vehicle
from app.models.postgres.driver import Driver
from app.models.postgres.user import User, Branch
from app.schemas.fuel_pump import (
    DepotFuelTankCreate, DepotFuelTankUpdate, FuelIssueCreate,
    FuelStockTransactionCreate, FuelTheftAlertResolve,
    FuelDashboardStats, DepotFuelTankResponse,
)

# Theft detection thresholds
MILEAGE_DEVIATION_THRESHOLD = 30  # percent below expected mileage triggers alert
MIN_ODOMETER_GAP_KM = 5  # minimum km between fuel issues to avoid false positives


# ──────────────────── Tank CRUD ────────────────────

async def create_tank(db: AsyncSession, data: DepotFuelTankCreate, tenant_id: Optional[int] = None) -> DepotFuelTank:
    tank = DepotFuelTank(
        name=data.name,
        fuel_type=FuelType(data.fuel_type),
        capacity_litres=data.capacity_litres,
        current_stock_litres=data.current_stock_litres,
        min_stock_alert=data.min_stock_alert,
        location=data.location,
        branch_id=data.branch_id,
        tenant_id=tenant_id,
    )
    db.add(tank)
    await db.flush()
    return tank


async def get_tanks(db: AsyncSession, tenant_id: Optional[int] = None, branch_id: Optional[int] = None) -> List[DepotFuelTank]:
    q = select(DepotFuelTank).where(DepotFuelTank.is_deleted == False)
    if tenant_id:
        q = q.where(DepotFuelTank.tenant_id == tenant_id)
    if branch_id:
        q = q.where(DepotFuelTank.branch_id == branch_id)
    result = await db.execute(q.order_by(DepotFuelTank.name))
    return list(result.scalars().all())


async def get_tank(db: AsyncSession, tank_id: int) -> Optional[DepotFuelTank]:
    result = await db.execute(
        select(DepotFuelTank).where(DepotFuelTank.id == tank_id, DepotFuelTank.is_deleted == False)
    )
    return result.scalar_one_or_none()


async def update_tank(db: AsyncSession, tank_id: int, data: DepotFuelTankUpdate) -> Optional[DepotFuelTank]:
    tank = await get_tank(db, tank_id)
    if not tank:
        return None
    update_data = data.model_dump(exclude_unset=True)
    if "fuel_type" in update_data and update_data["fuel_type"]:
        update_data["fuel_type"] = FuelType(update_data["fuel_type"])
    for key, value in update_data.items():
        setattr(tank, key, value)
    await db.flush()
    return tank


async def delete_tank(db: AsyncSession, tank_id: int, user_id: int) -> bool:
    tank = await get_tank(db, tank_id)
    if not tank:
        return False
    tank.is_deleted = True
    tank.deleted_at = datetime.utcnow()
    tank.deleted_by = user_id
    await db.flush()
    return True


# ──────────────────── Fuel Issue (Dispense) ────────────────────

async def issue_fuel(
    db: AsyncSession,
    data: FuelIssueCreate,
    issued_by: int,
    branch_id: Optional[int] = None,
    tenant_id: Optional[int] = None,
) -> Tuple[FuelIssue, Optional[FuelTheftAlert]]:
    """Dispense fuel from a tank to a vehicle. Returns (issue, alert_or_none)."""

    if not data.vehicle_id and not data.external_vehicle_number:
        raise ValueError("Either vehicle_id or external_vehicle_number is required")

    total_amount = data.quantity_litres * data.rate_per_litre

    # Tank is optional until pump management is configured by fleet manager
    tank = None
    if data.tank_id is not None:
        tank = await get_tank(db, data.tank_id)
        if not tank:
            raise ValueError("Tank not found")
        if tank.current_stock_litres < data.quantity_litres:
            raise ValueError(
                f"Insufficient stock: {tank.current_stock_litres}L available, "
                f"{data.quantity_litres}L requested"
            )

    issue = FuelIssue(
        tank_id=data.tank_id,
        pump_id=data.pump_id,
        vehicle_id=data.vehicle_id,
        external_vehicle_number=data.external_vehicle_number,
        driver_id=data.driver_id,
        trip_id=data.trip_id,
        fuel_type=FuelType(data.fuel_type),
        quantity_litres=data.quantity_litres,
        rate_per_litre=data.rate_per_litre,
        total_amount=total_amount,
        issued_by=issued_by,
        issued_at=data.issued_at,
        receipt_number=data.receipt_number,
        remarks=data.remarks,
        branch_id=branch_id,
        tenant_id=tenant_id,
    )
    db.add(issue)

    # Deduct from tank (only when a tank is linked)
    if tank is not None:
        stock_before = tank.current_stock_litres
        tank.current_stock_litres = tank.current_stock_litres - data.quantity_litres

        txn = FuelStockTransaction(
            tank_id=data.tank_id,
            transaction_type=TransactionType.ISSUE,
            quantity_litres=data.quantity_litres,
            rate_per_litre=data.rate_per_litre,
            total_amount=total_amount,
            stock_before=stock_before,
            stock_after=tank.current_stock_litres,
            reference_number=data.receipt_number,
            remarks=f"Fuel issue to {data.external_vehicle_number or f'vehicle #{data.vehicle_id}'}",
            created_by=issued_by,
            branch_id=branch_id,
            tenant_id=tenant_id,
        )
        db.add(txn)

    await db.flush()

    # Run theft detection
    alert = await _check_fuel_anomaly(db, issue, branch_id, tenant_id)

    return issue, alert


async def get_fuel_issues(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    vehicle_id: Optional[int] = None,
    driver_id: Optional[int] = None,
    tank_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    flagged_only: bool = False,
    tenant_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    registration: Optional[str] = None,
) -> Tuple[List[FuelIssue], int]:
    q = select(FuelIssue)
    count_q = select(func.count(FuelIssue.id))

    filters = []
    if vehicle_id:
        # Match both company-vehicle issues (vehicle_id) and external issues
        # (external_vehicle_number) for the same registration plate.
        from sqlalchemy import or_ as _or
        from app.models.postgres.vehicle import Vehicle
        reg_subq = select(Vehicle.registration_number).where(Vehicle.id == vehicle_id).scalar_subquery()
        filters.append(_or(
            FuelIssue.vehicle_id == vehicle_id,
            FuelIssue.external_vehicle_number == reg_subq,
        ))
    if driver_id:
        filters.append(FuelIssue.driver_id == driver_id)
    if tank_id:
        filters.append(FuelIssue.tank_id == tank_id)
    if date_from:
        filters.append(FuelIssue.issued_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        filters.append(FuelIssue.issued_at <= datetime.combine(date_to, datetime.max.time()))
    if flagged_only:
        filters.append(FuelIssue.is_flagged == True)
    if tenant_id:
        filters.append(FuelIssue.tenant_id == tenant_id)
    # Skip branch filter when looking up by vehicle_id/registration (fleet manager viewing a vehicle)
    if branch_id and not vehicle_id and not registration:
        filters.append(FuelIssue.branch_id == branch_id)
    if registration:
        reg_upper = registration.strip().upper()
        from sqlalchemy import or_ as _or
        from app.models.postgres.vehicle import Vehicle
        # Match external_vehicle_number directly OR via vehicle FK for company vehicles
        vehicle_id_subq = select(Vehicle.id).where(Vehicle.registration_number == reg_upper)
        filters.append(_or(
            FuelIssue.external_vehicle_number == reg_upper,
            FuelIssue.vehicle_id.in_(vehicle_id_subq),
        ))

    if filters:
        q = q.where(and_(*filters))
        count_q = count_q.where(and_(*filters))

    total = (await db.execute(count_q)).scalar() or 0
    offset = (page - 1) * limit
    q = q.order_by(FuelIssue.issued_at.desc()).offset(offset).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all()), total


async def get_fuel_issue(db: AsyncSession, issue_id: int) -> Optional[FuelIssue]:
    result = await db.execute(select(FuelIssue).where(FuelIssue.id == issue_id))
    return result.scalar_one_or_none()


# ──────────────────── Stock Transactions ────────────────────

async def add_stock_transaction(
    db: AsyncSession,
    data: FuelStockTransactionCreate,
    created_by: int,
    branch_id: Optional[int] = None,
    tenant_id: Optional[int] = None,
) -> FuelStockTransaction:
    tank = await get_tank(db, data.tank_id)
    if not tank:
        raise ValueError("Tank not found")

    txn_type = TransactionType(data.transaction_type)
    stock_before = tank.current_stock_litres

    if txn_type in (TransactionType.TANKER_REFILL, TransactionType.MANUAL_ADJUSTMENT):
        new_stock = stock_before + data.quantity_litres
        if new_stock > tank.capacity_litres:
            raise ValueError(
                f"Would exceed tank capacity: {tank.capacity_litres}L. "
                f"Current: {stock_before}L, Adding: {data.quantity_litres}L"
            )
        tank.current_stock_litres = new_stock
    elif txn_type == TransactionType.LOSS:
        if data.quantity_litres > stock_before:
            raise ValueError("Loss quantity exceeds current stock")
        tank.current_stock_litres = stock_before - data.quantity_litres

    total_amount = None
    if data.rate_per_litre:
        total_amount = data.quantity_litres * data.rate_per_litre

    txn = FuelStockTransaction(
        tank_id=data.tank_id,
        transaction_type=txn_type,
        quantity_litres=data.quantity_litres,
        rate_per_litre=data.rate_per_litre,
        total_amount=total_amount,
        stock_before=stock_before,
        stock_after=tank.current_stock_litres,
        reference_number=data.reference_number,
        remarks=data.remarks,
        created_by=created_by,
        branch_id=branch_id,
        tenant_id=tenant_id,
    )
    db.add(txn)
    await db.flush()
    return txn


async def get_stock_transactions(
    db: AsyncSession,
    tank_id: Optional[int] = None,
    page: int = 1,
    limit: int = 20,
    tenant_id: Optional[int] = None,
) -> Tuple[List[FuelStockTransaction], int]:
    q = select(FuelStockTransaction)
    count_q = select(func.count(FuelStockTransaction.id))
    filters = []
    if tank_id:
        filters.append(FuelStockTransaction.tank_id == tank_id)
    if tenant_id:
        filters.append(FuelStockTransaction.tenant_id == tenant_id)
    if filters:
        q = q.where(and_(*filters))
        count_q = count_q.where(and_(*filters))
    total = (await db.execute(count_q)).scalar() or 0
    offset = (page - 1) * limit
    q = q.order_by(FuelStockTransaction.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all()), total


# ──────────────────── Theft Alerts ────────────────────

async def _check_fuel_anomaly(
    db: AsyncSession,
    issue: FuelIssue,
    branch_id: Optional[int] = None,
    tenant_id: Optional[int] = None,
) -> Optional[FuelTheftAlert]:
    """Check if a fuel issue looks anomalous compared to vehicle's expected mileage."""
    if not issue.odometer_reading:
        return None

    # Get the previous fuel issue for this vehicle
    prev_q = (
        select(FuelIssue)
        .where(
            FuelIssue.vehicle_id == issue.vehicle_id,
            FuelIssue.id != issue.id,
            FuelIssue.odometer_reading.isnot(None),
        )
        .order_by(FuelIssue.issued_at.desc())
        .limit(1)
    )
    prev_result = await db.execute(prev_q)
    prev_issue = prev_result.scalar_one_or_none()
    if not prev_issue or not prev_issue.odometer_reading:
        return None

    km_driven = float(issue.odometer_reading - prev_issue.odometer_reading)
    if km_driven < MIN_ODOMETER_GAP_KM:
        return None

    # Get vehicle's expected mileage
    v_result = await db.execute(select(Vehicle).where(Vehicle.id == issue.vehicle_id))
    vehicle = v_result.scalar_one_or_none()
    if not vehicle or not vehicle.mileage_per_litre:
        return None

    expected_litres = Decimal(str(km_driven)) / vehicle.mileage_per_litre
    actual_litres = prev_issue.quantity_litres  # fuel consumed between readings

    if expected_litres <= 0:
        return None

    deviation_pct = ((actual_litres - expected_litres) / expected_litres) * 100

    if deviation_pct > MILEAGE_DEVIATION_THRESHOLD:
        alert = FuelTheftAlert(
            fuel_issue_id=issue.id,
            vehicle_id=issue.vehicle_id,
            driver_id=issue.driver_id,
            alert_type="excessive_consumption",
            severity="warning" if deviation_pct < 50 else "critical",
            description=(
                f"Vehicle consumed {actual_litres:.1f}L over {km_driven:.0f}km "
                f"(expected ~{expected_litres:.1f}L). "
                f"Deviation: {deviation_pct:.1f}% above expected."
            ),
            expected_litres=expected_litres,
            actual_litres=actual_litres,
            deviation_pct=deviation_pct,
            branch_id=branch_id,
            tenant_id=tenant_id,
        )
        db.add(alert)

        # Flag the issue
        issue.is_flagged = True
        issue.flag_reason = f"Excessive consumption: {deviation_pct:.1f}% deviation"

        await db.flush()
        return alert

    return None


async def get_theft_alerts(
    db: AsyncSession,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    tenant_id: Optional[int] = None,
    branch_id: Optional[int] = None,
) -> Tuple[List[FuelTheftAlert], int]:
    q = select(FuelTheftAlert)
    count_q = select(func.count(FuelTheftAlert.id))
    filters = []
    if status:
        filters.append(FuelTheftAlert.status == TheftAlertStatus(status))
    if tenant_id:
        filters.append(FuelTheftAlert.tenant_id == tenant_id)
    if branch_id:
        filters.append(FuelTheftAlert.branch_id == branch_id)
    if filters:
        q = q.where(and_(*filters))
        count_q = count_q.where(and_(*filters))
    total = (await db.execute(count_q)).scalar() or 0
    offset = (page - 1) * limit
    q = q.order_by(FuelTheftAlert.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all()), total


async def resolve_theft_alert(
    db: AsyncSession,
    alert_id: int,
    data: FuelTheftAlertResolve,
    resolved_by: int,
) -> Optional[FuelTheftAlert]:
    result = await db.execute(select(FuelTheftAlert).where(FuelTheftAlert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        return None
    alert.status = TheftAlertStatus(data.status)
    alert.resolved_by = resolved_by
    alert.resolved_at = datetime.utcnow()
    alert.resolution_notes = data.resolution_notes
    await db.flush()
    return alert


# ──────────────────── Fuel Cross-Verification ────────────────────

async def get_fuel_verification(
    db: AsyncSession,
    tenant_id: Optional[int],
    days: int = 30,
) -> List[dict]:
    """Cross-verify depot fuel issues against driver trip fuel expense claims.

    Joins FuelIssue records with TripExpense (FUEL) records on vehicle_id + date,
    classifying each record as MATCHED / MISMATCH / PUMP_ONLY / DRIVER_ONLY.
    """
    from app.models.postgres.trip import Trip, TripExpense, ExpenseCategory

    since = datetime.utcnow() - timedelta(days=days)
    since_date = since.date()

    # 1. Fetch fuel issues with vehicle registration
    issues_result = await db.execute(
        select(
            FuelIssue.id,
            FuelIssue.vehicle_id,
            FuelIssue.driver_id,
            FuelIssue.issued_at,
            FuelIssue.quantity_litres,
            FuelIssue.total_amount,
            FuelIssue.receipt_number,
            FuelIssue.is_flagged,
            Vehicle.registration_number,
        )
        .join(Vehicle, Vehicle.id == FuelIssue.vehicle_id)
        .where(FuelIssue.tenant_id == tenant_id)
        .where(FuelIssue.issued_at >= since)
        .order_by(FuelIssue.issued_at.desc())
    )
    issues = issues_result.all()

    # 2. Fetch trip fuel expenses grouped by vehicle + date
    expenses_result = await db.execute(
        select(
            Trip.vehicle_id,
            Trip.trip_date,
            func.sum(TripExpense.amount).label("total_expense"),
        )
        .join(TripExpense, TripExpense.trip_id == Trip.id)
        .where(TripExpense.category == ExpenseCategory.FUEL)
        .where(Trip.tenant_id == tenant_id)
        .where(Trip.trip_date >= since_date)
        .group_by(Trip.vehicle_id, Trip.trip_date)
    )
    expenses = expenses_result.all()

    # Build lookup: (vehicle_id, date) -> driver_claimed_amount
    expense_map: dict = {}
    for e in expenses:
        expense_map[(e.vehicle_id, e.trip_date)] = float(e.total_expense)

    # 3. Merge and classify each fuel issue
    records: List[dict] = []
    seen_keys: set = set()

    for issue in issues:
        issue_date = issue.issued_at.date()
        key = (issue.vehicle_id, issue_date)
        seen_keys.add(key)

        pump_amount = float(issue.total_amount)
        driver_amount = expense_map.get(key)

        if driver_amount is not None:
            variance = abs(pump_amount - driver_amount) / pump_amount if pump_amount > 0 else 0
            status = "MATCHED" if variance <= 0.10 else "MISMATCH"
        else:
            variance = None
            status = "PUMP_ONLY"

        records.append({
            "issue_id": issue.id,
            "vehicle_id": issue.vehicle_id,
            "registration_number": issue.registration_number,
            "issue_date": issue_date.isoformat(),
            "quantity_litres": float(issue.quantity_litres),
            "pump_amount": pump_amount,
            "driver_amount": driver_amount,
            "variance_pct": round(variance * 100, 1) if variance is not None else None,
            "status": status,
            "is_flagged": bool(issue.is_flagged),
            "receipt_number": issue.receipt_number,
        })

    # 4. Add driver-only records (expense with no matching depot fuel issue)
    for (vehicle_id, exp_date), exp_amount in expense_map.items():
        if (vehicle_id, exp_date) not in seen_keys:
            records.append({
                "issue_id": None,
                "vehicle_id": vehicle_id,
                "registration_number": None,
                "issue_date": exp_date.isoformat(),
                "quantity_litres": None,
                "pump_amount": None,
                "driver_amount": exp_amount,
                "variance_pct": None,
                "status": "DRIVER_ONLY",
                "is_flagged": False,
                "receipt_number": None,
            })

    records.sort(key=lambda r: r["issue_date"], reverse=True)
    return records


# ──────────────────── Dashboard Stats ────────────────────

async def get_dashboard_stats(
    db: AsyncSession,
    tenant_id: Optional[int] = None,
    branch_id: Optional[int] = None,
) -> FuelDashboardStats:
    # Resolve branch name
    branch_name: Optional[str] = None
    if branch_id:
        from app.models.postgres.user import Branch
        br = await db.execute(select(Branch).where(Branch.id == branch_id))
        branch_obj = br.scalar_one_or_none()
        if branch_obj:
            branch_name = branch_obj.name
    tanks = await get_tanks(db, tenant_id, branch_id=branch_id)
    total_stock = sum(float(t.current_stock_litres) for t in tanks)

    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())

    month_start = datetime.combine(today.replace(day=1), datetime.min.time())

    # Today's issues
    today_q = select(
        func.coalesce(func.sum(FuelIssue.quantity_litres), 0),
        func.count(FuelIssue.id),
    ).where(FuelIssue.issued_at.between(today_start, today_end))
    if tenant_id:
        today_q = today_q.where(FuelIssue.tenant_id == tenant_id)
    if branch_id:
        today_q = today_q.where(FuelIssue.branch_id == branch_id)
    today_result = await db.execute(today_q)
    today_row = today_result.one()

    # Month totals
    month_q = select(
        func.coalesce(func.sum(FuelIssue.quantity_litres), 0),
        func.coalesce(func.sum(FuelIssue.total_amount), 0),
    ).where(FuelIssue.issued_at >= month_start)
    if tenant_id:
        month_q = month_q.where(FuelIssue.tenant_id == tenant_id)
    if branch_id:
        month_q = month_q.where(FuelIssue.branch_id == branch_id)
    month_result = await db.execute(month_q)
    month_row = month_result.one()

    # Open alerts
    alert_q = select(func.count(FuelTheftAlert.id)).where(
        FuelTheftAlert.status.in_([TheftAlertStatus.OPEN, TheftAlertStatus.INVESTIGATING])
    )
    if tenant_id:
        alert_q = alert_q.where(FuelTheftAlert.tenant_id == tenant_id)
    if branch_id:
        alert_q = alert_q.where(FuelTheftAlert.branch_id == branch_id)
    open_alerts = (await db.execute(alert_q)).scalar() or 0

    return FuelDashboardStats(
        total_stock_litres=Decimal(str(total_stock)),
        today_issued_litres=Decimal(str(today_row[0])),
        today_issued_count=int(today_row[1]),
        month_issued_litres=Decimal(str(month_row[0])),
        month_cost=Decimal(str(month_row[1])),
        open_alerts=open_alerts,
        tanks=[DepotFuelTankResponse.model_validate(t) for t in tanks],
        branch_name=branch_name,
    )


# ──────────────────── Fuel Top-Up Requests ────────────────────

async def create_top_up_request(
    db: AsyncSession,
    data,
    created_by: int,
    branch_id: Optional[int] = None,
    tenant_id: Optional[int] = None,
) -> FuelTopUpRequest:
    tank = await get_tank(db, data.tank_id)
    if not tank:
        raise ValueError("Tank not found")
    req = FuelTopUpRequest(
        tank_id=data.tank_id,
        branch_id=branch_id or tank.branch_id,
        tenant_id=tenant_id,
        quantity_litres=data.quantity_litres,
        total_amount=data.total_amount,
        remarks=data.remarks,
        status='pending',
        created_by=created_by,
    )
    db.add(req)
    await db.flush()
    return req


async def get_top_up_requests(
    db: AsyncSession,
    status: Optional[str] = None,
    tenant_id: Optional[int] = None,
) -> List[FuelTopUpRequest]:
    q = select(FuelTopUpRequest)
    filters = []
    if status:
        filters.append(FuelTopUpRequest.status == status)
    if tenant_id:
        filters.append(FuelTopUpRequest.tenant_id == tenant_id)
    if filters:
        q = q.where(and_(*filters))
    q = q.order_by(FuelTopUpRequest.created_at.desc())
    result = await db.execute(q)
    return list(result.scalars().all())


async def mark_top_up_paid(
    db: AsyncSession,
    request_id: int,
    paid_by: int,
    tenant_id: Optional[int] = None,
) -> FuelTopUpRequest:
    req_result = await db.execute(
        select(FuelTopUpRequest).where(FuelTopUpRequest.id == request_id)
    )
    req = req_result.scalar_one_or_none()
    if not req:
        raise ValueError("Top-up request not found")
    if req.status == 'paid':
        raise ValueError("Already marked as paid")

    # Update tank stock
    from app.schemas.fuel_pump import FuelStockTransactionCreate
    txn_data = FuelStockTransactionCreate(
        tank_id=req.tank_id,
        transaction_type='TANKER_REFILL',
        quantity_litres=req.quantity_litres,
        total_amount=req.total_amount,
        remarks=req.remarks,
    )
    await add_stock_transaction(
        db, txn_data, paid_by,
        branch_id=req.branch_id,
        tenant_id=tenant_id or req.tenant_id,
    )

    req.status = 'paid'
    req.paid_by = paid_by
    req.paid_at = datetime.utcnow()
    await db.flush()
    return req


async def reject_top_up_request(
    db: AsyncSession,
    request_id: int,
    rejected_by: int,
    tenant_id: Optional[int] = None,
) -> FuelTopUpRequest:
    req_result = await db.execute(
        select(FuelTopUpRequest).where(FuelTopUpRequest.id == request_id)
    )
    req = req_result.scalar_one_or_none()
    if not req:
        raise ValueError("Top-up request not found")
    if req.status == 'paid':
        raise ValueError("Cannot reject an already paid request")
    if req.status == 'rejected':
        raise ValueError("Request is already rejected")

    req.status = 'rejected'
    await db.flush()
    return req


async def enrich_top_up_requests(
    db: AsyncSession,
    requests: List[FuelTopUpRequest],
) -> List[dict]:
    """Attach tank_name and branch_name to each request."""
    tank_ids = list({r.tank_id for r in requests})
    branch_ids = list({r.branch_id for r in requests if r.branch_id})
    user_ids = list({r.created_by for r in requests})

    tanks = {}
    if tank_ids:
        res = await db.execute(select(DepotFuelTank).where(DepotFuelTank.id.in_(tank_ids)))
        tanks = {t.id: t.name for t in res.scalars().all()}

    branches = {}
    if branch_ids:
        res = await db.execute(select(Branch).where(Branch.id.in_(branch_ids)))
        branches = {b.id: b.name for b in res.scalars().all()}

    users = {}
    if user_ids:
        res = await db.execute(select(User).where(User.id.in_(user_ids)))
        users = {u.id: (f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email or str(u.id)) for u in res.scalars().all()}

    result = []
    for r in requests:
        d = {
            'id': r.id,
            'tank_id': r.tank_id,
            'branch_id': r.branch_id,
            'quantity_litres': float(r.quantity_litres),
            'total_amount': float(r.total_amount) if r.total_amount else None,
            'remarks': r.remarks,
            'status': r.status,
            'created_by': r.created_by,
            'created_at': r.created_at.isoformat() if r.created_at else None,
            'paid_by': r.paid_by,
            'paid_at': r.paid_at.isoformat() if r.paid_at else None,
            'tank_name': tanks.get(r.tank_id),
            'branch_name': branches.get(r.branch_id) if r.branch_id else None,
            'creator_name': users.get(r.created_by),
        }
        result.append(d)
    return result
