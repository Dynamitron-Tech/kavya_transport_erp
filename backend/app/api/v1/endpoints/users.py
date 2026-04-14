# User Management Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from typing import Optional

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.middleware.permissions import require_permission, Permissions
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.user import UserCreate, UserUpdate
from app.services import user_service
from app.models.postgres.user import User

router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_users(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=500),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.USER_READ)),
):
    users, total = await user_service.list_users(db, page, limit, search)
    pages = (total + limit - 1) // limit
    items = []
    for u in users:
        roles = await user_service.get_user_roles(db, u.id)
        items.append({
            "id": u.id, "email": u.email, "first_name": u.first_name,
            "last_name": u.last_name, "phone": u.phone, "avatar_url": u.avatar_url, "roles": roles,
            "is_active": u.is_active,
            "last_login": str(u.last_login) if u.last_login else None,
            "created_at": str(u.created_at) if u.created_at else None,
            "date_of_birth": str(u.date_of_birth) if u.date_of_birth else None,
            "gender": u.gender,
            "address": u.address,
            "joining_date": str(u.joining_date) if u.joining_date else None,
            "emergency_contact_name": u.emergency_contact_name,
            "emergency_contact_phone": u.emergency_contact_phone,
            "bank_account_holder": u.bank_account_holder,
            "bank_name": u.bank_name,
            "account_number": u.account_number,
            "ifsc_code": u.ifsc_code,
            "account_type": u.account_type,
            "upi_id": u.upi_id,
            "salary_amount": u.salary_amount,
            "pay_type": u.pay_type,
            "aadhaar_file_url": u.aadhaar_file_url,
            "aadhaar_file_name": u.aadhaar_file_name,
            "pan_file_url": u.pan_file_url,
            "pan_file_name": u.pan_file_name,
            "passbook_file_url": u.passbook_file_url,
            "passbook_file_name": u.passbook_file_name,
            "dl_file_url": u.dl_file_url,
            "dl_file_name": u.dl_file_name,
            "dl_number": u.dl_number,
            "dl_issue_date": str(u.dl_issue_date) if u.dl_issue_date else None,
            "dl_expiry_date": str(u.dl_expiry_date) if u.dl_expiry_date else None,
        })
    return APIResponse(success=True, data=items, pagination=PaginationMeta(page=page, limit=limit, total=total, pages=pages))


@router.get("/{user_id}", response_model=APIResponse)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db), current_user: TokenData = Depends(get_current_user)):
    user = await user_service.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    roles = await user_service.get_user_roles(db, user.id)
    return APIResponse(success=True, data={
        "id": user.id, "email": user.email, "first_name": user.first_name,
        "last_name": user.last_name, "phone": user.phone, "avatar_url": user.avatar_url, "roles": roles,
        "is_active": user.is_active, "created_at": str(user.created_at) if user.created_at else None,
        "date_of_birth": str(user.date_of_birth) if user.date_of_birth else None,
        "gender": user.gender,
        "address": user.address,
        "joining_date": str(user.joining_date) if user.joining_date else None,
        "emergency_contact_name": user.emergency_contact_name,
        "emergency_contact_phone": user.emergency_contact_phone,
        "bank_account_holder": user.bank_account_holder,
        "bank_name": user.bank_name,
        "account_number": user.account_number,
        "ifsc_code": user.ifsc_code,
        "account_type": user.account_type,
        "upi_id": user.upi_id,
        "salary_amount": user.salary_amount,
        "pay_type": user.pay_type,
        "aadhaar_file_url": user.aadhaar_file_url,
        "aadhaar_file_name": user.aadhaar_file_name,
        "pan_file_url": user.pan_file_url,
        "pan_file_name": user.pan_file_name,
        "passbook_file_url": user.passbook_file_url,
        "passbook_file_name": user.passbook_file_name,
        "dl_file_url": user.dl_file_url,
        "dl_file_name": user.dl_file_name,
        "dl_number": user.dl_number,
        "dl_issue_date": str(user.dl_issue_date) if user.dl_issue_date else None,
        "dl_expiry_date": str(user.dl_expiry_date) if user.dl_expiry_date else None,
    })


@router.post("", response_model=APIResponse, status_code=201)
async def create_user(
    data: UserCreate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.USER_CREATE)),
):
    from app.services.auth_service import get_user_by_email
    from app.services.employee_id_service import ROLE_PREFIX, generate_employee_id
    import secrets, string

    existing = await get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    normalized_phone = (data.phone or "").strip() or None
    if normalized_phone:
        existing_phone = await db.execute(select(User.id).where(User.phone == normalized_phone))
        if existing_phone.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Phone number already registered")

    payload = data.model_dump()

    # Determine if this is an admin user
    role_names = payload.get("role_names", [])
    is_admin_user = any(r.lower() == "admin" for r in role_names)

    # Auto-generate password if not provided
    plain_password = payload.get("password")
    if not plain_password:
        alphabet = string.ascii_letters + string.digits + "!@#$"
        plain_password = "".join(secrets.choice(alphabet) for _ in range(12))
    payload["password"] = plain_password

    # Auto-generate employee_id for non-admin roles
    employee_id = None
    if not is_admin_user:
        # Find the first non-admin role we know about
        non_admin_roles = [r for r in role_names if r.upper() in ROLE_PREFIX]
        if non_admin_roles:
            employee_id = await generate_employee_id(db, non_admin_roles[0])

    try:
        user = await user_service.create_user(db, payload)
    except IntegrityError as exc:
        msg = str(exc).lower()
        if "ix_users_phone" in msg or "users_phone_key" in msg:
            raise HTTPException(status_code=400, detail="Phone number already registered")
        raise HTTPException(status_code=400, detail="Unable to create user due to conflicting data")

    if employee_id:
        user.employee_id = employee_id
        await db.flush()

    return APIResponse(success=True, data={
        "id": user.id,
        "email": user.email,
        "employee_id": user.employee_id,
        "plain_password": plain_password,
    }, message="User created")


@router.put("/{user_id}", response_model=APIResponse)
async def update_user(
    user_id: int, data: UserUpdate, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.USER_UPDATE)),
):
    payload = data.model_dump(exclude_unset=True)
    if "password" in payload and payload["password"]:
        if not any((role or "").lower() == "admin" for role in current_user.roles):
            raise HTTPException(status_code=403, detail="Only admin can update employee password")
    normalized_phone = None
    if "phone" in payload:
        normalized_phone = (payload.get("phone") or "").strip() or None
        if normalized_phone:
            existing_phone = await db.execute(select(User.id).where(User.phone == normalized_phone, User.id != user_id))
            if existing_phone.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Phone number already registered")

    try:
        user = await user_service.update_user(db, user_id, payload)
    except IntegrityError as exc:
        msg = str(exc).lower()
        if "ix_users_phone" in msg or "users_phone_key" in msg:
            raise HTTPException(status_code=400, detail="Phone number already registered")
        raise HTTPException(status_code=400, detail="Unable to update user due to conflicting data")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return APIResponse(success=True, message="User updated")


@router.delete("/{user_id}", response_model=APIResponse)
async def delete_user(
    user_id: int, db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    _perm=Depends(require_permission(Permissions.USER_DELETE)),
):
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    success = await user_service.delete_user(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return APIResponse(success=True, message="User deactivated")


class FCMTokenRequest(BaseModel):
    fcm_token: str


@router.patch("/me/fcm-token", response_model=APIResponse)
async def update_fcm_token(
    payload: FCMTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Save or update the FCM device token for push notifications."""
    user = await db.get(User, current_user.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.fcm_token = payload.fcm_token
    await db.commit()
    return APIResponse(success=True, message="FCM token saved")


class ResetPasswordRequest(BaseModel):
    new_password: str


@router.post("/{user_id}/reset-password", response_model=APIResponse)
async def reset_user_password(
    user_id: int,
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Admin-only: reset a user's password."""
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Admin only")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    from app.core.security import get_password_hash
    user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()
    return APIResponse(success=True, message="Password reset successfully")
