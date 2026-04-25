# Audit Note Service
# Transport ERP — Phase B

import logging
from typing import Optional
from datetime import datetime
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.postgres.audit_note import AuditNote, AuditNoteStatus

logger = logging.getLogger(__name__)


async def list_notes(
    db: AsyncSession,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    status: Optional[str] = None,
    tenant_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
) -> list:
    filters = []
    if resource_type:
        filters.append(AuditNote.resource_type == resource_type)
    if resource_id:
        filters.append(AuditNote.resource_id == resource_id)
    if status:
        try:
            filters.append(AuditNote.status == AuditNoteStatus(status))
        except ValueError:
            pass
    if tenant_id:
        filters.append(AuditNote.tenant_id == tenant_id)

    result = await db.execute(
        select(AuditNote)
        .where(and_(*filters) if filters else True)
        .order_by(AuditNote.created_at.desc())
        .offset(skip).limit(limit)
    )
    return result.scalars().all()


async def create_note(
    db: AsyncSession,
    resource_type: str,
    resource_id: int,
    note_text: str,
    auditor_id: int,
    tenant_id: Optional[int] = None,
    branch_id: Optional[int] = None,
) -> AuditNote:
    note = AuditNote(
        resource_type=resource_type,
        resource_id=resource_id,
        note_text=note_text,
        auditor_id=auditor_id,
        tenant_id=tenant_id,
        branch_id=branch_id,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


async def resolve_note(
    db: AsyncSession,
    note_id: int,
    user_id: int,
) -> Optional[AuditNote]:
    result = await db.execute(select(AuditNote).where(AuditNote.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        return None
    note.status = AuditNoteStatus.RESOLVED
    note.resolved_by = user_id
    note.resolved_at = datetime.utcnow()
    await db.commit()
    await db.refresh(note)
    return note
