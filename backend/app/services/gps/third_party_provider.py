"""
Third-party GPS Provider — Generic stub.

STUB: API key is pending. The normalize() method uses common field name
fallbacks. Will be adapted once the provider shares their API schema.
"""

import logging
from datetime import datetime

import httpx

from .base_provider import BaseGPSProvider, GPSPoint

logger = logging.getLogger(__name__)


class ThirdPartyProvider(BaseGPSProvider):
    """Third-party GPS provider (generic REST adapter)."""

    provider_id = "third_party"

    async def fetch_all_positions(self) -> list[GPSPoint]:
        if not self.api_key:
            return []

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(
                    f"{self.endpoint}/fleet/live",
                    headers={"X-API-Key": self.api_key},
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.error("[ThirdParty GPS] Error: %s", exc)
            return []

        items = data.get("data", data) if isinstance(data, dict) else data
        if not isinstance(items, list):
            return []

        points = []
        for pkt in items:
            try:
                points.append(self.normalize(pkt))
            except Exception as exc:
                logger.warning("[ThirdParty GPS] Bad packet: %s", exc)
        return points

    def normalize(self, raw: dict) -> GPSPoint:
        reg = str(raw.get("regNo") or raw.get("vehicle_number") or raw.get("name") or "")
        reg = reg.replace("-", "").replace(" ", "").upper()
        if not reg:
            raise ValueError("Missing registration number")

        ignition = bool(raw.get("ignition") or raw.get("engine_on"))
        speed = float(raw.get("speed", 0))

        ts_raw = raw.get("timestamp") or raw.get("dt") or raw.get("time") or ""
        try:
            timestamp = datetime.fromisoformat(ts_raw) if ts_raw else datetime.utcnow()
        except (ValueError, TypeError):
            timestamp = datetime.utcnow()

        pt = GPSPoint(
            registration_number=reg,
            provider="third_party",
            lat=float(raw.get("lat") or raw.get("latitude") or raw.get("y") or 0),
            lng=float(raw.get("lng") or raw.get("longitude") or raw.get("x") or 0),
            speed=speed,
            heading=float(raw.get("bearing") or raw.get("course") or 0),
            odometer=float(raw.get("odometer", 0)),
            ignition_on=ignition,
            engine_on=ignition,
            fuel_level=raw.get("fuel") or raw.get("fuel_level"),
            battery_voltage=float(raw.get("battery", 0)),
            timestamp=timestamp,
            raw=raw,
        )
        pt.status = pt.derive_status()
        return pt
