"""
Tata Motors GPS Provider — CVBU Fleet Telematics.

STUB: API key is pending from OEM. This provider is ready to activate
once the key arrives. The normalize() method uses common Tata CVBU
field names — will be adjusted when we get their API documentation.
"""

import logging
from datetime import datetime

import httpx

from .base_provider import BaseGPSProvider, GPSPoint

logger = logging.getLogger(__name__)


class TataGPSProvider(BaseGPSProvider):
    """Tata Motors CVBU Fleet Telematics GPS provider."""

    provider_id = "tata_gps"

    async def fetch_all_positions(self) -> list[GPSPoint]:
        if not self.api_key:
            return []

        try:
            token = await self._get_bearer_token()
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(
                    f"{self.endpoint}/vehicles/positions",
                    headers={"Authorization": f"Bearer {token}"},
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.error("[Tata GPS] Error: %s", exc)
            return []

        vehicles = data.get("vehicles", data) if isinstance(data, dict) else data
        if not isinstance(vehicles, list):
            return []

        points = []
        for pkt in vehicles:
            try:
                points.append(self.normalize(pkt))
            except Exception as exc:
                logger.warning("[Tata GPS] Bad packet: %s", exc)
        return points

    def normalize(self, raw: dict) -> GPSPoint:
        reg = str(raw.get("registrationNumber") or raw.get("reg") or raw.get("vehicleNo") or "")
        reg = reg.replace("-", "").replace(" ", "").upper()
        if not reg:
            raise ValueError("Missing registration number")

        ignition = str(raw.get("ignitionStatus", "OFF")).upper() == "ON"
        speed = float(raw.get("speed", 0))

        ts_raw = raw.get("timestamp") or raw.get("gpsTime") or ""
        try:
            timestamp = datetime.fromisoformat(ts_raw) if ts_raw else datetime.utcnow()
        except (ValueError, TypeError):
            timestamp = datetime.utcnow()

        pt = GPSPoint(
            registration_number=reg,
            provider="tata_gps",
            lat=float(raw.get("latitude", 0)),
            lng=float(raw.get("longitude", 0)),
            speed=speed,
            heading=float(raw.get("heading", 0)),
            odometer=float(raw.get("odometer", 0)),
            ignition_on=ignition,
            engine_on=ignition,
            fuel_level=raw.get("fuelLevel"),
            battery_voltage=float(raw.get("batteryVoltage", 0)),
            timestamp=timestamp,
            raw=raw,
        )
        pt.status = pt.derive_status()
        return pt

    async def _get_bearer_token(self) -> str:
        """Exchange API key for Bearer token (Tata CVBU auth pattern)."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f"{self.endpoint}/auth/token",
                json={"apiKey": self.api_key},
            )
            r.raise_for_status()
            return r.json()["accessToken"]
