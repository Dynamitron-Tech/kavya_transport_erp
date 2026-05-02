# Branch Isolation Middleware
# Transport ERP — Phase E: Multi-Branch
#
# Provides FastAPI dependencies that auto-filter queries by branch_id.
# Admin role bypasses branch filtering and sees all branches.

from typing import Optional
from fastapi import Depends, HTTPException
from sqlalchemy import Select

from app.core.security import get_current_user, TokenData


class BranchContext:
    """Carries branch filtering info extracted from the JWT token."""

    def __init__(self, branch_id: Optional[int], tenant_id: Optional[int], is_admin: bool):
        self.branch_id = branch_id
        self.tenant_id = tenant_id
        self.is_admin = is_admin

    @property
    def should_filter(self) -> bool:
        """Admin users see all branches; others are scoped to their branch."""
        return not self.is_admin and self.branch_id is not None

    def apply(self, query: Select, model) -> Select:
        """Apply branch filter to a SQLAlchemy select() if needed.
        
        Usage:
            query = select(Client).where(Client.is_deleted == False)
            query = branch_ctx.apply(query, Client)
        """
        if self.should_filter and hasattr(model, "branch_id"):
            query = query.where(model.branch_id == self.branch_id)
        return query

    def apply_tenant(self, query: Select, model) -> Select:
        """Apply tenant filter (always, even for admin)."""
        if self.tenant_id is not None and hasattr(model, "tenant_id"):
            query = query.where(model.tenant_id == self.tenant_id)
        return query


def get_branch_context(
    current_user: TokenData = Depends(get_current_user),
) -> BranchContext:
    """FastAPI dependency — extracts branch context from JWT token."""
    is_admin = "admin" in (current_user.roles or [])
    return BranchContext(
        branch_id=current_user.branch_id,
        tenant_id=current_user.tenant_id,
        is_admin=is_admin,
    )


def require_branch_admin(
    current_user: TokenData = Depends(get_current_user),
) -> TokenData:
    """Dependency — only admin can access cross-branch management."""
    if "admin" not in (current_user.roles or []):
        raise HTTPException(status_code=403, detail="Admin access required for branch management")
    return current_user
