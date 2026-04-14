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
    # Always use the last 10 digits as the Indian number
    if len(clean) >= 10:
        clean = clean[-10:]
    if len(clean) >= 4:
        return f"+91 XXXXX X{clean[-4:]}"
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


# ── Market Driver OTP Sessions ──────────────────────────────────────────────
# These sessions link a phone number to a MSG91 Widget session so we can look
# up which market trips belong to that phone after verification.

MARKET_DRIVER_OTP_TTL_MINUTES = 10


async def create_market_driver_otp_session(phone: str) -> str:
    """
    Store a pending market-driver OTP session keyed by phone.
    Returns a session_id that the client must echo back during verification.
    """
    from app.db.mongodb.connection import MongoDB
    mongo_db = MongoDB.db

    session_id = str(uuid.uuid4())
    now = datetime.utcnow()
    # Remove any existing pending sessions for this phone
    await mongo_db.market_driver_otp_sessions.delete_many({"phone": phone})
    await mongo_db.market_driver_otp_sessions.insert_one({
        "session_id": session_id,
        "phone": phone,
        "verified": False,
        "created_at": now,
        "expires_at": now + timedelta(minutes=MARKET_DRIVER_OTP_TTL_MINUTES),
    })
    return session_id


async def get_market_driver_otp_session(session_id: str):
    """Return the session document or None if not found / expired."""
    from app.db.mongodb.connection import MongoDB
    mongo_db = MongoDB.db

    doc = await mongo_db.market_driver_otp_sessions.find_one({"session_id": session_id})
    if not doc:
        return None
    if datetime.utcnow() > doc["expires_at"]:
        return None
    return doc


async def mark_market_driver_otp_verified(session_id: str):
    """Mark a market driver OTP session as verified so it cannot be reused."""
    from app.db.mongodb.connection import MongoDB
    mongo_db = MongoDB.db
    await mongo_db.market_driver_otp_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"verified": True}},
    )


async def get_phone_from_session(session_id: str) -> str | None:
    """Retrieve the phone number stored in a market driver OTP session."""
    doc = await get_market_driver_otp_session(session_id)
    if doc and not doc.get("verified"):
        return doc["phone"]
    return None
