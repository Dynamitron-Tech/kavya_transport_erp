"""
GPS Provider Registry — Auto-discovers and instantiates active providers.

When an admin activates a provider (sets API key + enables), it becomes
available for the unified polling task automatically. No restart needed.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres.connection import AsyncSessionLocal
from app.models.postgres.gps_provider import GPSProvider

from .base_provider import BaseGPSProvider
from .ialert_provider import IALERTProvider
from .tata_gps_provider import TataGPSProvider
from .third_party_provider import ThirdPartyProvider

logger = logging.getLogger(__name__)

PROVIDER_CLASSES: dict[str, type[BaseGPSProvider]] = {
    "ialert": IALERTProvider,
    "tata_gps": TataGPSProvider,
    "third_party": ThirdPartyProvider,
}


async def get_active_providers(db: AsyncSession | None = None) -> dict[str, BaseGPSProvider]:
    """Return instantiated providers that are enabled AND have an API key."""
    close_db = False
    if db is None:
        db = AsyncSessionLocal()
        close_db = True

    try:
        result = await db.execute(
            select(GPSProvider).where(
                GPSProvider.enabled == True,
                GPSProvider.api_key_encrypted != None,
                GPSProvider.api_key_encrypted != "",
            )
        )
        rows = result.scalars().all()

        active = {}
        for row in rows:
            cls = PROVIDER_CLASSES.get(row.id)
            if cls:
                active[row.id] = cls(
                    api_key=row.api_key_encrypted,  # In production, decrypt here
                    endpoint=row.api_endpoint or "",
                )
        return active
    finally:
        if close_db:
            await db.close()


async def get_all_provider_statuses() -> list[dict]:
    """Get status of all GPS providers (for the UI pills)."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(GPSProvider))
        return [row.to_dict() for row in result.scalars().all()]


async def activate_provider(provider_id: str, api_key: str, endpoint: str) -> dict:
    """Activate a provider when its API key arrives."""
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(GPSProvider)
            .where(GPSProvider.id == provider_id)
            .values(
                api_key_encrypted=api_key,
                api_endpoint=endpoint,
                status="active",
                enabled=True,
                updated_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()

    logger.info("[GPS Registry] Provider %s activated", provider_id)
    return {"provider_id": provider_id, "status": "active"}


async def mark_provider_error(provider_id: str, error: str) -> None:
    """Mark a provider as errored after a failed poll."""
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(GPSProvider)
            .where(GPSProvider.id == provider_id)
            .values(
                last_poll_status="error",
                error_message=error[:500],
                updated_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()


async def mark_provider_success(provider_id: str, count: int) -> None:
    """Mark a provider as successfully polled."""
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(GPSProvider)
            .where(GPSProvider.id == provider_id)
            .values(
                last_poll_at=datetime.now(timezone.utc),
                last_poll_status="ok",
                error_message=None,
                vehicle_count=count,
                status="active",
                updated_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()
