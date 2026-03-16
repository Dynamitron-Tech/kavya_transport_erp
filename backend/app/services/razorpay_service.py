# Razorpay Payment Service — create payment links, verify payments
import logging
from datetime import datetime
from app.core.config import settings
from app.services.cache_service import is_placeholder

logger = logging.getLogger(__name__)


async def create_payment_link(amount: float, description: str, customer_name: str, customer_phone: str, customer_email: str = "", reference_id: str = "") -> dict:
    amount_paise = int(amount * 100)  # Razorpay expects paise

    if is_placeholder(settings.RAZORPAY_KEY_ID) or is_placeholder(settings.RAZORPAY_KEY_SECRET):
        link_id = f"mock_pl_{datetime.utcnow().strftime('%y%m%d%H%M%S')}"
        return {
            "success": True,
            "link_id": link_id,
            "short_url": f"https://rzp.io/i/{link_id}",
            "amount": amount,
            "currency": "INR",
            "status": "created",
            "reference_id": reference_id,
            "source": "MOCK_DATA",
        }

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://api.razorpay.com/v1/payment_links",
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
            json={
                "amount": amount_paise,
                "currency": "INR",
                "description": description,
                "customer": {
                    "name": customer_name,
                    "contact": customer_phone,
                    "email": customer_email,
                },
                "reference_id": reference_id,
                "notify": {"sms": True, "email": bool(customer_email)},
                "callback_url": "",
                "callback_method": "get",
            },
        )
        data = resp.json()
        return {
            "success": True,
            "link_id": data.get("id"),
            "short_url": data.get("short_url"),
            "amount": amount,
            "currency": "INR",
            "status": data.get("status"),
            "reference_id": reference_id,
            "source": "LIVE",
        }


async def verify_payment(payment_id: str, payment_link_id: str, signature: str) -> dict:
    if is_placeholder(settings.RAZORPAY_KEY_SECRET):
        return {
            "valid": True,
            "payment_id": payment_id,
            "status": "captured",
            "method": "upi",
            "amount": 10000.00,
            "source": "MOCK_DATA",
        }

    import hmac, hashlib
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f"{payment_link_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        return {"valid": False, "source": "LIVE"}

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"https://api.razorpay.com/v1/payments/{payment_id}",
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
        )
        data = resp.json()
        return {
            "valid": True,
            "payment_id": payment_id,
            "status": data.get("status"),
            "method": data.get("method"),
            "amount": data.get("amount", 0) / 100,
            "source": "LIVE",
        }


async def get_payment_status(payment_id: str) -> dict:
    if is_placeholder(settings.RAZORPAY_KEY_ID):
        return {
            "payment_id": payment_id,
            "status": "captured",
            "amount": 10000.00,
            "method": "upi",
            "captured": True,
            "source": "MOCK_DATA",
        }

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"https://api.razorpay.com/v1/payments/{payment_id}",
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
        )
        data = resp.json()
        return {
            "payment_id": payment_id,
            "status": data.get("status"),
            "amount": data.get("amount", 0) / 100,
            "method": data.get("method"),
            "captured": data.get("captured", False),
            "source": "LIVE",
        }
