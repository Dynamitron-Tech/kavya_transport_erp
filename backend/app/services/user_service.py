# User Service - CRUD operations
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.models.postgres.user import User, Role, UserRole
from app.core.security import get_password_hash


async def list_users(db: AsyncSession, page: int = 1, limit: int = 20, search: str = None):
    query = select(User).where(User.is_active == True)
    count_query = select(func.count(User.id)).where(User.is_active == True)

    if search:
        search_filter = or_(
            User.first_name.ilike(f"%{search}%"),
            User.last_name.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(User.id.desc()))
    users = result.scalars().all()
    return users, total


async def get_user(db: AsyncSession, user_id: int):
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, data: dict) -> User:
    role_names = data.pop("role_names", [])
    password = data.pop("password")
    user = User(**data, password_hash=get_password_hash(password))
    db.add(user)
    await db.flush()

    if role_names:
        for rn in role_names:
            role_result = await db.execute(select(Role).where(Role.name == rn))
            role = role_result.scalar_one_or_none()
            if role:
                db.add(UserRole(user_id=user.id, role_id=role.id))
        await db.flush()

    return user


async def update_user(db: AsyncSession, user_id: int, data: dict):
    user = await get_user(db, user_id)
    if not user:
        return None
    role_names = data.pop("role_names", None)
    for k, v in data.items():
        if v is not None:
            setattr(user, k, v)

    if role_names is not None:
        # Remove existing roles
        existing = await db.execute(select(UserRole).where(UserRole.user_id == user_id))
        for ur in existing.scalars().all():
            await db.delete(ur)
        await db.flush()
        for rn in role_names:
            role_result = await db.execute(select(Role).where(Role.name == rn))
            role = role_result.scalar_one_or_none()
            if role:
                db.add(UserRole(user_id=user.id, role_id=role.id))
        await db.flush()

    return user


async def delete_user(db: AsyncSession, user_id: int) -> bool:
    user = await get_user(db, user_id)
    if not user:
        return False
    user.is_active = False
    return True


async def get_user_roles(db: AsyncSession, user_id: int) -> list[str]:
    result = await db.execute(
        select(Role.name).join(UserRole, UserRole.role_id == Role.id).where(UserRole.user_id == user_id)
    )
    return [row[0] for row in result.all()]
