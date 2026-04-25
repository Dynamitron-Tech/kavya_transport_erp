"""Seed permissions and role-permission links from middleware mapping.

This script is idempotent and safe to run multiple times.
It only seeds permission actions supported by the DB enum.
"""

from sqlalchemy import select

from app.db.postgres.connection import SyncSessionLocal
from app.middleware.permissions import ROLE_PERMISSIONS
from app.models.postgres.user import Permission, PermissionAction, Role


SUPPORTED_ACTIONS = {action.value for action in PermissionAction}


def parse_permission_code(code: str) -> tuple[str, str] | None:
    """Split `module:action` and validate enum support."""
    if ":" not in code:
        return None
    module, action = code.split(":", 1)
    module = module.strip().lower()
    action = action.strip().lower()
    if not module or action not in SUPPORTED_ACTIONS:
        return None
    return module, action


def seed_permissions() -> None:
    session = SyncSessionLocal()
    try:
        # Build a quick lookup of existing permissions by `module:action` code.
        existing_permissions = session.execute(select(Permission)).scalars().all()
        permission_by_code: dict[str, Permission] = {
            f"{perm.module}:{perm.action.value}": perm for perm in existing_permissions
        }

        created_permissions = 0
        skipped_unsupported = 0
        created_links = 0

        for role_name, permission_codes in ROLE_PERMISSIONS.items():
            role = session.execute(select(Role).where(Role.name == role_name)).scalar_one_or_none()
            if role is None:
                continue

            for code in permission_codes:
                if code == "*":
                    continue

                parsed = parse_permission_code(code)
                if parsed is None:
                    skipped_unsupported += 1
                    continue

                module, action = parsed
                normalized_code = f"{module}:{action}"

                permission = permission_by_code.get(normalized_code)
                if permission is None:
                    permission = Permission(
                        module=module,
                        action=PermissionAction(action),
                        resource=None,
                        description=f"Auto-seeded permission for {normalized_code}",
                    )
                    session.add(permission)
                    session.flush()
                    permission_by_code[normalized_code] = permission
                    created_permissions += 1

                # Relationship table has PK(role_id, permission_id); avoid duplicate append.
                already_linked = any(p.id == permission.id for p in role.permissions)
                if not already_linked:
                    role.permissions.append(permission)
                    created_links += 1

        session.commit()

        print("Permission seeding complete")
        print(f"Created permissions: {created_permissions}")
        print(f"Created role links: {created_links}")
        print(f"Skipped unsupported actions: {skipped_unsupported}")

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed_permissions()
