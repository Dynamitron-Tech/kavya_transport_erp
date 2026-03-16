# Auth Endpoints - Login, Refresh, Profile
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user, create_tokens
from app.schemas.auth import LoginRequest, TokenResponse, UserInfo, RefreshRequest, ChangePasswordRequest
from app.schemas.base import APIResponse
from app.services.auth_service import authenticate_user, get_user_roles, refresh_access_token, change_password, get_user_by_id
from app.middleware.permissions import get_user_permissions

router = APIRouter()


@router.post("/login", response_model=APIResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    roles = await get_user_roles(db, user.id)
    tokens = create_tokens(
        user_id=user.id, email=user.email, roles=roles,
        tenant_id=user.tenant_id, branch_id=user.branch_id,
    )
    user.last_login = datetime.utcnow()

    all_perms = get_user_permissions(roles)

    user_info = UserInfo(
        id=user.id, email=user.email, first_name=user.first_name,
        last_name=user.last_name, roles=roles, permissions=all_perms,
        branch_id=user.branch_id, tenant_id=user.tenant_id,
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
        last_name=user.last_name, roles=roles, permissions=all_perms,
        branch_id=user.branch_id, tenant_id=user.tenant_id,
    ).model_dump())


@router.post("/change-password", response_model=APIResponse)
async def api_change_password(data: ChangePasswordRequest, current_user: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    success = await change_password(db, current_user.user_id, data.current_password, data.new_password)
    if not success:
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    return APIResponse(success=True, message="Password changed successfully")


@router.post("/logout", response_model=APIResponse)
async def logout(current_user: TokenData = Depends(get_current_user)):
    return APIResponse(success=True, message="Logged out successfully")
