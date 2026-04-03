# OTP Service — generate, store in MongoDB, send via WhatsApp, verify
import secrets
import string
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

OTP_TTL_MINUTES = 5


def _generate_otp() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(6))


def _mask_phone(phone: str) -> str:
    """Return something like +91 XXXXX X7400"""
    clean = (phone or "").strip().lstrip("+")
    if len(clean) >= 10:
        return f"+{clean[:2]} XXXXX X{clean[-4:]}"
    return "XXXXXXXXXX"


async def create_otp_session(user_id: int, phone: str) -> dict:
    """Generate a 6-digit OTP, store in MongoDB, return session_id + masked phone."""
    from app.db.mongodb.connection import MongoDB
    mongo_db = MongoDB.db

    otp = _generate_otp()
    session_id = str(uuid.uuid4())
    now = datetime.utcnow()

    await mongo_db.otp_sessions.insert_one({
        "session_id": session_id,
        "user_id": user_id,
        "otp": otp,
        "created_at": now,
        "expires_at": now + timedelta(minutes=OTP_TTL_MINUTES),
        "verified": False,
    })

    return {
        "session_id": session_id,
        "otp": otp,  # used internally to send
        "phone_masked": _mask_phone(phone),
    }


async def send_otp(phone: str, otp: str) -> bool:
    """Send OTP via Brevo SMS. Returns True on success, False on failure (non-fatal)."""
    try:
        from app.services.brevo_service import send_sms
        message = (
            f"Your Kavya Transports login OTP is: {otp}. "
            f"Valid for {OTP_TTL_MINUTES} minutes. Do not share with anyone."
        )
        return await send_sms(phone, message)
    except Exception as exc:
        logger.warning(f"[OTP] SMS send failed: {exc}")
        return False


async def verify_otp(session_id: str, otp: str) -> tuple[bool, int | None]:
    """
    Verify the OTP for the given session.
    Returns (success: bool, user_id: int | None).
    """
    from app.db.mongodb.connection import MongoDB
    mongo_db = MongoDB.db

    doc = await mongo_db.otp_sessions.find_one({"session_id": session_id})
    if not doc:
        return False, None
    if doc.get("verified"):
        return False, None  # already used
    if datetime.utcnow() > doc["expires_at"]:
        return False, None  # expired

    if doc["otp"] != otp.strip():
        return False, None

    # Mark as verified so it can't be reused
    await mongo_db.otp_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"verified": True}},
    )
    return True, doc["user_id"]
