# Vahan API Endpoints — Vehicle RC / Insurance / Fitness / Permit / PUC checks
from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse
from app.middleware.permissions import require_permission, Permissions
from app.services import vahan_service

router = APIRouter()


@router.get("/rc/{reg_number}", response_model=APIResponse)
async def lookup_rc(
    reg_number: str,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Look up vehicle RC details from VAHAN."""
    result = await vahan_service.lookup_vehicle_by_rc(reg_number)
    return APIResponse(success=True, data=result, message="Vehicle RC details fetched")


@router.get("/insurance/{reg_number}", response_model=APIResponse)
async def check_insurance(
    reg_number: str,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_READ)),
):
    result = await vahan_service.check_insurance(reg_number)
    return APIResponse(success=True, data=result, message="Insurance status fetched")


@router.get("/fitness/{reg_number}", response_model=APIResponse)
async def check_fitness(
    reg_number: str,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_READ)),
):
    result = await vahan_service.check_fitness(reg_number)
    return APIResponse(success=True, data=result, message="Fitness certificate status fetched")


@router.get("/permit/{reg_number}", response_model=APIResponse)
async def check_permit(
    reg_number: str,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_READ)),
):
    result = await vahan_service.check_permit(reg_number)
    return APIResponse(success=True, data=result, message="Permit status fetched")


@router.get("/puc/{reg_number}", response_model=APIResponse)
async def check_puc(
    reg_number: str,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_READ)),
):
    result = await vahan_service.check_puc(reg_number)
    return APIResponse(success=True, data=result, message="PUC status fetched")


@router.get("/full-check/{reg_number}", response_model=APIResponse)
async def full_vehicle_check(
    reg_number: str,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Full compliance check: RC + Insurance + Fitness + Permit + PUC + Blacklist."""
    result = await vahan_service.full_vehicle_check(reg_number)
    return APIResponse(success=True, data=result, message="Full vehicle compliance check completed")
