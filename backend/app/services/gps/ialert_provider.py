"""
iALERT GPS Provider — Ashok Leyland DaaS integration.

Wraps the existing ialert_gps_service as a BaseGPSProvider implementation.
"""

import re
import logging
from datetime import datetime

import httpx

from .base_provider import BaseGPSProvider, GPSPoint

logger = logging.getLogger(__name__)

_RE_NON_ALNUM = re.compile(r"[^A-Z0-9]", re.IGNORECASE)


def _normalise_reg(raw: str) -> str:
    return _RE_NON_ALNUM.sub("", raw).upper()


def _safe_float(val) -> float:
    try:
        return float(val) if val is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


class IALERTProvider(BaseGPSProvider):
    """Ashok Leyland iALERT Data-as-a-Service GPS provider."""

    provider_id = "ialert"

    async def fetch_all_positions(self) -> list[GPSPoint]:
        if not self.api_key:
            return []

        url = f"{self.endpoint}?token={self.api_key}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
        except httpx.TimeoutException:
            logger.error("[iALERT] API timeout")
            return []
        except httpx.HTTPStatusError as exc:
            logger.error("[iALERT] HTTP %s", exc.response.status_code)
            return []
        except Exception as exc:
            logger.error("[iALERT] Error: %s", exc)
            return []

        if isinstance(data, dict):
            data = [data]
        if not isinstance(data, list):
            return []

        points = []
        for pkt in data:
            try:
                points.append(self.normalize(pkt))
            except Exception as exc:
                logger.warning("[iALERT] Bad packet: %s", exc)
        return points

    def normalize(self, raw: dict) -> GPSPoint:
        raw_reg = str(raw.get("vehicleregnumber", ""))
        reg = _normalise_reg(raw_reg)
        if not reg:
            raise ValueError("Missing vehicleregnumber")

        dt_raw = raw.get("datetime") or raw.get("timestamplocal") or ""
        if dt_raw.endswith(".0"):
            dt_raw = dt_raw[:-2]
        try:
            timestamp = datetime.strptime(dt_raw, "%Y-%m-%d %H:%M:%S")
        except (ValueError, TypeError):
            timestamp = datetime.utcnow()

        ignition = int(raw.get("ignition", raw.get("ignitionstatus", 0))) == 1
        speed = _safe_float(raw.get("speed") or raw.get("gpsspeed"))

        pt = GPSPoint(
            registration_number=reg,
            provider="ialert",
            lat=_safe_float(raw.get("latitude")),
            lng=_safe_float(raw.get("longitude")),
            altitude=_safe_float(raw.get("altitude")),
            speed=speed,
            heading=_safe_float(raw.get("heading")),
            odometer=_safe_float(raw.get("odometer") or raw.get("odometerreading")),
            ignition_on=ignition,
            engine_on=ignition,
            battery_voltage=_safe_float(raw.get("batlevel") or raw.get("vehiclebatterypotential")),
            timestamp=timestamp,
            raw=raw,
        )
        pt.status = pt.derive_status()
        return pt
