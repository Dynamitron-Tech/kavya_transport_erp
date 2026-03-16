# Redis Cache Helper
import logging
from typing import Optional
import json

logger = logging.getLogger(__name__)

_redis_client = None


async def get_redis():
    """Get async Redis client (lazy singleton)."""
    global _redis_client
    if _redis_client is None:
        try:
            from redis.asyncio import Redis
            from app.core.config import settings
            _redis_client = Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                db=settings.REDIS_DB,
                decode_responses=True,
            )
            await _redis_client.ping()
        except Exception as e:
            logger.warning(f"Redis not available: {e}")
            _redis_client = None
    return _redis_client


async def cache_get(key: str) -> Optional[dict]:
    """Get cached JSON value by key."""
    redis = await get_redis()
    if not redis:
        return None
    try:
        val = await redis.get(key)
        if val:
            return json.loads(val)
    except Exception:
        pass
    return None


async def cache_set(key: str, value: dict, ttl: int = 86400):
    """Set cached JSON value with TTL in seconds."""
    redis = await get_redis()
    if not redis:
        return
    try:
        await redis.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception:
        pass
