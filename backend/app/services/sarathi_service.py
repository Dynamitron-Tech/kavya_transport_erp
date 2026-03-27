# Sarathi Service — Driving Licence verification
import logging
import httpx
from fastapi import HTTPException
from app.core.config import settings
from app.services.cache_service import cache_get, cache_set

logger = logging.getLogger(__name__)


async def verify_driving_licence(dl_number: str, dob: str = "") -> dict:
    dl_number = dl_number.upper().replace(" ", "")
    cache_key = f"sarathi:{dl_number}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://sarathi.parivahan.gov.in/api/dl/verify",
                headers={"Authorization": f"Bearer {settings.SARATHI_API_KEY}"},
                json={"dl_number": dl_number, "dob": dob},
            )
            resp.raise_for_status()
            result = resp.json()
            result["source"] = "LIVE"
            await cache_set(cache_key, result, 86400)
            return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Sarathi API timeout. Check SARATHI_API_KEY in .env")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Sarathi API error: {e.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Sarathi API. Check network.")


async def get_dl_details(dl_number: str) -> dict:
    return await verify_driving_licence(dl_number)
