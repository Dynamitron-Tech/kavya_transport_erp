# Auth Service - Login, Token Management
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.postgres.user import User, UserRole, Role, user_roles
from app.core.security import verify_password, get_password_hash, create_tokens, decode_token, create_access_token


async def authenticate_user(db: AsyncSession, email: str, password: str):
    """Authenticate user by email and password."""
    normalized_email = (email or "").strip().lower()
    normalized_password = (password or "").strip()
    result = await db.execute(
        select(User).where(func.lower(User.email) == normalized_email, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        return None
    if not verify_password(normalized_password, user.password_hash):
        return None
    return user


async def authenticate_by_identifier(db: AsyncSession, identifier: str, password: str):
    """
    Authenticate by either email address or employee_id (e.g. KTD01).
    Returns the User ORM object on success, None otherwise.
    """
    cleaned = (identifier or "").strip()
    normalized_password = (password or "").strip()

    # Determine lookup strategy: if it looks like an email, use email lookup first;
    # otherwise look up by employee_id.
    user = None
    if "@" in cleaned:
        result = await db.execute(
            select(User).where(func.lower(User.email) == cleaned.lower(), User.is_active == True)
        )
        user = result.scalar_one_or_none()
    else:
        result = await db.execute(
            select(User).where(
                func.upper(User.employee_id) == cleaned.upper(),
                User.is_active == True,
            )
        )
        user = result.scalar_one_or_none()
        # Fall back to email lookup if still not found (edge case)
        if not user:
            result = await db.execute(
                select(User).where(func.lower(User.email) == cleaned.lower(), User.is_active == True)
            )
            user = result.scalar_one_or_none()

    if not user:
        return None
    if not verify_password(normalized_password, user.password_hash):
        return None
    return user


async def get_user_roles(db: AsyncSession, user_id: int) -> list[str]:
    """Get role names for a user (via user_roles association table)."""
    result = await db.execute(
        select(Role.name)
        .join(user_roles, user_roles.c.role_id == Role.id)
        .where(user_roles.c.user_id == user_id)
    )
    return [row[0] for row in result.all()]


async def get_user_by_id(db: AsyncSession, user_id: int):
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str):
    result = await db.execute(
        select(User).where(User.email == email)
    )
    return result.scalar_one_or_none()


async def refresh_access_token(db: AsyncSession, refresh_token: str):
    """Refresh access token using refresh token."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        return None
    
    user_id = int(payload["sub"])
    user = await get_user_by_id(db, user_id)
    if not user or not user.is_active:
        return None
    
    roles = await get_user_roles(db, user_id)
    from app.middleware.permissions import get_user_permissions
    permissions = get_user_permissions(roles)
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        roles=roles,
        permissions=permissions,
        tenant_id=user.tenant_id,
        branch_id=user.branch_id,
    )
    return access_token


async def change_password(db: AsyncSession, user_id: int, current_password: str, new_password: str) -> bool:
    user = await get_user_by_id(db, user_id)
    if not user:
        return False
    if not verify_password(current_password, user.password_hash):
        return False
    user.password_hash = get_password_hash(new_password)
    await db.flush()
    return True
