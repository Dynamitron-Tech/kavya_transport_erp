"""
Razorpay Payouts (X Payouts) Service
=====================================
Outgoing payments: salaries, advances, expenses, rent, tax, insurance, permits.
Uses Razorpay X business banking API — DIFFERENT from the payment gateway.

API base: https://api.razorpay.com/v1/
Auth: HTTP Basic with key_id and key_secret (Razorpay X keys)
"""

import re
import logging
from typing import Optional
from dataclasses import dataclass

import httpx
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

_BASE_URL = "https://api.razorpay.com/v1"


def _is_x_enabled() -> bool:
    return bool(
        getattr(settings, "RAZORPAY_X_KEY_ID", None)
        and getattr(settings, "RAZORPAY_X_KEY_SECRET", None)
    )


def _x_auth() -> tuple[str, str]:
    key_id = getattr(settings, "RAZORPAY_X_KEY_ID", None)
    key_secret = getattr(settings, "RAZORPAY_X_KEY_SECRET", None)
    if not key_id or not key_secret:
        raise HTTPException(
            status_code=400,
            detail="Razorpay X is not configured. Set RAZORPAY_X_KEY_ID and RAZORPAY_X_KEY_SECRET in .env.",
        )
    return (key_id, key_secret)


def _account_number() -> str:
    acct = getattr(settings, "RAZORPAY_X_ACCOUNT_NUMBER", None)
    if not acct:
        raise HTTPException(
            status_code=400,
            detail="RAZORPAY_X_ACCOUNT_NUMBER not configured in .env.",
        )
    return acct


@dataclass
class RazorpayPayoutResponse:
    razorpay_payout_id: str
    status: str
    utr: Optional[str] = None
    fees: int = 0
    tax: int = 0
    fund_account_id: Optional[str] = None


# ─── Contact Management ────────────────────────────────────────────────────────


async def create_contact(
    name: str,
    contact_type: str = "employee",
    email: Optional[str] = None,
    phone: Optional[str] = None,
    reference_id: Optional[str] = None,
) -> dict:
    """Create a Razorpay contact. Returns dict with 'id' as razorpay_contact_id."""
    payload = {
        "name": name,
        "type": contact_type,
    }
    if email:
        payload["email"] = email
    if phone:
        payload["contact"] = phone
    if reference_id:
        payload["reference_id"] = reference_id

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{_BASE_URL}/contacts",
                auth=_x_auth(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("[RazorpayX] Contact created: %s", data.get("id"))
            return data
    except httpx.HTTPStatusError as exc:
        logger.error("[RazorpayX] create_contact HTTP %s: %s", exc.response.status_code, exc.response.text[:300])
        raise HTTPException(status_code=exc.response.status_code, detail=f"Razorpay contact error: {exc.response.text[:200]}")


# ─── Fund Account Management ───────────────────────────────────────────────────


async def add_bank_account(
    razorpay_contact_id: str,
    account_number: str,
    ifsc: str,
    account_holder_name: str,
) -> dict:
    """Create a bank_account fund account. Returns dict with fund_account_id."""
    payload = {
        "contact_id": razorpay_contact_id,
        "account_type": "bank_account",
        "bank_account": {
            "name": account_holder_name,
            "ifsc": ifsc.upper(),
            "account_number": account_number,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{_BASE_URL}/fund_accounts",
                auth=_x_auth(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("[RazorpayX] Bank fund account created: %s", data.get("id"))
            return data
    except httpx.HTTPStatusError as exc:
        logger.error("[RazorpayX] add_bank_account HTTP %s: %s", exc.response.status_code, exc.response.text[:300])
        raise HTTPException(status_code=exc.response.status_code, detail=f"Razorpay fund account error: {exc.response.text[:200]}")


async def add_upi(
    razorpay_contact_id: str,
    upi_id: str,
    account_holder_name: str,
) -> dict:
    """Create a VPA (UPI) fund account. Returns dict with fund_account_id."""
    payload = {
        "contact_id": razorpay_contact_id,
        "account_type": "vpa",
        "vpa": {"address": upi_id},
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{_BASE_URL}/fund_accounts",
                auth=_x_auth(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("[RazorpayX] UPI fund account created: %s", data.get("id"))
            return data
    except httpx.HTTPStatusError as exc:
        logger.error("[RazorpayX] add_upi HTTP %s: %s", exc.response.status_code, exc.response.text[:300])
        raise HTTPException(status_code=exc.response.status_code, detail=f"Razorpay UPI error: {exc.response.text[:200]}")


# ─── Payouts ────────────────────────────────────────────────────────────────────


async def create_payout(
    fund_account_id: str,
    amount_paise: int,
    purpose: str = "payout",
    mode: str = "IMPS",
    narration: str = "",
    reference_id: str = "",
    queue_if_low_balance: bool = True,
) -> RazorpayPayoutResponse:
    """
    Create a Razorpay payout.
    purpose: 'salary' | 'payout' | 'vendor_advance' | 'reimbursement'
    mode: 'IMPS' | 'NEFT' | 'UPI'
    """
    payload = {
        "account_number": _account_number(),
        "fund_account_id": fund_account_id,
        "amount": amount_paise,
        "currency": "INR",
        "mode": mode,
        "purpose": purpose,
        "queue_if_low_balance": queue_if_low_balance,
    }
    if narration:
        payload["narration"] = narration[:30]  # Razorpay limit
    if reference_id:
        payload["reference_id"] = reference_id

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{_BASE_URL}/payouts",
                auth=_x_auth(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("[RazorpayX] Payout created: %s status=%s", data.get("id"), data.get("status"))
            return RazorpayPayoutResponse(
                razorpay_payout_id=data["id"],
                status=data.get("status", "unknown"),
                utr=data.get("utr"),
                fees=data.get("fees", 0),
                tax=data.get("tax", 0),
                fund_account_id=fund_account_id,
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Razorpay X payout API timeout.")
    except httpx.HTTPStatusError as exc:
        logger.error("[RazorpayX] Payout HTTP %s: %s", exc.response.status_code, exc.response.text[:300])
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Razorpay X payout error: {exc.response.text[:200]}",
        )


async def get_payout_status(razorpay_payout_id: str) -> dict:
    """Get current status of a payout."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{_BASE_URL}/payouts/{razorpay_payout_id}",
                auth=_x_auth(),
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "id": data["id"],
                "status": data.get("status"),
                "utr": data.get("utr"),
                "failure_reason": data.get("failure_reason"),
            }
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"Razorpay status error: {exc.response.text[:200]}")


async def cancel_payout(razorpay_payout_id: str) -> bool:
    """Cancel a queued payout. Returns True if successful."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{_BASE_URL}/payouts/{razorpay_payout_id}/cancel",
                auth=_x_auth(),
            )
            resp.raise_for_status()
            return True
    except httpx.HTTPStatusError:
        return False


# ─── Balance ────────────────────────────────────────────────────────────────────


async def get_balance() -> int:
    """Get Razorpay X account balance in paise."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{_BASE_URL}/balance",
                auth=_x_auth(),
                params={"account_number": _account_number()},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("balance", 0)
    except httpx.HTTPStatusError:
        return 0


# ─── Validation Helpers ─────────────────────────────────────────────────────────


def validate_ifsc(ifsc: str) -> bool:
    """Validate IFSC format: 4 letters + 0 + 6 alphanumeric."""
    return bool(re.match(r'^[A-Z]{4}0[A-Z0-9]{6}$', ifsc.upper()))


def validate_upi(upi_id: str) -> bool:
    """Validate UPI format: username@provider."""
    return bool(re.match(r'^[\w.\-]+@[a-z]+$', upi_id.lower()))


def select_mode(amount_paise: int, for_type: str = "general") -> str:
    """
    Business rules for payment mode selection.
    - UPI limit is ₹2L (200000 * 100 = 20000000 paise)
    - Tax/government → NEFT
    - Salary/advance → IMPS (instant)
    """
    if for_type in ("tax", "insurance", "permit"):
        return "NEFT"
    if amount_paise >= 20_000_000:  # ₹2,00,000
        return "NEFT"
    if for_type in ("salary", "advance"):
        return "IMPS"
    return "IMPS"
