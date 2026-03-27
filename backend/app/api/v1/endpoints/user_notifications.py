# In-app Notification REST Endpoints
# Provides per-user notification feed, unread count, and mark-read operations.
# WebSocket live channel is handled in app/websocket/notifications.py
import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from app.db.postgres.connection import get_db
from app.core.security import TokenData, get_current_user
from app.models.postgres.notification import Notification
from app.schemas.base import APIResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=APIResponse)
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Return notifications for the current user (last `limit` entries)."""
    stmt = (
        select(Notification)
        .where(Notification.target_user_id == current_user.user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))

    result = await db.execute(stmt)
    notifications = result.scalars().all()
    data = [
        {
            "id": n.id,
            "event_type": n.event_type,
            "title": n.title,
            "body": n.body,
            "data": n.data or {},
            "is_read": n.is_read,
            "urgency": n.urgency,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifications
    ]
    return APIResponse(success=True, data=data)


@router.get("/unread-count", response_model=APIResponse)
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Return unread notification count for badge display."""
    result = await db.execute(
        select(func.count()).where(
            Notification.target_user_id == current_user.user_id,
            Notification.is_read.is_(False),
        )
    )
    count = result.scalar() or 0
    return APIResponse(success=True, data={"count": count})


@router.patch("/{notification_id}/read", response_model=APIResponse)
async def mark_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Mark a single notification as read (must belong to current user)."""
    await db.execute(
        update(Notification)
        .where(
            Notification.id == notification_id,
            Notification.target_user_id == current_user.user_id,
        )
        .values(is_read=True)
    )
    await db.commit()
    return APIResponse(success=True, message="Marked as read")


@router.patch("/read-all", response_model=APIResponse)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Mark all notifications as read for the current user."""
    await db.execute(
        update(Notification)
        .where(
            Notification.target_user_id == current_user.user_id,
            Notification.is_read.is_(False),
        )
        .values(is_read=True)
    )
    await db.commit()
    return APIResponse(success=True, message="All notifications marked as read")
