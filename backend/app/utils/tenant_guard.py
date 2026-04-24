"""
Tenant scoping helpers for IDOR prevention.

Pattern: every `GET /resource/{id}`, `PUT`, `PATCH`, `DELETE` endpoint must call
`assert_tenant_access(resource, current_user)` BEFORE returning or mutating data.

We return 404 (never 403) on cross-tenant access so attackers can't enumerate
which resource IDs exist outside their tenant.

Backwards-compatibility:
    Many existing rows still have NULL tenant_id (legacy seed data).
    We treat NULL on EITHER side as "no scoping enforceable" so we don't break
    the dev/staging environment. Once all rows have tenant_id backfilled, this
    can be tightened by setting STRICT_TENANT_SCOPING=True.
"""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.core.security import TokenData


# Toggle this to True after a full backfill of tenant_id on all tables.
STRICT_TENANT_SCOPING = False


def assert_tenant_access(
    resource: Any,
    current_user: TokenData,
    *,
    not_found_detail: str = "Not found",
    tenant_attr: str = "tenant_id",
) -> None:
    """
    Raise HTTPException(404) if the caller may not access the resource.

    Logic:
        * Resource missing → 404.
        * Both resource.tenant_id and current_user.tenant_id are set
          and they differ → 404.
        * In strict mode, mismatch or any NULL tenant on a scoped resource → 404.
    """
    if resource is None:
        raise HTTPException(status_code=404, detail=not_found_detail)

    resource_tenant = getattr(resource, tenant_attr, None)
    user_tenant = current_user.tenant_id

    if STRICT_TENANT_SCOPING:
        # Strict: both sides must have a tenant_id and they must match.
        if resource_tenant is None or user_tenant is None or resource_tenant != user_tenant:
            raise HTTPException(status_code=404, detail=not_found_detail)
        return

    # Permissive (legacy data tolerant): only block when both sides have a
    # tenant_id and they differ. NULL on either side is allowed through.
    if resource_tenant is not None and user_tenant is not None and resource_tenant != user_tenant:
        raise HTTPException(status_code=404, detail=not_found_detail)
