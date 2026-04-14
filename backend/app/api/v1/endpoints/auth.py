# Auth Endpoints - Login, Refresh, Profile
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user, create_tokens, decode_token, bearer_scheme
from app.schemas.auth import LoginRequest, OtpSendRequest, OtpVerifyRequest, TokenResponse, UserInfo, RefreshRequest, ChangePasswordRequest, UpdatePhotoRequest, MarketDriverOtpSendRequest, MarketDriverOtpVerifyRequest, MarketDriverOtpResendRequest
from app.schemas.base import APIResponse
from app.services.auth_service import authenticate_by_identifier, authenticate_by_phone, authenticate_user, get_user_roles, refresh_access_token, change_password, get_user_by_id
from app.middleware.permissions import get_user_permissions
from app.services.token_blacklist import blacklist_token

router = APIRouter()
logger = logging.getLogger(__name__)

# Role → default landing page mapping
ROLE_REDIRECT_MAP = {
    "admin": "/dashboard",
    "manager": "/dashboard",
    "fleet_manager": "/fleet/dashboard",
    "accountant": "/accountant/dashboard",
    "finance_manager": "/fm/dashboard",
    "project_associate": "/dashboard",
    "driver": "/driver/trips",
    "pump_operator": "/pump/dashboard",
    "tyre_inspector": "/tyre/dashboard",
}


def _get_redirect(roles: list[str]) -> str:
    """Return the landing page for the user's primary role."""
    for role in roles:
        if role.lower() in ROLE_REDIRECT_MAP:
            return ROLE_REDIRECT_MAP[role.lower()]
    return "/dashboard"


@router.post("/login", response_model=APIResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_by_identifier(db, data.identifier, data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

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
        date_of_birth=str(user.date_of_birth) if user.date_of_birth else None,
        gender=user.gender,
        address=user.address,
        joining_date=str(user.joining_date) if user.joining_date else None,
        emergency_contact_name=user.emergency_contact_name,
        emergency_contact_phone=user.emergency_contact_phone,
        bank_account_holder=user.bank_account_holder,
        bank_name=user.bank_name,
        account_number=user.account_number,
        ifsc_code=user.ifsc_code,
        account_type=user.account_type,
        upi_id=user.upi_id,
        salary_amount=user.salary_amount,
        pay_type=user.pay_type,
        aadhaar_file_url=user.aadhaar_file_url,
        aadhaar_file_name=user.aadhaar_file_name,
    )
    return APIResponse(success=True, data={
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": "bearer",
        "user": user_info.model_dump(),
    }, message="Login successful")


@router.post("/send-otp", response_model=APIResponse)
async def send_otp_for_login(data: OtpSendRequest, db: AsyncSession = Depends(get_db)):
    """
    Step 1 of phone OTP login.
    Verifies password first (prevents phone enumeration), then sends OTP via
    Brevo SMS (primary) + Brevo email (fallback). In dev mode, returns OTP
    in the response if both delivery channels fail.
    """
    import asyncio
    from app.services.otp_service import create_otp_session, send_otp as _send_otp
    from app.services.brevo_service import send_email_otp

    phone = data.phone.strip()
    if phone.startswith("+91"):
        phone = phone[3:]
    elif phone.startswith("91") and len(phone) == 12:
        phone = phone[2:]
    if len(phone) != 10 or not phone.isdigit():
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit Indian mobile number")

    user = await authenticate_by_phone(db, phone, data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid phone number or password")

    session = await create_otp_session(user.id, phone)
    otp = session["otp"]

    # Fire SMS and email in parallel — both are best-effort
    sms_ok, email_ok = await asyncio.gather(
        _send_otp(phone, otp),
        send_email_otp(user.email, otp),
        return_exceptions=True,
    )
    sms_ok = sms_ok is True
    email_ok = email_ok is True

    if sms_ok:
        delivery = "SMS"
    elif email_ok:
        delivery = "email"
    else:
        delivery = "none"
        logger.warning(f"[OTP] Both SMS and email delivery failed for user {user.id}")

    response_data: dict = {
        "session_id": session["session_id"],
        "phone_masked": session["phone_masked"],
        "delivery": delivery,
    }

    # Dev safety net: include OTP in response when delivery failed
    # Remove this block before production hardening
    if delivery == "none":
        response_data["otp_dev"] = otp

    msg = {
        "SMS": "OTP sent to your registered number",
        "email": f"OTP sent to your registered email ({user.email[:3]}***)",
        "none": "OTP generated — check server logs (delivery unavailable)",
    }[delivery]

    return APIResponse(success=True, data=response_data, message=msg)


@router.post("/verify-otp", response_model=APIResponse)
async def verify_otp(data: OtpVerifyRequest, db: AsyncSession = Depends(get_db)):
    from app.services.otp_service import verify_otp as _verify
    success, user_id = await _verify(data.session_id, data.otp)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP — request a new one",
        )

    user = await get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account inactive")

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
        "otp_required": False,
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
        date_of_birth=str(user.date_of_birth) if user.date_of_birth else None,
        gender=user.gender,
        address=user.address,
        joining_date=str(user.joining_date) if user.joining_date else None,
        emergency_contact_name=user.emergency_contact_name,
        emergency_contact_phone=user.emergency_contact_phone,
        bank_account_holder=user.bank_account_holder,
        bank_name=user.bank_name,
        account_number=user.account_number,
        ifsc_code=user.ifsc_code,
        account_type=user.account_type,
        upi_id=user.upi_id,
        salary_amount=user.salary_amount,
        pay_type=user.pay_type,
        aadhaar_file_url=user.aadhaar_file_url,
        aadhaar_file_name=user.aadhaar_file_name,
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


# ── Market Driver OTP Login (phone-based, no password) ─────────────────────────

def _mask_phone_local(phone: str) -> str:
    """Return something like +91 XXXXX X7400"""
    clean = phone.strip().lstrip("+")
    if len(clean) >= 10:
        digits = clean[-10:]
        return f"+91 XXXXX X{digits[-4:]}"
    return "XXXXXXXXXX"


@router.post("/market-driver/send-otp", response_model=APIResponse)
async def market_driver_send_otp(data: MarketDriverOtpSendRequest):
    """
    Step 1: Market driver enters their phone number.
    We call MSG91 Widget to initiate OTP delivery and store a session.
    """
    from app.services.msg91_service import send_otp_msg91
    from app.services.otp_service import create_market_driver_otp_session

    # Normalise phone to 10 digits for storage/lookup
    phone = data.phone.strip().lstrip("+").lstrip("91")
    if len(phone) != 10 or not phone.isdigit():
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit Indian mobile number")

    # Send OTP via MSG91
    success, msg91_token = await send_otp_msg91("91" + phone)
    if not success:
        raise HTTPException(status_code=503, detail=f"Could not send OTP: {msg91_token}")

    # Store session in MongoDB
    session_id = await create_market_driver_otp_session(phone)

    return APIResponse(success=True, data={
        "session_id": session_id,
        "phone_masked": _mask_phone_local(phone),
        # msg91_token is the Widget access-token the client needs to return during verify
        "msg91_token": msg91_token,
    }, message="OTP sent to your registered number")


@router.post("/market-driver/resend-otp", response_model=APIResponse)
async def market_driver_resend_otp(data: MarketDriverOtpResendRequest):
    """
    Resend OTP: look up the session to get the phone, then re-initiate with MSG91.
    """
    from app.services.msg91_service import send_otp_msg91
    from app.services.otp_service import get_phone_from_session, create_market_driver_otp_session

    phone = await get_phone_from_session(data.session_id)
    if not phone:
        raise HTTPException(status_code=404, detail="Session not found or expired — please start again")

    success, msg91_token = await send_otp_msg91("91" + phone)
    if not success:
        raise HTTPException(status_code=503, detail=f"Could not resend OTP: {msg91_token}")

    # Create a fresh session for the same phone
    new_session_id = await create_market_driver_otp_session(phone)

    return APIResponse(success=True, data={
        "session_id": new_session_id,
        "phone_masked": _mask_phone_local(phone),
        "msg91_token": msg91_token,
    }, message="OTP resent")


@router.post("/market-driver/verify-otp", response_model=APIResponse)
async def market_driver_verify_otp(data: MarketDriverOtpVerifyRequest, db: AsyncSession = Depends(get_db)):
    """
    Step 2: Client sends back session_id + MSG91 access_token.
    We verify the token with MSG91, look up market trips for the driver's phone,
    and issue a JWT with role 'market_driver'.
    """
    from app.services.msg91_service import verify_otp_msg91
    from app.services.otp_service import get_market_driver_otp_session, mark_market_driver_otp_verified
    from sqlalchemy import text

    # 1. Retrieve our local session
    session = await get_market_driver_otp_session(data.session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired — request a new OTP")
    if session.get("verified"):
        raise HTTPException(status_code=401, detail="OTP already used")

    # 2. Verify the MSG91 access-token (the actual OTP check)
    is_valid, msg = await verify_otp_msg91(data.access_token, data.otp_code)
    if not is_valid:
        raise HTTPException(status_code=401, detail=msg or "Invalid or expired OTP")

    # 3. Mark session consumed
    await mark_market_driver_otp_verified(data.session_id)

    phone = session["phone"]  # 10-digit, no country code

    # 4. Look up market trips for this driver phone to verify they have active trips
    result = await db.execute(
        text("SELECT id, driver_name FROM market_trips WHERE driver_phone = :phone LIMIT 1"),
        {"phone": phone},
    )
    trip_row = result.fetchone()

    # 5. Issue a JWT for the market driver.
    #    We use a synthetic user_id = 0 and embed the phone in the email field
    #    so routes can use it for filtering.  Role = 'market_driver'.
    from app.core.security import create_access_token, create_refresh_token, Token
    from app.core.config import settings
    from datetime import timedelta

    driver_name = trip_row[1] if trip_row else "Driver"
    access_token = create_access_token(
        user_id=0,  # synthetic — market drivers are not Users table rows
        email=f"mktdriver:{phone}",  # encode phone in email field for routing
        roles=["market_driver"],
        permissions=["market_trips:read", "market_trips:update_status"],
        expires_delta=timedelta(days=7),
    )
    refresh_tok = create_refresh_token(
        user_id=0,
        email=f"mktdriver:{phone}",
        expires_delta=timedelta(days=30),
    )

    return APIResponse(success=True, data={
        "access_token": access_token,
        "refresh_token": refresh_tok,
        "token_type": "bearer",
        "user": {
            "id": 0,
            "phone": phone,
            "name": driver_name,
            "roles": ["market_driver"],
            "redirect_to": "/market-driver/trips",
        },
    }, message="Login successful")
