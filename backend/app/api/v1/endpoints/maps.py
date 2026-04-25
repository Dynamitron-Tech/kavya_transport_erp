# Maps / Route Endpoints
from fastapi import APIRouter, Depends, Query

from app.core.security import TokenData, get_current_user
from app.schemas.base import APIResponse
from app.services import maps_service

router = APIRouter()


@router.get("/distance", response_model=APIResponse)
async def get_city_distance(
    origin: str = Query(..., description="Origin city, e.g. 'Mumbai, Maharashtra'"),
    destination: str = Query(..., description="Destination city, e.g. 'Delhi'"),
    current_user: TokenData = Depends(get_current_user),
):
    """Calculate driving distance between two city names using geocode + distance matrix."""
    origin_geo = await maps_service.geocode(origin)
    dest_geo = await maps_service.geocode(destination)

    if not origin_geo.get("lat") or not dest_geo.get("lat"):
        return APIResponse(success=False, data=None, message="Could not geocode one or both addresses")

    result = await maps_service.get_route_distance(
        origin_geo["lat"], origin_geo["lng"],
        dest_geo["lat"], dest_geo["lng"],
    )
    result["origin_address"] = origin_geo.get("formatted_address", origin)
    result["destination_address"] = dest_geo.get("formatted_address", destination)
    return APIResponse(success=True, data=result, message="Distance calculated")


@router.get("/route", response_model=APIResponse)
async def get_route_distance(
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    dest_lat: float = Query(...),
    dest_lng: float = Query(...),
    current_user: TokenData = Depends(get_current_user),
):
    """Calculate route distance and duration between two points."""
    result = await maps_service.get_route_distance(origin_lat, origin_lng, dest_lat, dest_lng)
    return APIResponse(success=True, data=result, message="Route calculated")


@router.get("/geocode", response_model=APIResponse)
async def geocode_address(
    address: str = Query(..., description="Address to geocode"),
    current_user: TokenData = Depends(get_current_user),
):
    """Geocode an address to lat/lng."""
    result = await maps_service.geocode(address)
    return APIResponse(success=True, data=result, message="Address geocoded")


@router.get("/reverse-geocode", response_model=APIResponse)
async def reverse_geocode(
    lat: float = Query(...),
    lng: float = Query(...),
    current_user: TokenData = Depends(get_current_user),
):
    """Reverse geocode lat/lng to address."""
    result = await maps_service.reverse_geocode(lat, lng)
    return APIResponse(success=True, data=result, message="Reverse geocode completed")
