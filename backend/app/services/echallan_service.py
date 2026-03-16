# eChallan Service — Traffic challan lookup
import logging
from datetime import date, timedelta

from app.core.config import settings
from app.services.cache_service import is_placeholder, cache_get, cache_set

logger = logging.getLogger(__name__)

CACHE_TTL = 3600  # 1 hour — challans change more frequently


async def get_challans_by_vehicle(reg_number: str) -> dict:
    reg_number = reg_number.upper().replace(" ", "")
    cache_key = f"echallan:{reg_number}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if is_placeholder(settings.ECHALLAN_API_KEY):
        result = {
            "reg_number": reg_number,
            "challans": [
                {
                    "challan_number": "TN39/2025/CH001234",
                    "date": str(date.today() - timedelta(days=30)),
                    "offence": "Over Speeding",
                    "offence_section": "Section 183 MV Act",
                    "amount": 500.00,
                    "fine_amount": 500.00,
                    "status": "PENDING",
                    "location": "Salem-Coimbatore Highway, NH44",
                    "court": "Traffic Court, Coimbatore",
                },
                {
                    "challan_number": "TN39/2025/CH001100",
                    "date": str(date.today() - timedelta(days=90)),
                    "offence": "Overloading",
                    "offence_section": "Section 194 MV Act",
                    "amount": 1000.00,
                    "fine_amount": 1000.00,
                    "status": "PAID",
                    "paid_date": str(date.today() - timedelta(days=85)),
                    "location": "Pollachi Road, Coimbatore",
                    "court": "Traffic Court, Coimbatore",
                },
            ],
            "total_pending": 500.00,
            "total_paid": 1000.00,
            "count": 2,
            "source": "MOCK_DATA",
        }
        await cache_set(cache_key, result, CACHE_TTL)
        return result

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{settings.ECHALLAN_API_URL}/vehicle/{reg_number}",
            headers={"Authorization": f"Bearer {settings.ECHALLAN_API_KEY}"},
        )
        result = resp.json()
        result["source"] = "LIVE"
        await cache_set(cache_key, result, CACHE_TTL)
        return result


async def get_challans_by_dl(dl_number: str) -> dict:
    dl_number = dl_number.upper().replace(" ", "")
    cache_key = f"echallan:dl:{dl_number}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if is_placeholder(settings.ECHALLAN_API_KEY):
        result = {
            "dl_number": dl_number,
            "challans": [
                {
                    "challan_number": "TN39/2025/CH001500",
                    "date": str(date.today() - timedelta(days=45)),
                    "offence": "Signal Jumping",
                    "offence_section": "Section 119/177 MV Act",
                    "amount": 1000.00,
                    "status": "PENDING",
                    "location": "Avinashi Road, Coimbatore",
                },
            ],
            "total_pending": 1000.00,
            "total_paid": 0,
            "count": 1,
            "source": "MOCK_DATA",
        }
        await cache_set(cache_key, result, CACHE_TTL)
        return result

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{settings.ECHALLAN_API_URL}/dl/{dl_number}",
            headers={"Authorization": f"Bearer {settings.ECHALLAN_API_KEY}"},
        )
        result = resp.json()
        result["source"] = "LIVE"
        await cache_set(cache_key, result, CACHE_TTL)
        return result


async def get_challan_payment_status(challan_number: str) -> dict:
    if is_placeholder(settings.ECHALLAN_API_KEY):
        return {
            "challan_number": challan_number,
            "status": "PAID",
            "paid_date": str(date.today() - timedelta(days=5)),
            "paid_amount": 500.00,
            "source": "MOCK_DATA",
        }

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{settings.ECHALLAN_API_URL}/status/{challan_number}",
            headers={"Authorization": f"Bearer {settings.ECHALLAN_API_KEY}"},
        )
        result = resp.json()
        result["source"] = "LIVE"
        return result
