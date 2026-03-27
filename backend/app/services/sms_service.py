# SMS Service — via MSG91
import logging
import httpx
from fastapi import HTTPException
from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_sms(phone: str, message: str) -> dict:
    phone = phone.strip().lstrip("+")
    if not phone.startswith("91"):
        phone = f"91{phone}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://control.msg91.com/api/v5/flow/",
                headers={"authkey": settings.MSG91_API_KEY, "Content-Type": "application/json"},
                json={
                    "sender": settings.MSG91_SENDER_ID,
                    "route": "4", "country": "91",
                    "sms": [{"message": message, "to": [phone]}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "success": data.get("type") == "success",
                "request_id": data.get("request_id"),
                "phone": phone, "source": "LIVE",
            }
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="MSG91 SMS API timeout. Check MSG91_API_KEY in .env")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"MSG91 SMS error: {e.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to MSG91 API.")


async def send_otp(phone: str, otp: str) -> dict:
    message = f"Your OTP for {settings.APP_NAME} is {otp}. Valid for 10 minutes."
    return await send_sms(phone, message)


async def send_trip_update_sms(phone: str, trip_id: str, status: str, location: str | None = None) -> dict:
    message = f"{settings.APP_NAME}: Trip {trip_id} status updated to {status}."
    if location:
        message += f" Current location: {location}."
    return await send_sms(phone, message)
