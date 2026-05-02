# eChallan Service — Traffic challan lookup
import logging
import httpx
from fastapi import HTTPException
from app.core.config import settings
from app.services.cache_service import cache_get, cache_set

logger = logging.getLogger(__name__)
CACHE_TTL = 3600


async def _echallan_request(url: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                url, headers={"Authorization": f"Bearer {settings.ECHALLAN_API_KEY}"},
            )
            resp.raise_for_status()
            result = resp.json()
            result["source"] = "LIVE"
            return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="eChallan API timeout. Check ECHALLAN_API_KEY in .env")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"eChallan API error: {e.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to eChallan API. Check network.")


async def get_challans_by_vehicle(reg_number: str) -> dict:
    reg_number = reg_number.upper().replace(" ", "")
    cache_key = f"echallan:{reg_number}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    result = await _echallan_request(f"{settings.ECHALLAN_API_URL}/vehicle/{reg_number}")
    await cache_set(cache_key, result, CACHE_TTL)
    return result


async def get_challans_by_dl(dl_number: str) -> dict:
    dl_number = dl_number.upper().replace(" ", "")
    cache_key = f"echallan:dl:{dl_number}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    result = await _echallan_request(f"{settings.ECHALLAN_API_URL}/dl/{dl_number}")
    await cache_set(cache_key, result, CACHE_TTL)
    return result


async def get_challan_payment_status(challan_number: str) -> dict:
    result = await _echallan_request(f"{settings.ECHALLAN_API_URL}/status/{challan_number}")
    return result
