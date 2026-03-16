# VAHAN Service — Vehicle RC, Insurance, Fitness, Permit, PUC lookups
import logging
import httpx
from fastapi import HTTPException
from app.core.config import settings
from app.services.cache_service import cache_get, cache_set

logger = logging.getLogger(__name__)
CACHE_TTL = 86400


async def _vahan_request(method: str, url: str, **kwargs) -> dict:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await getattr(client, method.lower())(url, **kwargs)
            resp.raise_for_status()
            result = resp.json()
            result["source"] = "LIVE"
            return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="VAHAN API timeout. Check VAHAN_API_KEY in .env")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"VAHAN API error: {e.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to VAHAN API. Check network and VAHAN_API_URL in .env")


async def lookup_vehicle_by_rc(reg_number: str) -> dict:
    reg_number = reg_number.upper().replace(" ", "")
    cache_key = f"vahan:{reg_number}:rc"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    result = await _vahan_request(
        "POST", settings.VAHAN_API_URL,
        headers={"Authorization": f"Bearer {settings.VAHAN_API_KEY}"},
        json={"reg_number": reg_number},
    )
    await cache_set(cache_key, result, CACHE_TTL)
    return result


async def check_insurance(reg_number: str) -> dict:
    reg_number = reg_number.upper().replace(" ", "")
    cache_key = f"vahan:{reg_number}:insurance"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    result = await _vahan_request(
        "GET", f"{settings.VAHAN_API_URL}/insurance/{reg_number}",
        headers={"Authorization": f"Bearer {settings.VAHAN_API_KEY}"},
    )
    await cache_set(cache_key, result, CACHE_TTL)
    return result


async def check_fitness(reg_number: str) -> dict:
    reg_number = reg_number.upper().replace(" ", "")
    cache_key = f"vahan:{reg_number}:fitness"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    result = await _vahan_request(
        "GET", f"{settings.VAHAN_API_URL}/fitness/{reg_number}",
        headers={"Authorization": f"Bearer {settings.VAHAN_API_KEY}"},
    )
    await cache_set(cache_key, result, CACHE_TTL)
    return result


async def check_permit(reg_number: str) -> dict:
    reg_number = reg_number.upper().replace(" ", "")
    cache_key = f"vahan:{reg_number}:permit"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    result = await _vahan_request(
        "GET", f"{settings.VAHAN_API_URL}/permit/{reg_number}",
        headers={"Authorization": f"Bearer {settings.VAHAN_API_KEY}"},
    )
    await cache_set(cache_key, result, CACHE_TTL)
    return result


async def check_puc(reg_number: str) -> dict:
    reg_number = reg_number.upper().replace(" ", "")
    cache_key = f"vahan:{reg_number}:puc"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    result = await _vahan_request(
        "GET", f"{settings.VAHAN_API_URL}/puc/{reg_number}",
        headers={"Authorization": f"Bearer {settings.VAHAN_API_KEY}"},
    )
    await cache_set(cache_key, result, CACHE_TTL)
    return result


async def check_blacklist(reg_number: str) -> dict:
    reg_number = reg_number.upper().replace(" ", "")
    return await _vahan_request(
        "GET", f"{settings.VAHAN_API_URL}/blacklist/{reg_number}",
        headers={"Authorization": f"Bearer {settings.VAHAN_API_KEY}"},
    )


async def full_vehicle_check(reg_number: str) -> dict:
    rc = await lookup_vehicle_by_rc(reg_number)
    insurance = await check_insurance(reg_number)
    fitness = await check_fitness(reg_number)
    permit = await check_permit(reg_number)
    puc = await check_puc(reg_number)
    blacklist = await check_blacklist(reg_number)
    return {
        "reg_number": reg_number,
        "rc_details": rc, "insurance": insurance,
        "fitness": fitness, "permit": permit,
        "puc": puc, "blacklist": blacklist,
        "source": "LIVE",
    }
