# E-way Bill Government API Service — generate / cancel / extend
import logging
import httpx
from fastapi import HTTPException
from app.core.config import settings
from app.services.cache_service import cache_get, cache_set

logger = logging.getLogger(__name__)


async def _get_ewb_token() -> str:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.EWAY_BILL_API_URL}/dec/v01/auth",
                json={
                    "action": "ACCESSTOKEN",
                    "username": settings.EWAY_BILL_USERNAME,
                    "password": settings.EWAY_BILL_PASSWORD,
                    "app_key": settings.EWAY_BILL_GSTIN,
                },
            )
            resp.raise_for_status()
            token = resp.json().get("authtoken")
            if not token:
                raise HTTPException(status_code=502, detail="E-way Bill auth returned no token. Check credentials in .env")
            return token
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="E-way Bill API auth timeout.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"E-way Bill auth error: {e.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to E-way Bill API. Check EWAY_BILL_API_URL in .env")


async def generate_eway_bill(payload: dict) -> dict:
    token = await _get_ewb_token()
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.EWAY_BILL_API_URL}/dec/v01/generation",
                headers={"authtoken": token, "gstin": settings.EWAY_BILL_GSTIN},
                json=payload,
            )
            resp.raise_for_status()
            result = resp.json()
            result["source"] = "LIVE"
            return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="E-way Bill generation timeout.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"E-way Bill generation error: {e.response.text[:200]}")


async def cancel_eway_bill(ewb_number: str, reason: str, reason_code: int = 1) -> dict:
    token = await _get_ewb_token()
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.EWAY_BILL_API_URL}/dec/v01/ewayapi",
                headers={"authtoken": token, "gstin": settings.EWAY_BILL_GSTIN},
                json={"ewbNo": ewb_number, "cancelRsnCode": reason_code, "cancelRmrk": reason},
            )
            resp.raise_for_status()
            result = resp.json()
            result["source"] = "LIVE"
            return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="E-way Bill cancellation timeout.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"E-way Bill cancel error: {e.response.text[:200]}")


async def extend_eway_bill(ewb_number: str, vehicle_no: str, remaining_distance: int, reason: str, reason_code: int = 4) -> dict:
    token = await _get_ewb_token()
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.EWAY_BILL_API_URL}/dec/v01/ewayapi",
                headers={"authtoken": token, "gstin": settings.EWAY_BILL_GSTIN},
                json={
                    "ewbNo": ewb_number, "vehicleNo": vehicle_no,
                    "remainingDistance": remaining_distance,
                    "transDocNo": "", "transDocDate": "", "transMode": "1",
                    "extnRsnCode": reason_code, "extnRemarks": reason,
                },
            )
            resp.raise_for_status()
            result = resp.json()
            result["source"] = "LIVE"
            return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="E-way Bill extension timeout.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"E-way Bill extend error: {e.response.text[:200]}")


async def get_eway_bill_details(ewb_number: str) -> dict:
    cache_key = f"ewb:{ewb_number}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    token = await _get_ewb_token()
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{settings.EWAY_BILL_API_URL}/dec/v01/ewayapi",
                headers={"authtoken": token, "gstin": settings.EWAY_BILL_GSTIN},
                params={"ewbNo": ewb_number},
            )
            resp.raise_for_status()
            result = resp.json()
            result["source"] = "LIVE"
            await cache_set(cache_key, result, 3600)
            return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="E-way Bill details timeout.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"E-way Bill details error: {e.response.text[:200]}")
