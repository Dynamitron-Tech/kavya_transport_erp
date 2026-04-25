# eChallan API Endpoints — traffic challan lookup
from fastapi import APIRouter, Depends

from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse
from app.middleware.permissions import require_permission, Permissions
from app.services import echallan_service

router = APIRouter()


@router.get("/vehicle/{reg_number}", response_model=APIResponse)
async def get_challans_by_vehicle(
    reg_number: str,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Get all challans for a vehicle registration number."""
    result = await echallan_service.get_challans_by_vehicle(reg_number)
    return APIResponse(success=True, data=result, message="Vehicle challans fetched")


@router.get("/driver/{dl_number}", response_model=APIResponse)
async def get_challans_by_driver(
    dl_number: str,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.DRIVER_READ)),
):
    """Get all challans for a driving licence number."""
    result = await echallan_service.get_challans_by_dl(dl_number)
    return APIResponse(success=True, data=result, message="Driver challans fetched")


@router.get("/status/{challan_number}", response_model=APIResponse)
async def get_challan_status(
    challan_number: str,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.VEHICLE_READ)),
):
    """Check payment status of a specific challan."""
    result = await echallan_service.get_challan_payment_status(challan_number)
    return APIResponse(success=True, data=result, message="Challan status fetched")
