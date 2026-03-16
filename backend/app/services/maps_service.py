# Maps Service — route distance, geocode, reverse geocode
import logging, math
from app.core.config import settings
from app.services.cache_service import is_placeholder, cache_get, cache_set

logger = logging.getLogger(__name__)


async def get_route_distance(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> dict:
    cache_key = f"route:{origin_lat:.4f},{origin_lng:.4f}:{dest_lat:.4f},{dest_lng:.4f}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if is_placeholder(settings.GOOGLE_MAPS_API_KEY):
        # Haversine approximation
        R = 6371  # km
        lat1, lat2 = math.radians(origin_lat), math.radians(dest_lat)
        dlat = math.radians(dest_lat - origin_lat)
        dlng = math.radians(dest_lng - origin_lng)
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        straight_line = R * c
        road_distance = round(straight_line * 1.3, 1)  # ~30% factor for road
        hours = round(road_distance / 50, 1)  # ~50 km/h average
        result = {
            "distance_km": road_distance,
            "duration_hours": hours,
            "duration_text": f"{int(hours)}h {int((hours % 1) * 60)}m",
            "origin": {"lat": origin_lat, "lng": origin_lng},
            "destination": {"lat": dest_lat, "lng": dest_lng},
            "source": "MOCK_DATA",
        }
        await cache_set(cache_key, result, 86400)
        return result

    import httpx
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
        data = resp.json()
        element = data["rows"][0]["elements"][0]
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


async def geocode(address: str) -> dict:
    cache_key = f"geo:{address[:80]}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if is_placeholder(settings.GOOGLE_MAPS_API_KEY):
        result = {
            "lat": 11.0168,
            "lng": 76.9558,
            "formatted_address": f"{address} (near Coimbatore, Tamil Nadu)",
            "place_id": "MOCK_PLACE_ID",
            "source": "MOCK_DATA",
        }
        await cache_set(cache_key, result, 86400)
        return result

    import httpx
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": address, "key": settings.GOOGLE_MAPS_API_KEY},
        )
        data = resp.json()
        if data["results"]:
            loc = data["results"][0]["geometry"]["location"]
            result = {
                "lat": loc["lat"],
                "lng": loc["lng"],
                "formatted_address": data["results"][0]["formatted_address"],
                "place_id": data["results"][0]["place_id"],
                "source": "LIVE",
            }
        else:
            result = {"lat": None, "lng": None, "formatted_address": None, "source": "LIVE"}
        await cache_set(cache_key, result, 86400)
        return result


async def reverse_geocode(lat: float, lng: float) -> dict:
    cache_key = f"rgeo:{lat:.4f},{lng:.4f}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if is_placeholder(settings.GOOGLE_MAPS_API_KEY):
        result = {
            "lat": lat,
            "lng": lng,
            "formatted_address": "Avinashi Road, Coimbatore, Tamil Nadu 641018",
            "locality": "Coimbatore",
            "state": "Tamil Nadu",
            "pincode": "641018",
            "source": "MOCK_DATA",
        }
        await cache_set(cache_key, result, 86400)
        return result

    import httpx
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"latlng": f"{lat},{lng}", "key": settings.GOOGLE_MAPS_API_KEY},
        )
        data = resp.json()
        if data["results"]:
            addr = data["results"][0]
            components = {c["types"][0]: c["long_name"] for c in addr.get("address_components", []) if c.get("types")}
            result = {
                "lat": lat,
                "lng": lng,
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
