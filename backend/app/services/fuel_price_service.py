# Fuel Price Service — daily diesel / petrol prices by city
import logging
import httpx
from datetime import date
from fastapi import HTTPException
from app.services.cache_service import cache_get, cache_set

logger = logging.getLogger(__name__)
CACHE_TTL = 3600

# Fuel price API endpoint (free tier / scraper needed for production)
FUEL_API_URL = "https://www.goodreturns.in/petrol-price.html"


async def get_fuel_price(city: str = "coimbatore") -> dict:
    city_key = city.lower().strip()
    cache_key = f"fuel:{city_key}:{date.today().isoformat()}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    # No reliable free API for Indian fuel prices — raise error with guidance
    raise HTTPException(
        status_code=503,
        detail=f"Fuel price API not configured. No free API available for Indian fuel prices. "
               f"Configure a fuel price data source or scraper for city: {city}"
    )


async def get_fuel_prices_bulk(cities: list[str] | None = None) -> dict:
    if cities is None:
        cities = ["coimbatore", "chennai", "bangalore", "mumbai", "delhi", "hyderabad", "kolkata", "pune"]
    results = []
    errors = []
    for city in cities:
        try:
            price = await get_fuel_price(city)
            results.append(price)
        except HTTPException:
            errors.append(city)
    if not results and errors:
        raise HTTPException(
            status_code=503,
            detail=f"Fuel price API not configured for any city. Configure a fuel price data source."
        )
    return {"date": date.today().isoformat(), "prices": results, "count": len(results), "source": "LIVE"}
