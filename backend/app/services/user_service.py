# User Service - CRUD operations
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.models.postgres.user import User, Role, UserRole
from app.models.postgres.driver import Driver, DriverStatus
from app.core.security import get_password_hash


def _normalize_optional_phone(value):
    """Convert blank phone values to None so unique index does not collide on ''."""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


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


async def _ensure_driver_profile_for_user(db: AsyncSession, user: User) -> None:
    """Create or sync a Driver profile for a user that has driver role."""
    existing_result = await db.execute(
        select(Driver).where(Driver.user_id == user.id, Driver.is_deleted == False)
    )
    existing_driver = existing_result.scalar_one_or_none()

    # Keep existing linked driver details in sync with user profile updates.
    if existing_driver:
        existing_driver.first_name = user.first_name or existing_driver.first_name
        existing_driver.last_name = user.last_name
        existing_driver.email = user.email
        if user.phone:
            existing_driver.phone = user.phone
        if user.branch_id is not None:
            existing_driver.branch_id = user.branch_id
        if user.tenant_id is not None:
            existing_driver.tenant_id = user.tenant_id
        if user.salary_amount:
            try:
                from decimal import Decimal
                existing_driver.base_salary = Decimal(str(user.salary_amount))
            except Exception:
                pass
        return

    next_id = (await db.execute(select(func.coalesce(func.max(Driver.id), 0) + 1))).scalar() or 1
    employee_code = f"DRV{int(next_id):05d}"

    # Driver.phone is required; use a deterministic fallback if user phone is missing.
    phone_value = user.phone or f"driver-{user.id}"

    base_salary_val = None
    if user.salary_amount:
        try:
            from decimal import Decimal
            base_salary_val = Decimal(str(user.salary_amount))
        except Exception:
            pass

    driver = Driver(
        user_id=user.id,
        employee_code=employee_code,
        first_name=user.first_name or "Driver",
        last_name=user.last_name,
        phone=phone_value,
        email=user.email,
        status=DriverStatus.AVAILABLE,
        branch_id=user.branch_id,
        tenant_id=user.tenant_id,
        base_salary=base_salary_val,
    )
    db.add(driver)
    await db.flush()


async def create_user(db: AsyncSession, data: dict) -> User:
    role_names = data.pop("role_names", [])
    password = data.pop("password", None)
    if not password:
        import secrets, string
        alphabet = string.ascii_letters + string.digits + "!@#$"
        password = "".join(secrets.choice(alphabet) for _ in range(12))
    data["phone"] = _normalize_optional_phone(data.get("phone"))
    # Convert date string fields to date objects
    from datetime import date as _date
    for date_field in ("date_of_birth", "joining_date", "dl_issue_date", "dl_expiry_date"):
        val = data.get(date_field)
        if val and isinstance(val, str):
            try:
                data[date_field] = _date.fromisoformat(val)
            except ValueError:
                data[date_field] = None
    # Strip empty strings for optional fields
    for field in ("gender", "address", "emergency_contact_name", "emergency_contact_phone",
                  "bank_account_holder", "bank_name", "account_number", "ifsc_code",
                  "account_type", "upi_id", "salary_amount", "pay_type",
                  "aadhaar_file_url", "aadhaar_file_name",
                  "pan_file_url", "pan_file_name",
                  "passbook_file_url", "passbook_file_name",
                  "dl_file_url", "dl_file_name", "dl_number",
                  "avatar_url"):
        if not data.get(field):
            data.pop(field, None)
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

    if any((rn or "").lower() == "driver" for rn in role_names):
        await _ensure_driver_profile_for_user(db, user)

    return user


async def update_user(db: AsyncSession, user_id: int, data: dict):
    user = await get_user(db, user_id)
    if not user:
        return None
    role_names = data.pop("role_names", None)
    raw_password = data.pop("password", None)
    if raw_password:
        user.password_hash = get_password_hash(raw_password)
    # Convert date string fields to date objects
    from datetime import date as _date
    for date_field in ("date_of_birth", "joining_date", "dl_issue_date", "dl_expiry_date"):
        if date_field in data:
            val = data[date_field]
            if val and isinstance(val, str):
                try:
                    data[date_field] = _date.fromisoformat(val)
                except ValueError:
                    data[date_field] = None
    for k, v in data.items():
        if k == "phone":
            v = _normalize_optional_phone(v)
            setattr(user, k, v)
            continue
        if v is not None:
            setattr(user, k, v)
        elif k in ("gender", "address", "emergency_contact_name", "emergency_contact_phone",
                   "date_of_birth", "joining_date",
                   "bank_account_holder", "bank_name", "account_number", "ifsc_code",
                 "account_type", "upi_id", "salary_amount", "pay_type",
                 "aadhaar_file_url", "aadhaar_file_name",
                 "pan_file_url", "pan_file_name",
                 "passbook_file_url", "passbook_file_name",
                 "dl_file_url", "dl_file_name", "dl_number", "dl_issue_date", "dl_expiry_date"):
            # Allow clearing these fields by passing empty string
            setattr(user, k, None)

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

    # Ensure driver profile exists (or is synced) whenever user has driver role.
    current_roles = await get_user_roles(db, user_id)
    if any((role or "").lower() == "driver" for role in current_roles):
        await _ensure_driver_profile_for_user(db, user)

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
