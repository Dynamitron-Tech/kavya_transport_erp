# Token Blacklisting Service — Redis-backed JWT revocation
# Phase 1 Fix 1: Stolen/leaked tokens are revoked on logout

import logging
from datetime import datetime, timezone

import redis

from app.core.config import settings

logger = logging.getLogger(__name__)

# Use DB 1 for token blacklist (DB 0 is used for Celery/cache)
_redis: redis.Redis | None = None


def _get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD or None,
            db=1,
            decode_responses=True,
            socket_connect_timeout=3,
        )
    return _redis


def blacklist_token(jti: str, expires_at: datetime) -> None:
    """Add a JWT ID to the blacklist. Auto-expires when the token would have expired."""
    try:
        now = datetime.now(timezone.utc)
        exp_utc = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
        ttl_seconds = int((exp_utc - now).total_seconds())
        if ttl_seconds > 0:
            _get_redis().setex(f"blacklist:{jti}", ttl_seconds, "1")
    except Exception as e:
        logger.error(f"Failed to blacklist token {jti}: {e}")


def is_token_blacklisted(jti: str) -> bool:
    """Check whether a token has been revoked."""
    try:
        return _get_redis().exists(f"blacklist:{jti}") == 1
    except Exception as e:
        logger.error(f"Redis blacklist check failed: {e}")
        # Fail closed — if Redis is down, reject the token for safety
        return True


def force_logout_user(user_id: int) -> None:
    """Store a forced-logout timestamp so all tokens issued before this moment are invalid."""
    try:
        _get_redis().set(
            f"force_logout:{user_id}",
            datetime.now(timezone.utc).isoformat(),
        )
    except Exception as e:
        logger.error(f"Failed to set force_logout for user {user_id}: {e}")


def get_forced_logout_at(user_id: int) -> datetime | None:
    """Return the forced-logout timestamp, or None if not set."""
    try:
        val = _get_redis().get(f"force_logout:{user_id}")
        if val:
            return datetime.fromisoformat(val)
    except Exception as e:
        logger.error(f"Failed to read force_logout for user {user_id}: {e}")
    return None
