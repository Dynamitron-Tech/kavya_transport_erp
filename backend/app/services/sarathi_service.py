# Sarathi Service — Driving Licence verification
import logging
from datetime import date, timedelta

from app.core.config import settings
from app.services.cache_service import is_placeholder, cache_get, cache_set

logger = logging.getLogger(__name__)


async def verify_driving_licence(dl_number: str, dob: str = "") -> dict:
    dl_number = dl_number.upper().replace(" ", "")
    cache_key = f"sarathi:{dl_number}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if is_placeholder(settings.SARATHI_API_KEY):
        result = {
            "dl_number": dl_number,
            "name": "Rajesh Kumar",
            "father_name": "Shanmugam K",
            "dob": dob or "1990-05-15",
            "blood_group": "O+",
            "address": "123, Gandhipuram, Coimbatore, Tamil Nadu - 641012",
            "issue_date": "2015-03-20",
            "valid_until": str(date.today() + timedelta(days=730)),
            "cov_details": [
                {"cov": "HMV", "issue_date": "2015-03-20", "valid_until": str(date.today() + timedelta(days=730))},
                {"cov": "LMV", "issue_date": "2012-06-10", "valid_until": str(date.today() + timedelta(days=730))},
            ],
            "is_valid": True,
            "days_remaining": 730,
            "rto": "RTO Coimbatore",
            "status": "ACTIVE",
            "source": "MOCK_DATA",
        }
        await cache_set(cache_key, result, 86400)
        return result

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"https://sarathi.parivahan.gov.in/api/dl/verify",
            headers={"Authorization": f"Bearer {settings.SARATHI_API_KEY}"},
            json={"dl_number": dl_number, "dob": dob},
        )
        result = resp.json()
        result["source"] = "LIVE"
        await cache_set(cache_key, result, 86400)
        return result


async def get_dl_details(dl_number: str) -> dict:
    return await verify_driving_licence(dl_number)
