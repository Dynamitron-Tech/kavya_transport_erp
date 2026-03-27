# Driver Service - CRUD + Attendance
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.models.postgres.driver import Driver, DriverLicense, DriverDocument, DriverAttendance, DriverStatus
from app.models.postgres.user import User, Role, UserRole
from app.core.security import get_password_hash


def _coerce_driver_status(raw_value):
    """Safely convert a status string to DriverStatus enum member."""
    if raw_value is None:
        return None
    if isinstance(raw_value, DriverStatus):
        return raw_value
    text = str(raw_value).strip()
    if not text:
        return None
    for member in DriverStatus:
        if text.lower() == str(member.value).lower() or text.upper() == member.name.upper():
            return member
    return None  # Unknown status, skip filter


async def list_drivers(db: AsyncSession, page: int = 1, limit: int = 20, search: str = None, status: str = None):
    query = select(Driver).where(Driver.is_deleted == False)
    count_query = select(func.count(Driver.id)).where(Driver.is_deleted == False)

    if search:
        sf = or_(
            Driver.first_name.ilike(f"%{search}%"),
            Driver.last_name.ilike(f"%{search}%"),
            Driver.employee_code.ilike(f"%{search}%"),
            Driver.phone.ilike(f"%{search}%"),
        )
        query = query.where(sf)
        count_query = count_query.where(sf)

    if status:
        coerced = _coerce_driver_status(status)
        if coerced is not None:
            query = query.where(Driver.status == coerced)
            count_query = count_query.where(Driver.status == coerced)
        else:
            # Unknown status value – return empty result
            query = query.where(False)
            count_query = count_query.where(False)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(Driver.id.desc()))
    return result.scalars().all(), total


async def get_driver(db: AsyncSession, driver_id: int):
    result = await db.execute(
        select(Driver).where(Driver.id == driver_id, Driver.is_deleted == False)
    )
    return result.scalar_one_or_none()


async def create_driver(db: AsyncSession, data: dict) -> dict:
    data = dict(data)
    license_data = data.pop("license", None)
    licenses_data = data.pop("licenses", None) or []

    # Pop fields that don't belong on the Driver model
    data.pop("employee_id", None)
    data.pop("full_name", None)
    data.pop("joining_date", None)
    data.pop("license_number", None)
    data.pop("license_type", None)
    data.pop("license_expiry", None)
    data.pop("status_label", None)
    data.pop("salary_base", None)
    data.pop("total_trips", None)
    data.pop("total_km", None)
    data.pop("rating", None)
    data.pop("is_active", None)
    data.pop("status", None)

    # Hash security PIN if provided
    raw_pin = data.pop("security_pin", None)

    if not data.get("employee_code"):
        next_id = (await db.execute(select(func.coalesce(func.max(Driver.id), 0) + 1))).scalar() or 1
        data["employee_code"] = f"DRV{int(next_id):05d}"

    driver = Driver(**data)
    if raw_pin:
        driver.security_pin_hash = get_password_hash(raw_pin)
    db.add(driver)
    await db.flush()

    if license_data:
        lic = DriverLicense(driver_id=driver.id, **license_data)
        db.add(lic)
        await db.flush()

    for item in licenses_data:
        if not isinstance(item, dict):
            continue
        payload = dict(item)
        if payload.get("license_type"):
            payload["license_type"] = str(payload["license_type"]).upper()
        lic = DriverLicense(driver_id=driver.id, **payload)
        db.add(lic)
    if licenses_data:
        await db.flush()

    # Auto-create user account for the driver
    first = driver.first_name or ""
    last = driver.last_name or ""
    phone = driver.phone or ""
    email_base = f"{first.lower()}.{last.lower()}".strip(".") if last else first.lower()
    email_base = email_base.replace(" ", "")
    auto_email = f"{email_base}@kavyatransports.com" if email_base else f"driver{driver.id}@kavyatransports.com"

    # Check if email already taken, append driver id if so
    existing = (await db.execute(select(User).where(User.email == auto_email))).scalar_one_or_none()
    if existing:
        auto_email = f"{email_base}{driver.id}@kavyatransports.com"

    auto_password = phone[-6:] if len(phone) >= 6 else f"driver{driver.id:04d}"

    user = User(
        email=auto_email,
        password_hash=get_password_hash(auto_password),
        first_name=first,
        last_name=last,
        phone=phone,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    # Assign driver role
    role_result = await db.execute(select(Role).where(Role.name == "driver"))
    role = role_result.scalar_one_or_none()
    if role:
        db.add(UserRole(user_id=user.id, role_id=role.id))
        await db.flush()

    # Link driver to user
    driver.user_id = user.id
    await db.flush()

    return {
        "driver": driver,
        "credentials": {
            "email": auto_email,
            "password": auto_password,
        },
    }


async def update_driver(db: AsyncSession, driver_id: int, data: dict):
    driver = await get_driver(db, driver_id)
    if not driver:
        return None
    # Hash security PIN if provided
    raw_pin = data.pop("security_pin", None)
    if raw_pin:
        driver.security_pin_hash = get_password_hash(raw_pin)
    for k, v in data.items():
        if v is not None:
            setattr(driver, k, v)
    return driver


async def delete_driver(db: AsyncSession, driver_id: int) -> bool:
    driver = await get_driver(db, driver_id)
    if not driver:
        return False
    driver.is_deleted = True
    return True


# --- License ---
async def get_driver_license(db: AsyncSession, driver_id: int):
    result = await db.execute(
        select(DriverLicense).where(DriverLicense.driver_id == driver_id)
    )
    return result.scalars().all()


async def add_driver_license(db: AsyncSession, driver_id: int, data: dict):
    lic = DriverLicense(driver_id=driver_id, **data)
    db.add(lic)
    await db.flush()
    return lic


# --- Attendance ---
async def list_attendance(db: AsyncSession, driver_id: int = None, date_from=None, date_to=None, page: int = 1, limit: int = 20):
    query = select(DriverAttendance)
    count_query = select(func.count(DriverAttendance.id))

    if driver_id:
        query = query.where(DriverAttendance.driver_id == driver_id)
        count_query = count_query.where(DriverAttendance.driver_id == driver_id)
    if date_from:
        query = query.where(DriverAttendance.date >= date_from)
        count_query = count_query.where(DriverAttendance.date >= date_from)
    if date_to:
        query = query.where(DriverAttendance.date <= date_to)
        count_query = count_query.where(DriverAttendance.date <= date_to)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(DriverAttendance.date.desc()))
    return result.scalars().all(), total


async def mark_attendance(db: AsyncSession, data: dict):
    att = DriverAttendance(**data)
    db.add(att)
    await db.flush()
    return att


async def get_driver_stats(db: AsyncSession) -> dict:
    """Get driver dashboard statistics."""
    total = (await db.execute(select(func.count(Driver.id)).where(Driver.is_deleted == False))).scalar() or 0
    available = (await db.execute(select(func.count(Driver.id)).where(Driver.is_deleted == False, Driver.status == DriverStatus.AVAILABLE))).scalar() or 0
    on_trip = (await db.execute(select(func.count(Driver.id)).where(Driver.is_deleted == False, Driver.status == DriverStatus.ON_TRIP))).scalar() or 0
    on_leave = (await db.execute(select(func.count(Driver.id)).where(Driver.is_deleted == False, Driver.status == DriverStatus.ON_LEAVE))).scalar() or 0
    
    return {
        "kpis": {
            "total_drivers": total,
            "active_drivers": available + on_trip,
            "on_trip": on_trip,
            "available": available,
            "on_leave": on_leave,
            "resting": 0,
            "license_expiring_soon": 0,
            "license_expired": 0,
            "avg_rating": 4.5,
            "avg_safety_score": 92,
            "total_alerts": 0,
        },
        "charts": {
            "utilization": [],
            "trips_per_driver": [],
            "performance_trends": [],
            "status_distribution": [
                {"label": "Available", "value": available, "color": "#10b981"},
                {"label": "On Trip", "value": on_trip, "color": "#8b5cf6"},
                {"label": "On Leave", "value": on_leave, "color": "#ef4444"},
                {"label": "Resting", "value": 0, "color": "#6b7280"},
            ],
        },
        "alerts": [],
    }
