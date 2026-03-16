# Maps Service — route distance, geocode, reverse geocode
import logging
import httpx
from fastapi import HTTPException
from app.core.config import settings
from app.services.cache_service import cache_get, cache_set

logger = logging.getLogger(__name__)


async def get_route_distance(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> dict:
    cache_key = f"route:{origin_lat:.4f},{origin_lng:.4f}:{dest_lat:.4f},{dest_lng:.4f}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/distancematrix/json",
                params={
                    "origins": f"{origin_lat},{origin_lng}",
                    "destinations": f"{dest_lat},{dest_lng}",
                    "key": settings.GOOGLE_MAPS_API_KEY,
                    "units": "metric",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            element = data["rows"][0]["elements"][0]
            if element.get("status") != "OK":
                raise HTTPException(status_code=400, detail=f"Google Maps error: {element.get('status')}")
            result = {
                "distance_km": round(element["distance"]["value"] / 1000, 1),
                "duration_hours": round(element["duration"]["value"] / 3600, 1),
                "duration_text": element["duration"]["text"],
                "origin": {"lat": origin_lat, "lng": origin_lng},
                "destination": {"lat": dest_lat, "lng": dest_lng},
                "source": "LIVE",
            }
            await cache_set(cache_key, result, 86400)
            return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Google Maps API timeout. Check GOOGLE_MAPS_API_KEY in .env")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Google Maps API error: {e.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Google Maps API. Check network.")


async def geocode(address: str) -> dict:
    cache_key = f"geo:{address[:80]}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"address": address, "key": settings.GOOGLE_MAPS_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()
            if data["results"]:
                loc = data["results"][0]["geometry"]["location"]
                result = {
                    "lat": loc["lat"], "lng": loc["lng"],
                    "formatted_address": data["results"][0]["formatted_address"],
                    "place_id": data["results"][0]["place_id"],
                    "source": "LIVE",
                }
            else:
                result = {"lat": None, "lng": None, "formatted_address": None, "source": "LIVE"}
            await cache_set(cache_key, result, 86400)
            return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Google Geocode API timeout. Check GOOGLE_MAPS_API_KEY in .env")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Google Geocode error: {e.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Google Geocode API.")


async def reverse_geocode(lat: float, lng: float) -> dict:
    cache_key = f"rgeo:{lat:.4f},{lng:.4f}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"latlng": f"{lat},{lng}", "key": settings.GOOGLE_MAPS_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()
            if data["results"]:
                addr = data["results"][0]
                components = {c["types"][0]: c["long_name"] for c in addr.get("address_components", []) if c.get("types")}
                result = {
                    "lat": lat, "lng": lng,
                    "formatted_address": addr["formatted_address"],
                    "locality": components.get("locality", ""),
                    "state": components.get("administrative_area_level_1", ""),
                    "pincode": components.get("postal_code", ""),
                    "source": "LIVE",
                }
            else:
                result = {"lat": lat, "lng": lng, "formatted_address": None, "source": "LIVE"}
            await cache_set(cache_key, result, 86400)
            return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Google Reverse Geocode API timeout.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Google Reverse Geocode error: {e.response.text[:200]}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Google Geocode API.")
