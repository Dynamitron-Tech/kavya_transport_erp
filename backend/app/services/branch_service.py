# Branch Management Service
# Transport ERP — Phase E: Multi-Branch
#
# CRUD for branches + resource counts + P&L + cross-branch comparison.

import logging
from typing import Optional
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, or_

from app.models.postgres.user import Branch, User
from app.models.postgres.client import Client
from app.models.postgres.vehicle import Vehicle
from app.models.postgres.driver import Driver
from app.models.postgres.job import Job
from app.models.postgres.finance import Invoice

logger = logging.getLogger(__name__)


# ── CRUD ────────────────────────────────────────────────────

async def list_branches(
    db: AsyncSession,
    tenant_id: Optional[int] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    query = select(Branch).where(Branch.is_deleted == False)
    if tenant_id is not None:
        query = query.where(Branch.tenant_id == tenant_id)
    if search:
        query = query.where(
            or_(
                Branch.name.ilike(f"%{search}%"),
                Branch.code.ilike(f"%{search}%"),
                Branch.city.ilike(f"%{search}%"),
            )
        )
    if is_active is not None:
        query = query.where(Branch.is_active == is_active)
    result = await db.execute(query.order_by(Branch.name))
    return result.scalars().all()


async def get_branch(db: AsyncSession, branch_id: int):
    result = await db.execute(
        select(Branch).where(Branch.id == branch_id, Branch.is_deleted == False)
    )
    return result.scalar_one_or_none()


async def create_branch(db: AsyncSession, data: dict):
    branch = Branch(**data)
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch


async def update_branch(db: AsyncSession, branch_id: int, data: dict):
    branch = await get_branch(db, branch_id)
    if not branch:
        return None
    for k, v in data.items():
        if hasattr(branch, k) and v is not None:
            setattr(branch, k, v)
    await db.commit()
    await db.refresh(branch)
    return branch


async def delete_branch(db: AsyncSession, branch_id: int):
    branch = await get_branch(db, branch_id)
    if not branch:
        return False
    branch.is_deleted = True
    await db.commit()
    return True


# ── Resource Counts ─────────────────────────────────────────

async def get_branch_resources(db: AsyncSession, branch_id: int):
    """Get vehicle, driver, user, client counts for a branch."""
    vehicle_q = await db.execute(
        select(func.count(Vehicle.id)).where(
            Vehicle.branch_id == branch_id, Vehicle.is_deleted == False
        )
    )
    driver_q = await db.execute(
        select(func.count(Driver.id)).where(
            Driver.branch_id == branch_id, Driver.is_deleted == False
        )
    )
    user_q = await db.execute(
        select(func.count(User.id)).where(
            User.branch_id == branch_id, User.is_deleted == False
        )
    )
    client_q = await db.execute(
        select(func.count(Client.id)).where(
            Client.branch_id == branch_id, Client.is_deleted == False
        )
    )

    return {
        "branch_id": branch_id,
        "vehicles": vehicle_q.scalar() or 0,
        "drivers": driver_q.scalar() or 0,
        "staff": user_q.scalar() or 0,
        "clients": client_q.scalar() or 0,
    }


# ── P&L ─────────────────────────────────────────────────────

async def get_branch_pnl(
    db: AsyncSession,
    branch_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    """Profit & Loss for a single branch."""
    # Revenue = sum of invoiced amounts
    rev_query = select(func.coalesce(func.sum(Invoice.total_amount), 0)).where(
        Invoice.branch_id == branch_id, Invoice.is_deleted == False
    )
    # Collected = sum of amount_paid
    collected_query = select(func.coalesce(func.sum(Invoice.amount_paid), 0)).where(
        Invoice.branch_id == branch_id, Invoice.is_deleted == False
    )
    # Outstanding = sum of amount_due
    outstanding_query = select(func.coalesce(func.sum(Invoice.amount_due), 0)).where(
        Invoice.branch_id == branch_id, Invoice.is_deleted == False
    )
    # Job count
    job_query = select(func.count(Job.id)).where(
        Job.branch_id == branch_id, Job.is_deleted == False
    )

    if start_date:
        rev_query = rev_query.where(Invoice.created_at >= datetime.combine(start_date, datetime.min.time()))
        collected_query = collected_query.where(Invoice.created_at >= datetime.combine(start_date, datetime.min.time()))
        outstanding_query = outstanding_query.where(Invoice.created_at >= datetime.combine(start_date, datetime.min.time()))
        job_query = job_query.where(Job.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        rev_query = rev_query.where(Invoice.created_at <= datetime.combine(end_date, datetime.max.time()))
        collected_query = collected_query.where(Invoice.created_at <= datetime.combine(end_date, datetime.max.time()))
        outstanding_query = outstanding_query.where(Invoice.created_at <= datetime.combine(end_date, datetime.max.time()))
        job_query = job_query.where(Job.created_at <= datetime.combine(end_date, datetime.max.time()))

    revenue = (await db.execute(rev_query)).scalar() or 0
    collected = (await db.execute(collected_query)).scalar() or 0
    outstanding = (await db.execute(outstanding_query)).scalar() or 0
    jobs = (await db.execute(job_query)).scalar() or 0

    return {
        "branch_id": branch_id,
        "revenue": float(revenue),
        "collected": float(collected),
        "outstanding": float(outstanding),
        "jobs": jobs,
    }


# ── Cross-Branch Comparison ─────────────────────────────────

async def get_cross_branch_comparison(
    db: AsyncSession,
    tenant_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    """Compare all branches side-by-side."""
    branches = await list_branches(db, tenant_id=tenant_id, is_active=True)
    comparison = []
    for br in branches:
        resources = await get_branch_resources(db, br.id)
        pnl = await get_branch_pnl(db, br.id, start_date, end_date)
        comparison.append({
            "id": br.id,
            "name": br.name,
            "code": br.code,
            "city": br.city,
            **resources,
            **pnl,
        })
    return comparison
