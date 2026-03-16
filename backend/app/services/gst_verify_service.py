# GST Verification Service — validate GSTIN
import logging
import httpx
from fastapi import HTTPException
from app.core.config import settings
from app.services.cache_service import cache_get, cache_set

logger = logging.getLogger(__name__)
CACHE_TTL = 86400


async def verify_gstin(gstin: str) -> dict:
    gstin = gstin.upper().strip()
    cache_key = f"gst:{gstin}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://sheet.gstincheck.co.in/check/{settings.GST_VERIFY_API_KEY}/{gstin}",
            )
            resp.raise_for_status()
            data = resp.json()
            result = {
                "gstin": gstin,
                "legal_name": data.get("data", {}).get("lgnm", ""),
                "trade_name": data.get("data", {}).get("tradeNam", ""),
                "status": data.get("data", {}).get("sts", ""),
                "registration_date": data.get("data", {}).get("rgdt", ""),
                "business_type": data.get("data", {}).get("ctb", ""),
                "state": data.get("data", {}).get("stj", ""),
                "address": str(data.get("data", {}).get("pradr", {}).get("adr", "")),
                "source": "LIVE",
            }
            await cache_set(cache_key, result, CACHE_TTL)
            return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="GST Verify API timeout. Check GST_VERIFY_API_KEY in .env")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"GST Verify API error: {e.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to GST Verify API. Check network.")
