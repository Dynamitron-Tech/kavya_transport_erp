# Brevo (Sendinblue) Transactional SMS + Email Service
import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

BREVO_SMS_URL = "https://api.brevo.com/v3/transactionalSMS/sms"
BREVO_EMAIL_URL = "https://api.brevo.com/v3/smtp/email"

OTP_TTL_MINUTES = 5


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


async def send_email_otp(to_email: str, otp: str) -> bool:
    """
    Send OTP via Brevo transactional email.
    Free tier supports up to 300 emails/day.
    Returns True on success, False on failure (non-fatal).
    """
    if not settings.BREVO_API_KEY or settings.BREVO_API_KEY == "YOUR_BREVO_API_KEY_HERE":
        logger.warning("[Brevo] BREVO_API_KEY not configured — email OTP not sent")
        return False

    html_content = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9f9f9;border-radius:8px">
        <h2 style="color:#1e40af;margin-bottom:8px">Kavya Transports</h2>
        <p style="color:#374151;margin-bottom:24px">Your one-time login OTP:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#111827;background:#fff;border:2px solid #e5e7eb;border-radius:8px;padding:20px;text-align:center">{otp}</div>
        <p style="color:#6b7280;font-size:13px;margin-top:20px">Valid for {OTP_TTL_MINUTES} minutes. Do not share this code with anyone.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:12px">If you didn't request this, you can ignore this email.</p>
    </div>
    """

    payload = {
        "sender": {
            "email": settings.BREVO_EMAIL_SENDER,
            "name": settings.BREVO_EMAIL_SENDER_NAME,
        },
        "to": [{"email": to_email}],
        "subject": f"{otp} — Your Kavya Transports Login OTP",
        "htmlContent": html_content,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                BREVO_EMAIL_URL,
                json=payload,
                headers={
                    "api-key": settings.BREVO_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
            if resp.status_code in (200, 201):
                logger.info(f"[Brevo] Email OTP sent to {to_email}")
                return True
            else:
                logger.warning(f"[Brevo] Email OTP failed ({resp.status_code}): {resp.text[:300]}")
                return False
    except Exception as exc:
        logger.warning(f"[Brevo] Email OTP exception: {exc}")
        return False
