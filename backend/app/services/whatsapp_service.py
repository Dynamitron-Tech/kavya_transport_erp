# WhatsApp Service — via Gupshup API
import logging
from app.core.config import settings
from app.services.cache_service import is_placeholder

logger = logging.getLogger(__name__)


async def send_whatsapp_message(phone: str, message: str) -> dict:
    phone = phone.strip().lstrip("+")
    if not phone.startswith("91"):
        phone = f"91{phone}"

    if is_placeholder(settings.WHATSAPP_API_KEY):
        logger.info(f"[MOCK WhatsApp] → +{phone}: {message[:80]}...")
        return {
            "success": True,
            "message_id": f"mock_wa_{id(message)}",
            "phone": phone,
            "source": "MOCK_DATA",
        }

    import httpx
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
        data = resp.json()
        return {
            "success": data.get("status") == "submitted",
            "message_id": data.get("messageId"),
            "phone": phone,
            "source": "LIVE",
        }


async def send_whatsapp_template(phone: str, template_id: str, params: list[str]) -> dict:
    phone = phone.strip().lstrip("+")
    if not phone.startswith("91"):
        phone = f"91{phone}"

    if is_placeholder(settings.WHATSAPP_API_KEY):
        logger.info(f"[MOCK WhatsApp Template] → +{phone}: {template_id} params={params}")
        return {
            "success": True,
            "message_id": f"mock_wa_tmpl_{id(template_id)}",
            "template_id": template_id,
            "phone": phone,
            "source": "MOCK_DATA",
        }

    import httpx
    import json
    template_payload = json.dumps({
        "id": template_id,
        "params": params,
    })
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://api.gupshup.io/wa/api/v1/template/msg",
            headers={"apikey": settings.WHATSAPP_API_KEY},
            data={
                "source": settings.WHATSAPP_SOURCE_NUMBER,
                "destination": phone,
                "template": template_payload,
            },
        )
        data = resp.json()
        return {
            "success": data.get("status") == "submitted",
            "message_id": data.get("messageId"),
            "source": "LIVE",
        }
