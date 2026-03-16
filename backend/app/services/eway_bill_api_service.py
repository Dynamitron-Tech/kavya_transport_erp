# E-way Bill Government API Service — generate / cancel / extend
import logging
from datetime import datetime, timedelta

from app.core.config import settings
from app.services.cache_service import is_placeholder, cache_get, cache_set

logger = logging.getLogger(__name__)


async def generate_eway_bill(payload: dict) -> dict:
    """Generate E-way Bill via government portal or return mock."""
    if is_placeholder(settings.EWAY_BILL_USERNAME) or is_placeholder(settings.EWAY_BILL_PASSWORD):
        ewb_number = f"MOCK{datetime.utcnow().strftime('%y%m%d%H%M%S')}0001"
        result = {
            "ewb_number": ewb_number,
            "ewb_date": datetime.utcnow().isoformat(),
            "valid_upto": (datetime.utcnow() + timedelta(days=1)).isoformat(),
            "status": "GENERATED",
            "alert": "This is a mock E-way Bill. Configure EWAY_BILL credentials for live generation.",
            "source": "MOCK_DATA",
        }
        return result

    import httpx
    async with httpx.AsyncClient(timeout=30) as client:
        auth_resp = await client.post(
            f"{settings.EWAY_BILL_API_URL}/dec/v01/auth",
            json={
                "action": "ACCESSTOKEN",
                "username": settings.EWAY_BILL_USERNAME,
                "password": settings.EWAY_BILL_PASSWORD,
                "app_key": settings.EWAY_BILL_GSTIN,
            },
        )
        token = auth_resp.json().get("authtoken")

        resp = await client.post(
            f"{settings.EWAY_BILL_API_URL}/dec/v01/generation",
            headers={"authtoken": token, "gstin": settings.EWAY_BILL_GSTIN},
            json=payload,
        )
        result = resp.json()
        result["source"] = "LIVE"
        return result


async def cancel_eway_bill(ewb_number: str, reason: str, reason_code: int = 1) -> dict:
    if is_placeholder(settings.EWAY_BILL_USERNAME):
        return {
            "ewb_number": ewb_number,
            "cancel_date": datetime.utcnow().isoformat(),
            "status": "CANCELLED",
            "reason": reason,
            "source": "MOCK_DATA",
        }

    import httpx
    async with httpx.AsyncClient(timeout=30) as client:
        auth_resp = await client.post(
            f"{settings.EWAY_BILL_API_URL}/dec/v01/auth",
            json={
                "action": "ACCESSTOKEN",
                "username": settings.EWAY_BILL_USERNAME,
                "password": settings.EWAY_BILL_PASSWORD,
                "app_key": settings.EWAY_BILL_GSTIN,
            },
        )
        token = auth_resp.json().get("authtoken")

        resp = await client.post(
            f"{settings.EWAY_BILL_API_URL}/dec/v01/ewayapi",
            headers={"authtoken": token, "gstin": settings.EWAY_BILL_GSTIN},
            json={
                "ewbNo": ewb_number,
                "cancelRsnCode": reason_code,
                "cancelRmrk": reason,
            },
        )
        result = resp.json()
        result["source"] = "LIVE"
        return result


async def extend_eway_bill(ewb_number: str, vehicle_no: str, remaining_distance: int, reason: str, reason_code: int = 4) -> dict:
    if is_placeholder(settings.EWAY_BILL_USERNAME):
        return {
            "ewb_number": ewb_number,
            "new_valid_upto": (datetime.utcnow() + timedelta(days=1)).isoformat(),
            "vehicle_no": vehicle_no,
            "remaining_distance": remaining_distance,
            "status": "EXTENDED",
            "source": "MOCK_DATA",
        }

    import httpx
    async with httpx.AsyncClient(timeout=30) as client:
        auth_resp = await client.post(
            f"{settings.EWAY_BILL_API_URL}/dec/v01/auth",
            json={
                "action": "ACCESSTOKEN",
                "username": settings.EWAY_BILL_USERNAME,
                "password": settings.EWAY_BILL_PASSWORD,
                "app_key": settings.EWAY_BILL_GSTIN,
            },
        )
        token = auth_resp.json().get("authtoken")

        resp = await client.post(
            f"{settings.EWAY_BILL_API_URL}/dec/v01/ewayapi",
            headers={"authtoken": token, "gstin": settings.EWAY_BILL_GSTIN},
            json={
                "ewbNo": ewb_number,
                "vehicleNo": vehicle_no,
                "remainingDistance": remaining_distance,
                "transDocNo": "",
                "transDocDate": "",
                "transMode": "1",
                "extnRsnCode": reason_code,
                "extnRemarks": reason,
            },
        )
        result = resp.json()
        result["source"] = "LIVE"
        return result


async def get_eway_bill_details(ewb_number: str) -> dict:
    cache_key = f"ewb:{ewb_number}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if is_placeholder(settings.EWAY_BILL_USERNAME):
        result = {
            "ewb_number": ewb_number,
            "ewb_date": (datetime.utcnow() - timedelta(hours=6)).isoformat(),
            "valid_upto": (datetime.utcnow() + timedelta(hours=18)).isoformat(),
            "status": "ACTIVE",
            "from_gstin": "33AABCT1234F1ZN",
            "to_gstin": "29AABCT5678G1Z2",
            "total_value": 125000.00,
            "vehicle_no": "TN39AB1234",
            "transporter_id": settings.EWAY_BILL_GSTIN,
            "source": "MOCK_DATA",
        }
        await cache_set(cache_key, result, 3600)
        return result

    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        auth_resp = await client.post(
            f"{settings.EWAY_BILL_API_URL}/dec/v01/auth",
            json={
                "action": "ACCESSTOKEN",
                "username": settings.EWAY_BILL_USERNAME,
                "password": settings.EWAY_BILL_PASSWORD,
                "app_key": settings.EWAY_BILL_GSTIN,
            },
        )
        token = auth_resp.json().get("authtoken")

        resp = await client.get(
            f"{settings.EWAY_BILL_API_URL}/dec/v01/ewayapi",
            headers={"authtoken": token, "gstin": settings.EWAY_BILL_GSTIN},
            params={"ewbNo": ewb_number},
        )
        result = resp.json()
        result["source"] = "LIVE"
        await cache_set(cache_key, result, 3600)
        return result
