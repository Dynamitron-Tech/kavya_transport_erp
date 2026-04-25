# WhatsApp Service — via Gupshup API
import logging
import httpx
from fastapi import HTTPException
from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_whatsapp_message(phone: str, message: str) -> dict:
    phone = phone.strip().lstrip("+")
    if not phone.startswith("91"):
        phone = f"91{phone}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.gupshup.io/wa/api/v1/msg",
                headers={"apikey": settings.WHATSAPP_API_KEY},
                data={
                    "channel": "whatsapp",
                    "source": settings.WHATSAPP_SOURCE_NUMBER,
                    "destination": phone,
                    "message": message,
                    "src.name": settings.APP_NAME,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "success": data.get("status") == "submitted",
                "message_id": data.get("messageId"),
                "phone": phone, "source": "LIVE",
            }
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="WhatsApp API timeout. Check WHATSAPP_API_KEY in .env")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"WhatsApp API error: {e.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Gupshup WhatsApp API.")


async def send_whatsapp_template(phone: str, template_id: str, params: list[str]) -> dict:
    phone = phone.strip().lstrip("+")
    if not phone.startswith("91"):
        phone = f"91{phone}"
    try:
        import json
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.gupshup.io/wa/api/v1/template/msg",
                headers={"apikey": settings.WHATSAPP_API_KEY},
                data={
                    "source": settings.WHATSAPP_SOURCE_NUMBER,
                    "destination": phone,
                    "template": json.dumps({"id": template_id, "params": params}),
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "success": data.get("status") == "submitted",
                "message_id": data.get("messageId"),
                "source": "LIVE",
            }
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="WhatsApp template API timeout.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"WhatsApp template error: {e.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Gupshup WhatsApp API.")


async def send_tracking_link(phone: str, customer_name: str, job_number: str, tracking_url: str) -> dict:
    """Send a shipment tracking link to a customer via WhatsApp."""
    message = (
        f"Hi {customer_name},\n\n"
        f"Your shipment {job_number} is on the way! "
        f"Track live here:\n{tracking_url}\n\n"
        f"— {settings.APP_NAME}"
    )
    return await send_whatsapp_message(phone, message)


async def send_milestone_notification(phone: str, customer_name: str, job_number: str, milestone: str) -> dict:
    """Notify customer about a shipment milestone (picked up, in transit, delivered, etc.)."""
    message = (
        f"Hi {customer_name},\n\n"
        f"Shipment update for {job_number}:\n"
        f"Status: {milestone}\n\n"
        f"— {settings.APP_NAME}"
    )
    return await send_whatsapp_message(phone, message)
