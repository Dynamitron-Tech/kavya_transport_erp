# GST Verification Endpoint
from fastapi import APIRouter, Depends

from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse
from app.middleware.permissions import require_permission, Permissions
from app.services import gst_verify_service

router = APIRouter()


@router.get("/verify/{gstin}", response_model=APIResponse)
async def verify_gstin(
    gstin: str,
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.CLIENT_READ)),
):
    """Verify a GSTIN and fetch business details."""
    result = await gst_verify_service.verify_gstin(gstin)
    return APIResponse(success=True, data=result, message="GSTIN verification completed")
