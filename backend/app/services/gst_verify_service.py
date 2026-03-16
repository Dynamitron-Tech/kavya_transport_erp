# GST Verification Service — validate GSTIN
import logging
from app.core.config import settings
from app.services.cache_service import is_placeholder, cache_get, cache_set

logger = logging.getLogger(__name__)

CACHE_TTL = 86400  # 24 hours — GST details rarely change


async def verify_gstin(gstin: str) -> dict:
    gstin = gstin.upper().strip()
    cache_key = f"gst:{gstin}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if is_placeholder(settings.GST_VERIFY_API_KEY):
        result = {
            "gstin": gstin,
            "legal_name": "KAVYA TRANSPORT SOLUTIONS PVT LTD",
            "trade_name": "Kavya Transports",
            "status": "Active",
            "registration_date": "2018-07-01",
            "business_type": "Private Limited Company",
            "state": "Tamil Nadu",
            "state_code": "33",
            "address": "123, Transport Nagar, Gandhipuram, Coimbatore - 641012",
            "hsn_info": ["9965 - Goods Transport Services", "9966 - Rental of Transport Vehicles"],
            "filing_status": [
                {"return_type": "GSTR1", "period": "Apr 2025", "status": "Filed"},
                {"return_type": "GSTR3B", "period": "Apr 2025", "status": "Filed"},
            ],
            "source": "MOCK_DATA",
        }
        await cache_set(cache_key, result, CACHE_TTL)
        return result

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"https://sheet.gstincheck.co.in/check/{settings.GST_VERIFY_API_KEY}/{gstin}",
        )
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
