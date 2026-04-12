# MSG91 Widget OTP Service
# Sends and verifies OTPs using MSG91's Widget API.
# All API calls are server-side only — credentials never reach the client.

import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

MSG91_INITIATE_URL = "https://control.msg91.com/api/v5/widget/initiate"
MSG91_VERIFY_URL   = "https://control.msg91.com/api/v5/widget/verifyAccessToken"


async def send_otp_msg91(phone: str) -> tuple[bool, str]:
    """
    Initiate an OTP for the given mobile number via MSG91 Widget API.
    Phone must include country code prefix, e.g. '919876543210'.
    Returns (success: bool, access_token_or_error: str).
    The 'access_token' returned by MSG91 must be passed back from the client
    during verification — MSG91 Widget handles OTP delivery internally.
    """
    # Normalise to E.164 without '+'
    normalised = phone.lstrip("+").replace(" ", "")
    if not normalised.startswith("91") and len(normalised) == 10:
        normalised = "91" + normalised

    payload = {
        "authkey": settings.MSG91_AUTH_KEY,
        "mobile": normalised,
        "widget_id": settings.MSG91_WIDGET_ID,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                MSG91_INITIATE_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
        data = resp.json()
        logger.debug(f"[MSG91] initiate response: {data}")

        if data.get("type") == "success":
            # MSG91 returns a request_id / access-token in 'message' field
            token = data.get("message", "")
            return True, token
        else:
            error = data.get("message", "MSG91 OTP initiation failed")
            logger.warning(f"[MSG91] initiate error: {error}")
            return False, error
    except Exception as exc:
        logger.error(f"[MSG91] send_otp exception: {exc}")
        return False, str(exc)


async def verify_otp_msg91(access_token: str, otp_code: str) -> tuple[bool, str]:
    """
    Verify an OTP.  For mobile apps, the 6-digit OTP code entered by the user
    is submitted together with the access-token returned at initiation.
    MSG91 Widget's verifyAccessToken API accepts {access-token, otp} for mobile.
    Returns (is_valid: bool, message: str).
    """
    payload = {
        "authkey": settings.MSG91_AUTH_KEY,
        "access-token": access_token,
        "otp": otp_code,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                MSG91_VERIFY_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
        data = resp.json()
        logger.debug(f"[MSG91] verify response: {data}")

        if data.get("type") == "success":
            return True, "OTP verified"
        else:
            error = data.get("message", "Invalid or expired OTP")
            return False, error
    except Exception as exc:
        logger.error(f"[MSG91] verify_otp exception: {exc}")
        return False, str(exc)
