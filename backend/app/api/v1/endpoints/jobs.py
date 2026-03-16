# Job Management Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.job import JobCreate, JobUpdate, JobStatusChange
from app.services import job_service

router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_jobs(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None, status: Optional[str] = None,
    client_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.JOB_READ)),
):
    jobs, total = await job_service.list_jobs(db, page, limit, search, status, client_id)
    pages = (total + limit - 1) // limit
    items = []
    for job in jobs:
        items.append(await job_service.get_job_with_client_name(db, job))
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/{job_id}", response_model=APIResponse)
async def get_job(job_id: int, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    job = await job_service.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    data = await job_service.get_job_with_client_name(db, job)
    return APIResponse(success=True, data=data)


@router.post("", response_model=APIResponse, status_code=201)
async def create_job(
    data: JobCreate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.JOB_CREATE)),
):
    job = await job_service.create_job(db, data.model_dump(), current_user.user_id)
    return APIResponse(success=True, data={"id": job.id, "job_number": job.job_number}, message="Job created")


@router.put("/{job_id}", response_model=APIResponse)
async def update_job(
    job_id: int, data: JobUpdate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.JOB_UPDATE)),
):
    job = await job_service.update_job(db, job_id, data.model_dump(exclude_unset=True))
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return APIResponse(success=True, message="Job updated")


@router.delete("/{job_id}", response_model=APIResponse)
async def delete_job(
    job_id: int, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.JOB_DELETE)),
):
    success = await job_service.delete_job(db, job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return APIResponse(success=True, message="Job deleted")


@router.post("/{job_id}/status", response_model=APIResponse)
async def change_status(
    job_id: int, data: JobStatusChange, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.JOB_UPDATE)),
):
    job, error = await job_service.change_job_status(db, job_id, data.status, current_user.user_id, data.remarks)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return APIResponse(success=True, message=f"Job status changed to {data.status}")


@router.put("/{job_id}/assign", response_model=APIResponse)
async def assign_job(
    job_id: int,
    payload: dict | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.JOB_UPDATE)),
):
    _ = payload
    job = await job_service.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    current = job.status.value if hasattr(job.status, "value") else str(job.status)
    if current == "pending_approval":
        _, err = await job_service.change_job_status(db, job_id, "approved", current_user.user_id, "Auto-approved during assignment")
        if err:
            raise HTTPException(status_code=400, detail=err)

    job, err = await job_service.change_job_status(db, job_id, "in_progress", current_user.user_id, "Assigned for execution")
    if err:
        raise HTTPException(status_code=400, detail=err)

    return APIResponse(success=True, data={"id": job.id}, message="Job assigned")
