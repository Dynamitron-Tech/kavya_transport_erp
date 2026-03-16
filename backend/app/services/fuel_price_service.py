# Fuel Price Service — daily diesel / petrol prices by city
import logging
from datetime import date
from app.services.cache_service import cache_get, cache_set

logger = logging.getLogger(__name__)

CACHE_TTL = 3600  # 1 hour — prices update once a day

# Default mock prices per major city (INR/litre, Jun 2025 approx)
MOCK_PRICES = {
    "coimbatore": {"diesel": 89.62, "petrol": 102.85},
    "chennai": {"diesel": 92.43, "petrol": 105.00},
    "bangalore": {"diesel": 88.93, "petrol": 101.94},
    "mumbai": {"diesel": 94.27, "petrol": 106.31},
    "delhi": {"diesel": 87.62, "petrol": 96.72},
    "hyderabad": {"diesel": 92.70, "petrol": 109.66},
    "kolkata": {"diesel": 90.76, "petrol": 104.95},
    "pune": {"diesel": 90.44, "petrol": 104.86},
    "default": {"diesel": 89.62, "petrol": 102.85},
}


async def get_fuel_price(city: str = "coimbatore") -> dict:
    city_key = city.lower().strip()
    cache_key = f"fuel:{city_key}:{date.today().isoformat()}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    prices = MOCK_PRICES.get(city_key, MOCK_PRICES["default"])
    result = {
        "city": city.title(),
        "date": date.today().isoformat(),
        "diesel_price": prices["diesel"],
        "petrol_price": prices["petrol"],
        "unit": "INR/litre",
        "source": "MOCK_DATA",
    }

    # Attempt live scraping if available (would need a reliable API / scraper)
    # For now we always return mock since there's no official free API
    await cache_set(cache_key, result, CACHE_TTL)
    return result


async def get_fuel_prices_bulk(cities: list[str] | None = None) -> dict:
    if cities is None:
        cities = list(MOCK_PRICES.keys())
        cities = [c for c in cities if c != "default"]

    results = []
    for city in cities:
        price = await get_fuel_price(city)
        results.append(price)

    return {
        "date": date.today().isoformat(),
        "prices": results,
        "count": len(results),
        "source": "MOCK_DATA",
    }
