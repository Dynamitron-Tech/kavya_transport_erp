# Maps Service — OSRM (driving distance) + Nominatim (geocoding)
# Both are free, no API key required — powered by OpenStreetMap
import logging
import httpx
from fastapi import HTTPException
from app.services.cache_service import cache_get, cache_set

logger = logging.getLogger(__name__)

_NOMINATIM_URL = "https://nominatim.openstreetmap.org"
_OSRM_URL = "https://router.project-osrm.org"
_HEADERS = {"User-Agent": "KavyaTransportERP/1.0"}


async def get_route_distance(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> dict:
    """Calculate driving distance & duration using OSRM (free, no key)."""
    cache_key = f"route:{origin_lat:.4f},{origin_lng:.4f}:{dest_lat:.4f},{dest_lng:.4f}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=15, headers=_HEADERS) as client:
            # OSRM expects lng,lat order (not lat,lng)
            resp = await client.get(
                f"{_OSRM_URL}/route/v1/driving/{origin_lng},{origin_lat};{dest_lng},{dest_lat}",
                params={"overview": "false"},
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") != "Ok" or not data.get("routes"):
                raise HTTPException(status_code=400, detail=f"OSRM error: {data.get('code', 'No route found')}")
            route = data["routes"][0]
            distance_m = route["distance"]     # metres
            duration_s = route["duration"]     # seconds
            hours = duration_s / 3600
            result = {
                "distance_km": round(distance_m / 1000, 1),
                "duration_hours": round(hours, 1),
                "duration_text": f"{int(hours)}h {int((hours % 1) * 60)}m",
                "origin": {"lat": origin_lat, "lng": origin_lng},
                "destination": {"lat": dest_lat, "lng": dest_lng},
                "source": "OSRM",
            }
            await cache_set(cache_key, result, 86400)
            return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="OSRM routing service timeout")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"OSRM error: {e.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to OSRM. Check network.")


async def geocode(address: str) -> dict:
    """Geocode an address to lat/lng using Nominatim (free, no key)."""
    cache_key = f"geo:{address[:80]}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
            resp = await client.get(
                f"{_NOMINATIM_URL}/search",
                params={"q": address, "format": "json", "limit": 1, "countrycodes": "in"},
            )
            resp.raise_for_status()
            data = resp.json()
            if data:
                loc = data[0]
                result = {
                    "lat": float(loc["lat"]),
                    "lng": float(loc["lon"]),
                    "formatted_address": loc.get("display_name", ""),
                    "place_id": str(loc.get("place_id", "")),
                    "source": "NOMINATIM",
                }
            else:
                result = {"lat": None, "lng": None, "formatted_address": None, "source": "NOMINATIM"}
            await cache_set(cache_key, result, 86400)
            return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Nominatim geocoding timeout")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Nominatim error: {e.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Nominatim. Check network.")


async def reverse_geocode(lat: float, lng: float) -> dict:
    """Reverse geocode lat/lng to address using Nominatim (free, no key)."""
    cache_key = f"rgeo:{lat:.4f},{lng:.4f}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
            resp = await client.get(
                f"{_NOMINATIM_URL}/reverse",
                params={"lat": lat, "lon": lng, "format": "json"},
            )
            resp.raise_for_status()
            data = resp.json()
            addr = data.get("address", {})
            result = {
                "lat": lat, "lng": lng,
                "formatted_address": data.get("display_name", ""),
                "locality": addr.get("city") or addr.get("town") or addr.get("village", ""),
                "state": addr.get("state", ""),
                "pincode": addr.get("postcode", ""),
                "source": "NOMINATIM",
            }
            await cache_set(cache_key, result, 86400)
            return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Nominatim reverse geocode timeout")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Nominatim error: {e.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Nominatim. Check network.")
