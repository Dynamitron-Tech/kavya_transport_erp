"""
Unified GPS Polling Tasks — Replaces per-provider Celery tasks.

Polls ALL active GPS providers through the provider registry abstraction.
"""

import asyncio
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    name="gps.poll_all_providers",
    bind=True,
    max_retries=2,
    soft_time_limit=45,
    acks_late=True,
)
def poll_all_providers(self):
    """
    Poll all active GPS providers (iALERT, Tata, third-party).
    Runs on Celery beat schedule (default every 60s).
    """
    try:
        result = asyncio.run(_poll_all())
        return result
    except Exception as exc:
        logger.error("[GPS Poll] Failed: %s", exc)
        raise self.retry(exc=exc, countdown=30)


async def _poll_all():
    from app.services.gps.provider_registry import (
        get_active_providers,
        mark_provider_error,
        mark_provider_success,
    )
    from app.services.gps.ingest import ingest_gps_points

    providers = await get_active_providers()
    if not providers:
        return {"status": "no_active_providers"}

    results = {}
    for pid, provider in providers.items():
        try:
            points = await provider.fetch_all_positions()
            summary = await ingest_gps_points(points, pid)
            await mark_provider_success(pid, summary["updated"])
            results[pid] = summary
        except Exception as e:
            logger.error("[GPS Poll][%s] Error: %s", pid, e)
            await mark_provider_error(pid, str(e))
            results[pid] = {"error": str(e)}

    return results


@shared_task(name="gps.poll_single_provider")
def poll_single_provider(provider_id: str):
    """Poll a single provider — called when a provider is freshly activated."""
    try:
        result = asyncio.run(_poll_single(provider_id))
        return result
    except Exception as exc:
        logger.error("[GPS Poll][%s] Single poll failed: %s", provider_id, exc)


async def _poll_single(provider_id: str):
    from app.services.gps.provider_registry import (
        get_active_providers,
        mark_provider_error,
        mark_provider_success,
    )
    from app.services.gps.ingest import ingest_gps_points

    providers = await get_active_providers()
    provider = providers.get(provider_id)
    if not provider:
        return {"error": f"Provider {provider_id} not active"}

    try:
        points = await provider.fetch_all_positions()
        summary = await ingest_gps_points(points, provider_id)
        await mark_provider_success(provider_id, summary["updated"])
        return summary
    except Exception as e:
        await mark_provider_error(provider_id, str(e))
        return {"error": str(e)}


@shared_task(name="gps.check_provider_health")
def check_provider_health():
    """Periodic health check for all providers (runs every 5 min)."""
    asyncio.run(_check_health())


async def _check_health():
    from app.services.gps.provider_registry import get_all_provider_statuses
    statuses = await get_all_provider_statuses()
    for p in statuses:
        if p["enabled"] and p["status"] == "error":
            logger.warning("[GPS Health] Provider %s is in error state: %s",
                          p["id"], p.get("error_message", "unknown"))
