# SMS Service — via MSG91
import logging
from app.core.config import settings
from app.services.cache_service import is_placeholder

logger = logging.getLogger(__name__)


async def send_sms(phone: str, message: str) -> dict:
    phone = phone.strip().lstrip("+")
    if not phone.startswith("91"):
        phone = f"91{phone}"

    if is_placeholder(settings.MSG91_API_KEY):
        logger.info(f"[MOCK SMS] → +{phone}: {message[:80]}...")
        return {
            "success": True,
            "request_id": f"mock_sms_{id(message)}",
            "phone": phone,
            "source": "MOCK_DATA",
        }

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://control.msg91.com/api/v5/flow/",
            headers={
                "authkey": settings.MSG91_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "sender": settings.MSG91_SENDER_ID,
                "route": "4",
                "country": "91",
                "sms": [{"message": message, "to": [phone]}],
            },
        )
        data = resp.json()
        return {
            "success": data.get("type") == "success",
            "request_id": data.get("request_id"),
            "phone": phone,
            "source": "LIVE",
        }


async def send_otp(phone: str, otp: str) -> dict:
    message = f"Your OTP for {settings.APP_NAME} is {otp}. Valid for 10 minutes."
    return await send_sms(phone, message)


async def send_trip_update_sms(phone: str, trip_id: str, status: str, location: str | None = None) -> dict:
    message = f"{settings.APP_NAME}: Trip {trip_id} status updated to {status}."
    if location:
        message += f" Current location: {location}."
    return await send_sms(phone, message)
