# Brevo (Sendinblue) Transactional SMS Service
import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

BREVO_SMS_URL = "https://api.brevo.com/v3/transactionalSMS/sms"


def _normalize_phone(phone: str) -> str:
    """
    Brevo expects E.164 format with leading +.
    e.g. '+917470047400'
    """
    cleaned = phone.strip()
    if not cleaned.startswith("+"):
        if cleaned.startswith("91") and len(cleaned) >= 12:
            cleaned = f"+{cleaned}"
        else:
            cleaned = f"+91{cleaned}"
    return cleaned


async def send_sms(phone: str, message: str) -> bool:
    """
    Send a transactional SMS via Brevo API.
    Returns True on success, False on failure (non-fatal for OTP flow).
    """
    if not settings.BREVO_API_KEY or settings.BREVO_API_KEY == "YOUR_BREVO_API_KEY_HERE":
        logger.warning("[Brevo] BREVO_API_KEY not configured — SMS not sent")
        return False

    to_number = _normalize_phone(phone)
    payload = {
        "sender": settings.BREVO_SMS_SENDER,
        "recipient": to_number,
        "content": message,
        "type": "transactional",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                BREVO_SMS_URL,
                json=payload,
                headers={
                    "api-key": settings.BREVO_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
            if resp.status_code in (200, 201):
                logger.info(f"[Brevo] SMS sent to {to_number}")
                return True
            else:
                logger.warning(f"[Brevo] SMS failed ({resp.status_code}): {resp.text[:200]}")
                return False
    except Exception as exc:
        logger.warning(f"[Brevo] SMS exception: {exc}")
        return False
