# Razorpay Payment Service — create payment links, verify payments
import logging
import httpx
from fastapi import HTTPException
from app.core.config import settings

logger = logging.getLogger(__name__)


async def create_payment_link(amount: float, description: str, customer_name: str,
                               customer_phone: str, customer_email: str = "",
                               reference_id: str = "") -> dict:
    amount_paise = int(amount * 100)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.razorpay.com/v1/payment_links",
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
                json={
                    "amount": amount_paise, "currency": "INR",
                    "description": description,
                    "customer": {"name": customer_name, "contact": customer_phone, "email": customer_email},
                    "reference_id": reference_id,
                    "notify": {"sms": True, "email": bool(customer_email)},
                    "callback_url": "", "callback_method": "get",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "success": True, "link_id": data.get("id"),
                "short_url": data.get("short_url"),
                "amount": amount, "currency": "INR",
                "status": data.get("status"),
                "reference_id": reference_id, "source": "LIVE",
            }
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Razorpay API timeout. Check RAZORPAY_KEY_ID in .env")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Razorpay error: {e.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Razorpay API.")


async def verify_payment(payment_id: str, payment_link_id: str, signature: str) -> dict:
    import hmac, hashlib
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f"{payment_link_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return {"valid": False, "source": "LIVE"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://api.razorpay.com/v1/payments/{payment_id}",
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "valid": True, "payment_id": payment_id,
                "status": data.get("status"), "method": data.get("method"),
                "amount": data.get("amount", 0) / 100, "source": "LIVE",
            }
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Razorpay verify error: {e.response.text[:200]}")


async def get_payment_status(payment_id: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://api.razorpay.com/v1/payments/{payment_id}",
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "payment_id": payment_id, "status": data.get("status"),
                "amount": data.get("amount", 0) / 100,
                "method": data.get("method"),
                "captured": data.get("captured", False), "source": "LIVE",
            }
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Razorpay status API timeout.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Razorpay status error: {e.response.text[:200]}")
