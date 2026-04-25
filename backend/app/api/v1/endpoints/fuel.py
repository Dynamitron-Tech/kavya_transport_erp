# Fuel Price Endpoints
from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse
from app.services import fuel_price_service

router = APIRouter()


@router.get("", response_model=APIResponse)
async def get_fuel_price(
    city: str = Query("coimbatore", description="City name"),
    current_user: TokenData = Depends(get_current_user),
):
    """Get current diesel/petrol prices for a city."""
    result = await fuel_price_service.get_fuel_price(city)
    return APIResponse(success=True, data=result, message="Fuel prices fetched")


@router.get("/bulk", response_model=APIResponse)
async def get_fuel_prices_bulk(
    current_user: TokenData = Depends(get_current_user),
):
    """Get fuel prices for all major cities."""
    result = await fuel_price_service.get_fuel_prices_bulk()
    return APIResponse(success=True, data=result, message="Bulk fuel prices fetched")
