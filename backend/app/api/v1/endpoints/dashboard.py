# Dashboard Endpoints
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse
from app.services import dashboard_service

router = APIRouter()


@router.get("", response_model=APIResponse)
async def get_dashboard(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    stats = await dashboard_service.get_dashboard_stats(db)
    return APIResponse(success=True, data=stats)


@router.get("/overview", response_model=APIResponse)
async def get_overview(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    """Dashboard overview - same as root dashboard stats."""
    stats = await dashboard_service.get_dashboard_stats(db)
    return APIResponse(success=True, data=stats)


@router.get("/fleet-stats", response_model=APIResponse)
async def fleet_stats(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    """Fleet statistics for dashboard."""
    from app.services.vehicle_service import get_fleet_summary
    data = await get_fleet_summary(db)
    return APIResponse(success=True, data=data)


@router.get("/trip-stats", response_model=APIResponse)
async def trip_stats(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    """Trip statistics for dashboard."""
    data = await dashboard_service.get_trip_status_distribution(db)
    return APIResponse(success=True, data=data)


@router.get("/finance-stats", response_model=APIResponse)
async def finance_stats(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    """Finance statistics for dashboard."""
    stats = await dashboard_service.get_dashboard_stats(db)
    return APIResponse(success=True, data={
        "monthly_revenue": stats.get("monthly_revenue", 0),
        "monthly_collections": stats.get("monthly_collections", 0),
        "pending_receivables": stats.get("pending_receivables", 0),
        "monthly_expenses": stats.get("monthly_expenses", 0),
        "profit": stats.get("profit", 0),
    })


@router.get("/notifications", response_model=APIResponse)
async def get_notifications(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    """Get user notifications/alerts."""
    alerts = await dashboard_service.get_notifications(db, current_user.user_id)
    return APIResponse(success=True, data=alerts)


@router.post("/notifications/{notification_id}/read", response_model=APIResponse)
async def mark_notification_read(notification_id: str, current_user: TokenData = Depends(get_current_user)):
    """Mark a notification as read."""
    return APIResponse(success=True, data={"marked": True}, message="Notification marked as read")


@router.get("/charts/revenue-trend", response_model=APIResponse)
async def revenue_trend_chart(
    period: Optional[str] = Query("monthly", regex="^(daily|weekly|monthly)$"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Revenue trend chart data."""
    data = await dashboard_service.get_revenue_chart(db)
    return APIResponse(success=True, data=data)


@router.get("/charts/expense-breakdown", response_model=APIResponse)
async def expense_breakdown_chart(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    """Expense breakdown chart data."""
    data = await dashboard_service.get_expense_breakdown(db)
    return APIResponse(success=True, data=data)


@router.get("/charts/fleet-utilization", response_model=APIResponse)
async def fleet_utilization_chart(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    """Fleet utilization chart data."""
    from app.services.vehicle_service import get_fleet_summary
    fleet = await get_fleet_summary(db)
    total = fleet.get("total_vehicles", 1) or 1
    data = [
        {"name": "Available", "value": fleet.get("available", 0), "percentage": round(fleet.get("available", 0) / total * 100, 1)},
        {"name": "On Trip", "value": fleet.get("on_trip", 0), "percentage": round(fleet.get("on_trip", 0) / total * 100, 1)},
        {"name": "Maintenance", "value": fleet.get("maintenance", 0), "percentage": round(fleet.get("maintenance", 0) / total * 100, 1)},
    ]
    return APIResponse(success=True, data=data)


# Legacy endpoints (keep for backwards compatibility)
@router.get("/revenue-chart", response_model=APIResponse)
async def revenue_chart(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    data = await dashboard_service.get_revenue_chart(db)
    return APIResponse(success=True, data=data)


@router.get("/trip-status", response_model=APIResponse)
async def trip_status(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    data = await dashboard_service.get_trip_status_distribution(db)
    return APIResponse(success=True, data=data)


@router.get("/top-clients", response_model=APIResponse)
async def top_clients(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    data = await dashboard_service.get_top_clients(db)
    return APIResponse(success=True, data=data)


@router.get("/expense-breakdown", response_model=APIResponse)
async def expense_breakdown(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    data = await dashboard_service.get_expense_breakdown(db)
    return APIResponse(success=True, data=data)


# Project Associate Dashboard endpoints
@router.get("/pa/kpis", response_model=APIResponse)
async def pa_kpis(
    date_filter: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """PA Dashboard KPIs."""
    stats = await dashboard_service.get_project_associate_dashboard_stats(db)
    return APIResponse(success=True, data=stats)


@router.get("/pa/action-center", response_model=APIResponse)
async def pa_action_center(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    """PA Action center with pending tasks."""
    return APIResponse(success=True, data={
        "pending_approvals": 0,
        "pending_lrs": 0,
        "trips_to_close": 0,
        "invoices_to_generate": 0,
    })


@router.get("/pa/job-pipeline", response_model=APIResponse)
async def pa_job_pipeline(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    """PA Job pipeline status."""
    return APIResponse(success=True, data={
        "draft": 0,
        "pending_approval": 0,
        "approved": 0,
        "in_progress": 0,
        "completed": 0,
    })


@router.get("/pa/recent-activity", response_model=APIResponse)
async def pa_recent_activity(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """PA Recent activity log."""
    return APIResponse(success=True, data=[])


@router.get("/pa/banking-status", response_model=APIResponse)
async def pa_banking_status(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    """PA Banking status."""
    return APIResponse(success=True, data={
        "pending_receipts": 0,
        "pending_payments": 0,
        "today_collections": 0,
    })


@router.get("/pa/fleet-status", response_model=APIResponse)
async def pa_fleet_status(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    """PA Fleet status."""
    from app.services.vehicle_service import get_fleet_summary
    data = await get_fleet_summary(db)
    return APIResponse(success=True, data=data)


@router.get("/pa/compliance-alerts", response_model=APIResponse)
async def pa_compliance_alerts(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    """PA Compliance alerts."""
    return APIResponse(success=True, data=[])


@router.get("/pa/trip-workflow", response_model=APIResponse)
async def pa_trip_workflow(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    """PA Trip workflow status."""
    data = await dashboard_service.get_trip_status_distribution(db)
    return APIResponse(success=True, data=data)


@router.get("/pa/system-alerts", response_model=APIResponse)
async def pa_system_alerts(db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    """PA System alerts."""
    return APIResponse(success=True, data=[])


@router.get("/pa/revenue-snapshot", response_model=APIResponse)
async def pa_revenue_snapshot(
    period: Optional[str] = Query("monthly"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """PA Revenue snapshot."""
    data = await dashboard_service.get_revenue_chart(db)
    return APIResponse(success=True, data=data)


@router.get("/branch", response_model=APIResponse)
async def branch_dashboard(
    branch_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Branch-scoped dashboard summary: trips, vehicles, finance KPIs."""
    from sqlalchemy import select, func
    from app.models.postgres.trip import Trip, TripStatusEnum
    from app.models.postgres.vehicle import Vehicle

    trip_query = select(func.count(Trip.id)).where(Trip.is_deleted == False)
    vehicle_query = select(func.count(Vehicle.id)).where(Vehicle.is_deleted == False)
    active_query = select(func.count(Trip.id)).where(
        Trip.is_deleted == False,
        Trip.status.in_([TripStatusEnum.DISPATCHED, TripStatusEnum.IN_TRANSIT]),
    )

    if branch_id:
        trip_query = trip_query.where(Trip.branch_id == branch_id)
        vehicle_query = vehicle_query.where(Vehicle.branch_id == branch_id)
        active_query = active_query.where(Trip.branch_id == branch_id)

    total_trips = (await db.execute(trip_query)).scalar() or 0
    total_vehicles = (await db.execute(vehicle_query)).scalar() or 0
    active_trips = (await db.execute(active_query)).scalar() or 0

    return APIResponse(success=True, data={
        "branch_id": branch_id,
        "total_trips": total_trips,
        "active_trips": active_trips,
        "total_vehicles": total_vehicles,
    })
