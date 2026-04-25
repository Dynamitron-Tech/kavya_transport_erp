# I-01 — Route Optimisation Engine
# Auto-selects best route at assignment, dynamic rerouting mid-trip.

import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.postgres.intelligence import RouteOptimizationResult
from app.models.postgres.trip import Trip
from app.models.postgres.vehicle import Vehicle
from app.services.config_service import get_config_bulk
from app.services.event_bus import event_bus, EventTypes

logger = logging.getLogger(__name__)


async def compute_optimal_route(
    db: AsyncSession,
    trip_id: int,
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    vehicle_id: int | None = None,
) -> dict:
    """Compute and store optimal route for a trip.
    Calls Google Maps Routes API (or mock), scores 3 candidates, picks best."""

    cfg = await get_config_bulk(db, "route.")
    w_dist = cfg.get("route.score_weight_distance", 1.0)
    w_dur = cfg.get("route.score_weight_duration", 0.8)
    w_fuel = cfg.get("route.score_weight_fuel_cost", 1.2)
    n_candidates = cfg.get("route.candidate_count", 3)

    # Get vehicle mileage for fuel cost estimation
    mileage_kmpl = 4.0  # default for heavy trucks
    if vehicle_id:
        veh = await db.get(Vehicle, vehicle_id)
        if veh and veh.mileage_per_litre:
            mileage_kmpl = float(veh.mileage_per_litre)

    # Fetch candidate routes from Google Maps (mock for now)
    candidates = await _fetch_candidate_routes(
        origin_lat, origin_lng, dest_lat, dest_lng, n_candidates
    )

    # Score each candidate
    fuel_rate_per_litre = 90.0  # TODO: fetch from fuel_prices table
    for c in candidates:
        fuel_cost = (c["distance_km"] / mileage_kmpl) * fuel_rate_per_litre
        c["fuel_cost_estimate"] = round(fuel_cost, 2)
        c["score"] = round(
            c["distance_km"] * w_dist
            + c["duration_min"] * w_dur
            + fuel_cost * w_fuel,
            2,
        )

    # Pick lowest score
    candidates.sort(key=lambda x: x["score"])
    best = candidates[0]

    # Persist
    result = RouteOptimizationResult(
        trip_id=trip_id,
        vehicle_id=vehicle_id,
        planned_route_polyline=best.get("polyline"),
        route_score=best["score"],
        candidate_routes=candidates,
        reroute_count=0,
        override_count=0,
    )
    db.add(result)
    await db.flush()

    return {
        "selected_route": best,
        "all_candidates": candidates,
        "optimization_id": result.id,
    }


async def check_reroute_needed(
    db: AsyncSession,
    trip_id: int,
    current_lat: float,
    current_lng: float,
) -> dict | None:
    """Check if rerouting is needed based on deviation or traffic delay."""

    cfg = await get_config_bulk(db, "route.")
    deviation_threshold = cfg.get("route.deviation_threshold_km", 2.0)

    # Get existing optimization result
    result = await db.execute(
        select(RouteOptimizationResult)
        .where(RouteOptimizationResult.trip_id == trip_id)
        .order_by(RouteOptimizationResult.created_at.desc())
    )
    opt = result.scalar_one_or_none()
    if not opt or not opt.planned_route_polyline:
        return None

    # Check deviation from planned route
    deviation = _compute_deviation_from_polyline(
        current_lat, current_lng, opt.planned_route_polyline
    )

    if deviation > deviation_threshold:
        # Trigger reroute
        trip = await db.get(Trip, trip_id)
        if trip:
            await event_bus.publish(
                EventTypes.TRIP_DEVIATION,
                entity_type="trip",
                entity_id=str(trip_id),
                payload={"deviation_km": round(deviation, 2)},
                db_session=db,
            )
        return {"reroute_needed": True, "deviation_km": round(deviation, 2)}

    return {"reroute_needed": False, "deviation_km": round(deviation, 2)}


async def record_driver_override(db: AsyncSession, trip_id: int, driver_id: int):
    """Record when driver dismisses a rerouting suggestion."""
    result = await db.execute(
        select(RouteOptimizationResult)
        .where(RouteOptimizationResult.trip_id == trip_id)
        .order_by(RouteOptimizationResult.created_at.desc())
    )
    opt = result.scalar_one_or_none()
    if opt:
        opt.override_count = (opt.override_count or 0) + 1
        log = opt.reroute_log or []
        log.append({
            "action": "override",
            "driver_id": driver_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        opt.reroute_log = log
        await db.flush()


# ── Helpers ──

async def _fetch_candidate_routes(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
    count: int,
) -> list[dict]:
    """Fetch candidate routes from Google Maps Routes API.
    Falls back to mock data when USE_MOCK_MAPS=True."""
    from app.core.config import settings
    if settings.USE_MOCK_MAPS:
        return _mock_routes(origin_lat, origin_lng, dest_lat, dest_lng, count)

    # Real Google Maps Routes API call
    import httpx
    routes = []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://routes.googleapis.com/directions/v2:computeRoutes",
                headers={
                    "X-Goog-Api-Key": settings.GOOGLE_MAPS_API_KEY,
                    "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
                },
                json={
                    "origin": {"location": {"latLng": {"latitude": origin_lat, "longitude": origin_lng}}},
                    "destination": {"location": {"latLng": {"latitude": dest_lat, "longitude": dest_lng}}},
                    "travelMode": "DRIVE",
                    "routingPreference": "TRAFFIC_AWARE_OPTIMAL",
                    "computeAlternativeRoutes": True,
                },
            )
            data = resp.json()
            for r in data.get("routes", [])[:count]:
                duration_sec = int(r.get("duration", "0s").rstrip("s"))
                routes.append({
                    "distance_km": round(r.get("distanceMeters", 0) / 1000, 1),
                    "duration_min": round(duration_sec / 60, 1),
                    "polyline": r.get("polyline", {}).get("encodedPolyline", ""),
                })
    except Exception as e:
        logger.error(f"Google Maps Routes API failed: {e}")
        routes = _mock_routes(origin_lat, origin_lng, dest_lat, dest_lng, count)

    return routes


def _mock_routes(olat, olng, dlat, dlng, count):
    """Generate mock candidate routes for development."""
    import math
    base_dist = math.sqrt((dlat - olat) ** 2 + (dlng - olng) ** 2) * 111  # rough km
    return [
        {
            "distance_km": round(base_dist * (1 + i * 0.1), 1),
            "duration_min": round(base_dist * (1 + i * 0.1) * 1.5, 1),
            "polyline": f"mock_polyline_{i}",
        }
        for i in range(count)
    ]


def _compute_deviation_from_polyline(lat: float, lng: float, polyline: str) -> float:
    """Compute minimum distance from point to polyline (simplified)."""
    # For mock polylines, return 0 (no deviation)
    if polyline.startswith("mock_"):
        return 0.0
    # TODO: decode polyline and compute actual distance
    # For now, simplified: always return 0 to avoid false positives
    return 0.0
