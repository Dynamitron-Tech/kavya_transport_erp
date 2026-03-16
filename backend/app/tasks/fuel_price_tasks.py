# Fuel Price Tasks — periodic refresh
import logging
import asyncio

from app.celery_app import celery_app

logger = logging.getLogger(__name__)

CITIES = ["coimbatore", "chennai", "bangalore", "mumbai", "delhi", "hyderabad", "kolkata", "pune"]


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _refresh():
    from app.services import fuel_price_service
    results = []
    for city in CITIES:
        price = await fuel_price_service.get_fuel_price(city)
        results.append(price)
    logger.info(f"Fuel prices refreshed for {len(results)} cities")
    return results


@celery_app.task(name="app.tasks.fuel_price_tasks.refresh_fuel_prices")
def refresh_fuel_prices():
    """Celery task: Refresh fuel prices for major cities."""
    return _run_async(_refresh())
