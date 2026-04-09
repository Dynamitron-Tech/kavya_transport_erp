"""
Razorpay Integration Service
============================
Client-side (incoming) payment gateway for collecting receivables from clients.

Activation:
  Set in .env:
    RAZORPAY_ENABLED=true
    RAZORPAY_KEY_ID=rzp_live_xxxxx
    RAZORPAY_KEY_SECRET=your_secret_key
  Then restart the backend.

Flow:
  1. Accountant creates payment link for an invoice
  2. Razorpay sends link to client via SMS/WhatsApp
  3. Client pays → Razorpay fires webhook to POST /finance/razorpay/webhook
  4. Webhook handler verifies signature → records Payment + updates Invoice

Security:
  - Webhook signature verified with HMAC-SHA256 before any DB writes
  - Keys never exposed to frontend; all calls server-side only
"""

import hmac
import hashlib
import logging
from datetime import date
from typing import Optional

import httpx
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

_RAZORPAY_API = "https://api.razorpay.com/v1"


def _is_enabled() -> bool:
    """Guard: returns True only when keys are configured."""
    return (
        getattr(settings, "RAZORPAY_ENABLED", False)
        and bool(getattr(settings, "RAZORPAY_KEY_ID", ""))
        and bool(getattr(settings, "RAZORPAY_KEY_SECRET", ""))
    )


def _require_enabled():
    if not _is_enabled():
        raise HTTPException(
            status_code=400,
            detail="Razorpay is not configured. Set RAZORPAY_ENABLED=true, "
                   "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env and restart.",
        )


def _auth() -> tuple[str, str]:
    return (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)


async def create_payment_link(
    amount: float,
    description: str,
    customer_name: str,
    customer_phone: str,
    customer_email: str = "",
    reference_id: str = "",
    expire_by: Optional[int] = None,  # Unix timestamp
) -> dict:
    """
    Create a Razorpay Payment Link and return short_url + link_id.
    Amount in INR (will be converted to paise internally).
    """
    _require_enabled()
    amount_paise = int(amount * 100)
    payload = {
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
        "callback_method": "get",
    }
    if expire_by:
        payload["expire_by"] = expire_by

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{_RAZORPAY_API}/payment_links",
                auth=_auth(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("[Razorpay] Payment link created: %s", data.get("id"))
            return {
                "link_id": data["id"],
                "short_url": data["short_url"],
                "amount": amount,
                "currency": "INR",
                "status": data.get("status"),
                "reference_id": reference_id,
            }
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Razorpay API timeout.")
    except httpx.HTTPStatusError as exc:
        logger.error("[Razorpay] create_payment_link HTTP %s: %s", exc.response.status_code, exc.response.text[:300])
        raise HTTPException(status_code=exc.response.status_code, detail=f"Razorpay error: {exc.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Razorpay API.")


def verify_webhook_signature(body_bytes: bytes, signature: str) -> bool:
    """
    Verify the X-Razorpay-Signature header using HMAC-SHA256.
    Must be called before trusting any webhook payload.
    """
    if not _is_enabled():
        return False
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        body_bytes,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature or "")


async def verify_payment(payment_id: str, payment_link_id: str, signature: str) -> dict:
    """
    Verify a payment_link_id + payment_id + signature combination.
    Returns dict with `valid` bool.
    """
    _require_enabled()
    payload = f"{payment_link_id}|{payment_id}"
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature or ""):
        return {"valid": False}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{_RAZORPAY_API}/payments/{payment_id}",
                auth=_auth(),
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "valid": True,
                "payment_id": payment_id,
                "status": data.get("status"),
                "method": data.get("method"),
                "amount": data.get("amount", 0) / 100,
            }
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"Razorpay verify error: {exc.response.text[:200]}")


async def get_payment_status(payment_id: str) -> dict:
    """Fetch live payment status from Razorpay."""
    _require_enabled()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{_RAZORPAY_API}/payments/{payment_id}",
                auth=_auth(),
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "payment_id": payment_id,
                "status": data.get("status"),
                "amount": data.get("amount", 0) / 100,
                "method": data.get("method"),
                "captured": data.get("captured", False),
            }
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Razorpay status API timeout.")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"Razorpay status error: {exc.response.text[:200]}")


async def fetch_payment_link(link_id: str) -> dict:
    """Fetch current state of a payment link from Razorpay."""
    _require_enabled()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{_RAZORPAY_API}/payment_links/{link_id}",
                auth=_auth(),
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "link_id": data["id"],
                "short_url": data.get("short_url"),
                "amount": data.get("amount", 0) / 100,
                "amount_paid": data.get("amount_paid", 0) / 100,
                "status": data.get("status"),
                "payments": data.get("payments", []),
            }
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"Razorpay fetch error: {exc.response.text[:200]}")


# ─── Razorpay X Payout API — Driver Advance ───────────────────────────────────

def _x_auth() -> tuple:
    """Auth tuple for Razorpay X (business banking) key pair."""
    key_id     = getattr(settings, 'RAZORPAY_X_KEY_ID',     None)
    key_secret = getattr(settings, 'RAZORPAY_X_KEY_SECRET', None)
    if not key_id or not key_secret:
        raise HTTPException(
            status_code=400,
            detail="Razorpay X is not configured. Set RAZORPAY_X_KEY_ID and RAZORPAY_X_KEY_SECRET in .env.",
        )
    return (key_id, key_secret)


async def trigger_razorpay_payout(upi_id: str, amount_paise: int) -> dict:
    """
    Send driver advance (₹1,500) to driver UPI via Razorpay X Payout API.

    Requires:
      RAZORPAY_X_KEY_ID        — Razorpay X account key ID
      RAZORPAY_X_KEY_SECRET    — Razorpay X account key secret
      RAZORPAY_X_ACCOUNT_NUMBER — Linked current account number

    Returns payout dict with at least `id` and `status`.
    NOT used for any expense other than driver_advance.
    """
    account_number = getattr(settings, 'RAZORPAY_X_ACCOUNT_NUMBER', None)
    if not account_number:
        raise HTTPException(
            status_code=400,
            detail="RAZORPAY_X_ACCOUNT_NUMBER not configured in .env.",
        )

    payload = {
        "account_number": account_number,
        "fund_account": {
            "account_type": "vpa",
            "vpa": {"address": upi_id},
            "contact": {
                "name":  "Driver",
                "type":  "employee",
                "email": "driver@kavyatransports.com",
            },
        },
        "amount":               amount_paise,
        "currency":             "INR",
        "mode":                 "UPI",
        "purpose":              "salary",
        "queue_if_low_balance": True,
        "narration":            "Kavya Transports driver advance",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "https://api.razorpay.com/v1/payouts",
                auth  = _x_auth(),
                json  = payload,
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("[RazorpayX] Payout created: %s status=%s", data.get("id"), data.get("status"))
            return data
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Razorpay X payout API timeout.")
    except httpx.HTTPStatusError as exc:
        logger.error("[RazorpayX] Payout HTTP %s: %s", exc.response.status_code, exc.response.text[:300])
        raise HTTPException(
            status_code = exc.response.status_code,
            detail      = f"Razorpay X payout error: {exc.response.text[:200]}",
        )

