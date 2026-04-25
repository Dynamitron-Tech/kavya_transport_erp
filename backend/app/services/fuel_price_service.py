# Fuel Price Service — daily diesel / petrol prices by city
import logging
from datetime import date
from app.services.cache_service import cache_get, cache_set

logger = logging.getLogger(__name__)
CACHE_TTL = 3600

# Fuel price API endpoint (free tier / scraper needed for production)
FUEL_API_URL = "https://www.goodreturns.in/petrol-price.html"

# Fallback values keep the module usable in local/dev without third-party scraping.
FALLBACK_PRICES = {
    "coimbatore": {"diesel_price": 93.21, "petrol_price": 100.42},
    "chennai": {"diesel_price": 94.26, "petrol_price": 101.45},
    "bangalore": {"diesel_price": 89.72, "petrol_price": 99.84},
    "mumbai": {"diesel_price": 94.27, "petrol_price": 104.21},
    "delhi": {"diesel_price": 89.62, "petrol_price": 96.72},
    "hyderabad": {"diesel_price": 97.72, "petrol_price": 109.66},
    "kolkata": {"diesel_price": 92.76, "petrol_price": 106.03},
    "pune": {"diesel_price": 92.74, "petrol_price": 104.05},
}


def _fallback_payload(city_key: str) -> dict:
    selected = FALLBACK_PRICES.get(city_key, FALLBACK_PRICES["coimbatore"])
    return {
        "city": city_key,
        "diesel_price": selected["diesel_price"],
        "petrol_price": selected["petrol_price"],
        "unit": "INR/L",
        "date": date.today().isoformat(),
        "source": "FALLBACK",
        "api_configured": False,
    }


async def get_fuel_price(city: str = "coimbatore") -> dict:
    city_key = city.lower().strip()
    cache_key = f"fuel:{city_key}:{date.today().isoformat()}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    payload = _fallback_payload(city_key)
    await cache_set(cache_key, payload, ttl=CACHE_TTL)
    logger.info("Fuel API not configured, returning fallback data", extra={"city": city_key})
    return payload


async def get_fuel_prices_bulk(cities: list[str] | None = None) -> dict:
    if cities is None:
        cities = ["coimbatore", "chennai", "bangalore", "mumbai", "delhi", "hyderabad", "kolkata", "pune"]
    results = []
    for city in cities:
        price = await get_fuel_price(city)
        results.append(price)
    return {"date": date.today().isoformat(), "prices": results, "count": len(results), "source": "FALLBACK"}
