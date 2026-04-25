# Sarathi API Endpoints — DL verification
from fastapi import APIRouter, Depends, Query

from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse
from app.middleware.permissions import require_permission, Permissions
from app.services import sarathi_service

router = APIRouter()


@router.get("/verify/{dl_number}", response_model=APIResponse)
async def verify_dl(
    dl_number: str,
    dob: str = Query(..., description="Date of birth YYYY-MM-DD"),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.DRIVER_READ)),
):
    """Verify driving licence against Sarathi database."""
    result = await sarathi_service.verify_driving_licence(dl_number, dob)
    return APIResponse(success=True, data=result, message="DL verification completed")


@router.get("/details/{dl_number}", response_model=APIResponse)
async def get_dl_details(
    dl_number: str,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.DRIVER_READ)),
):
    """Get full DL details from Sarathi."""
    result = await sarathi_service.get_dl_details(dl_number)
    return APIResponse(success=True, data=result, message="DL details fetched")
