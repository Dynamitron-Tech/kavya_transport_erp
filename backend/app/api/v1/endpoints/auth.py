# Auth Endpoints - Login, Refresh, Profile
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user, create_tokens, decode_token, bearer_scheme
from app.schemas.auth import LoginRequest, TokenResponse, UserInfo, RefreshRequest, ChangePasswordRequest, UpdatePhotoRequest
from app.schemas.base import APIResponse
from app.services.auth_service import authenticate_user, get_user_roles, refresh_access_token, change_password, get_user_by_id
from app.middleware.permissions import get_user_permissions
from app.services.token_blacklist import blacklist_token

router = APIRouter()

# Role → default landing page mapping
ROLE_REDIRECT_MAP = {
    "admin": "/dashboard",
    "manager": "/dashboard",
    "fleet_manager": "/fleet/dashboard",
    "accountant": "/accountant/dashboard",
    "project_associate": "/dashboard",
    "driver": "/driver/trips",
    "pump_operator": "/pump/dashboard",
}


def _get_redirect(roles: list[str]) -> str:
    """Return the landing page for the user's primary role."""
    for role in roles:
        if role.lower() in ROLE_REDIRECT_MAP:
            return ROLE_REDIRECT_MAP[role.lower()]
    return "/dashboard"


@router.post("/login", response_model=APIResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid E-mail or Password")

    roles = await get_user_roles(db, user.id)
    tokens = create_tokens(
        user_id=user.id, email=user.email, roles=roles,
        tenant_id=user.tenant_id, branch_id=user.branch_id,
    )
    user.last_login = datetime.utcnow()

    all_perms = get_user_permissions(roles)

    user_info = UserInfo(
        id=user.id, email=user.email, first_name=user.first_name,
        last_name=user.last_name, phone=user.phone, roles=roles, permissions=all_perms,
        avatar_url=user.avatar_url, is_active=user.is_active, created_at=user.created_at,
        branch_id=user.branch_id, tenant_id=user.tenant_id,
        redirect_to=_get_redirect(roles),
    )
    return APIResponse(success=True, data={
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": "bearer",
        "user": user_info.model_dump(),
    }, message="Login successful")


@router.post("/refresh", response_model=APIResponse)
async def refresh_token(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    new_token = await refresh_access_token(db, data.refresh_token)
    if not new_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    return APIResponse(success=True, data={"access_token": new_token, "token_type": "bearer"})


@router.get("/me", response_model=APIResponse)
async def get_profile(current_user: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user = await get_user_by_id(db, current_user.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    roles = await get_user_roles(db, user.id)
    all_perms = get_user_permissions(roles)
    return APIResponse(success=True, data=UserInfo(
        id=user.id, email=user.email, first_name=user.first_name,
        last_name=user.last_name, phone=user.phone, roles=roles, permissions=all_perms,
        avatar_url=user.avatar_url, is_active=user.is_active, created_at=user.created_at,
        branch_id=user.branch_id, tenant_id=user.tenant_id,
        redirect_to=_get_redirect(roles),
    ).model_dump())


@router.put("/me/photo", response_model=APIResponse)
async def update_my_photo(
    payload: UpdatePhotoRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await get_user_by_id(db, current_user.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    avatar_url = (payload.avatar_url or "").strip()
    if not avatar_url:
        raise HTTPException(status_code=400, detail="Photo is required")

    user.avatar_url = avatar_url
    return APIResponse(success=True, message="Profile photo updated successfully")


@router.post("/change-password", response_model=APIResponse)
async def api_change_password(data: ChangePasswordRequest, current_user: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    success = await change_password(db, current_user.user_id, data.current_password, data.new_password)
    if not success:
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    return APIResponse(success=True, message="Password changed successfully")


@router.post("/logout", response_model=APIResponse)
async def logout(
    current_user: TokenData = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    if credentials:
        token = credentials.credentials
        payload = decode_token(token)
    else:
        payload = None
    if payload:
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti and exp:
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
            blacklist_token(jti, expires_at)
    # Audit log
    from app.services.audit_logger import log_audit
    await log_audit(
        db, actor_id=current_user.user_id, actor_role=",".join(current_user.roles),
        action="auth.logout", entity_type="user", entity_id=str(current_user.user_id),
    )
    await db.commit()
    return APIResponse(success=True, message="Logged out successfully")
