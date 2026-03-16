# VAHAN Service — Vehicle RC, Insurance, Fitness, Permit, PUC lookups
import logging
from datetime import date, timedelta

from app.core.config import settings
from app.services.cache_service import is_placeholder, cache_get, cache_set

logger = logging.getLogger(__name__)

CACHE_TTL = 86400  # 24 hours


async def lookup_vehicle_by_rc(reg_number: str) -> dict:
    reg_number = reg_number.upper().replace(" ", "")
    cache_key = f"vahan:{reg_number}:rc"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if settings.USE_MOCK_VAHAN or is_placeholder(settings.VAHAN_API_KEY):
        result = {
            "reg_number": reg_number,
            "owner_name": "Kavya Transports Pvt Ltd",
            "father_name": "N/A",
            "vehicle_class": "HGV - Heavy Goods Vehicle",
            "vehicle_category": "Transport",
            "maker_model": "TATA LPT 3718",
            "fuel_type": "DIESEL",
            "color": "WHITE",
            "manufacturing_year": 2022,
            "registration_date": "2022-06-15",
            "chassis_number": "MAT****5432",
            "engine_number": "497****8765",
            "insurance_valid_until": str(date.today() + timedelta(days=180)),
            "fitness_valid_until": str(date.today() + timedelta(days=365)),
            "permit_valid_until": str(date.today() + timedelta(days=90)),
            "puc_valid_until": str(date.today() + timedelta(days=60)),
            "rto": "TN39 - Coimbatore",
            "status": "ACTIVE",
            "blacklisted": False,
            "source": "MOCK_DATA",
        }
        await cache_set(cache_key, result, CACHE_TTL)
        return result

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            settings.VAHAN_API_URL,
            headers={"Authorization": f"Bearer {settings.VAHAN_API_KEY}"},
            json={"reg_number": reg_number},
        )
        result = resp.json()
        result["source"] = "LIVE"
        await cache_set(cache_key, result, CACHE_TTL)
        return result


async def check_insurance(reg_number: str) -> dict:
    reg_number = reg_number.upper().replace(" ", "")
    cache_key = f"vahan:{reg_number}:insurance"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if settings.USE_MOCK_VAHAN or is_placeholder(settings.VAHAN_API_KEY):
        valid_until = date.today() + timedelta(days=180)
        result = {
            "reg_number": reg_number,
            "insurer": "New India Assurance Co Ltd",
            "policy_number": f"NIA/CV/{reg_number}/2025",
            "valid_from": str(date.today() - timedelta(days=185)),
            "valid_until": str(valid_until),
            "days_remaining": 180,
            "is_valid": True,
            "premium_amount": 45000.00,
            "source": "MOCK_DATA",
        }
        await cache_set(cache_key, result, CACHE_TTL)
        return result

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{settings.VAHAN_API_URL}/insurance/{reg_number}",
            headers={"Authorization": f"Bearer {settings.VAHAN_API_KEY}"},
        )
        result = resp.json()
        result["source"] = "LIVE"
        await cache_set(cache_key, result, CACHE_TTL)
        return result


async def check_fitness(reg_number: str) -> dict:
    reg_number = reg_number.upper().replace(" ", "")
    cache_key = f"vahan:{reg_number}:fitness"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if settings.USE_MOCK_VAHAN or is_placeholder(settings.VAHAN_API_KEY):
        valid_until = date.today() + timedelta(days=365)
        result = {
            "reg_number": reg_number,
            "certificate_number": f"FC/{reg_number}/2025",
            "valid_from": str(date.today() - timedelta(days=365)),
            "valid_until": str(valid_until),
            "days_remaining": 365,
            "is_valid": True,
            "authority": "RTO Coimbatore",
            "source": "MOCK_DATA",
        }
        await cache_set(cache_key, result, CACHE_TTL)
        return result

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{settings.VAHAN_API_URL}/fitness/{reg_number}",
            headers={"Authorization": f"Bearer {settings.VAHAN_API_KEY}"},
        )
        result = resp.json()
        result["source"] = "LIVE"
        await cache_set(cache_key, result, CACHE_TTL)
        return result


async def check_permit(reg_number: str) -> dict:
    reg_number = reg_number.upper().replace(" ", "")
    cache_key = f"vahan:{reg_number}:permit"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if settings.USE_MOCK_VAHAN or is_placeholder(settings.VAHAN_API_KEY):
        valid_until = date.today() + timedelta(days=90)
        result = {
            "reg_number": reg_number,
            "permit_number": f"NP/{reg_number}/2025",
            "permit_type": "National Permit",
            "valid_from": str(date.today() - timedelta(days=275)),
            "valid_until": str(valid_until),
            "days_remaining": 90,
            "is_valid": True,
            "issued_by": "RTO Coimbatore",
            "source": "MOCK_DATA",
        }
        await cache_set(cache_key, result, CACHE_TTL)
        return result

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{settings.VAHAN_API_URL}/permit/{reg_number}",
            headers={"Authorization": f"Bearer {settings.VAHAN_API_KEY}"},
        )
        result = resp.json()
        result["source"] = "LIVE"
        await cache_set(cache_key, result, CACHE_TTL)
        return result


async def check_puc(reg_number: str) -> dict:
    reg_number = reg_number.upper().replace(" ", "")
    cache_key = f"vahan:{reg_number}:puc"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if settings.USE_MOCK_VAHAN or is_placeholder(settings.VAHAN_API_KEY):
        valid_until = date.today() + timedelta(days=60)
        result = {
            "reg_number": reg_number,
            "puc_number": f"PUC/{reg_number}/2025",
            "valid_from": str(date.today() - timedelta(days=120)),
            "valid_until": str(valid_until),
            "days_remaining": 60,
            "is_valid": True,
            "testing_station": "Kavya Emissions Test Centre, Coimbatore",
            "source": "MOCK_DATA",
        }
        await cache_set(cache_key, result, CACHE_TTL)
        return result

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{settings.VAHAN_API_URL}/puc/{reg_number}",
            headers={"Authorization": f"Bearer {settings.VAHAN_API_KEY}"},
        )
        result = resp.json()
        result["source"] = "LIVE"
        await cache_set(cache_key, result, CACHE_TTL)
        return result


async def check_blacklist(reg_number: str) -> dict:
    reg_number = reg_number.upper().replace(" ", "")
    if settings.USE_MOCK_VAHAN or is_placeholder(settings.VAHAN_API_KEY):
        return {"reg_number": reg_number, "blacklisted": False, "source": "MOCK_DATA"}

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{settings.VAHAN_API_URL}/blacklist/{reg_number}",
            headers={"Authorization": f"Bearer {settings.VAHAN_API_KEY}"},
        )
        result = resp.json()
        result["source"] = "LIVE"
        return result


async def full_vehicle_check(reg_number: str) -> dict:
    """Run all VAHAN checks in one call."""
    rc = await lookup_vehicle_by_rc(reg_number)
    insurance = await check_insurance(reg_number)
    fitness = await check_fitness(reg_number)
    permit = await check_permit(reg_number)
    puc = await check_puc(reg_number)
    blacklist = await check_blacklist(reg_number)
    return {
        "reg_number": reg_number,
        "rc_details": rc,
        "insurance": insurance,
        "fitness": fitness,
        "permit": permit,
        "puc": puc,
        "blacklist": blacklist,
        "source": rc.get("source", "MOCK_DATA"),
    }
