"""
Base GPS Provider — Abstract interface for all GPS data providers.

Each provider (iALERT, Tata, third-party) must implement this interface.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class GPSPoint:
    """Normalised GPS position from any provider."""
    vehicle_id: Optional[int] = None           # DB vehicle ID (filled during ingest)
    registration_number: str = ""
    provider: str = ""                         # ialert / tata_gps / third_party
    lat: float = 0.0
    lng: float = 0.0
    speed: float = 0.0                         # km/h
    heading: float = 0.0                       # degrees
    altitude: float = 0.0
    engine_on: bool = False
    ignition_on: bool = False
    fuel_level: Optional[float] = None         # percent
    odometer: float = 0.0                      # km
    battery_voltage: float = 0.0
    engine_temp: Optional[float] = None
    status: str = "offline"                    # moving/idle/stopped/offline
    timestamp: Optional[datetime] = None
    raw: dict = field(default_factory=dict)    # original payload for debug

    def derive_status(self) -> str:
        """Derive status from telemetry data."""
        if not self.ignition_on and not self.engine_on:
            return "stopped"
        if self.speed > 3:
            return "moving"
        if self.ignition_on or self.engine_on:
            return "idle"
        return "stopped"


class BaseGPSProvider(ABC):
    """Abstract GPS provider interface."""

    provider_id: str = ""

    def __init__(self, api_key: str, endpoint: str):
        self.api_key = api_key
        self.endpoint = endpoint

    @abstractmethod
    async def fetch_all_positions(self) -> list[GPSPoint]:
        """Fetch current position of all vehicles from this provider."""
        ...

    @abstractmethod
    def normalize(self, raw: dict) -> GPSPoint:
        """Convert provider-specific payload to GPSPoint."""
        ...

    async def close(self):
        """Cleanup resources if needed."""
        pass
