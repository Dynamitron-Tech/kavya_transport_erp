# Permission Middleware
# Transport ERP - Role-Based Access Control

from functools import wraps
from typing import List, Optional, Callable, Union

from fastapi import Depends, HTTPException, status, Request

from app.core.security import TokenData, get_current_user


# Define all permissions
class Permissions:
    """All system permissions."""
    
    # Client Management
    CLIENT_CREATE = "client:create"
    CLIENT_READ = "client:read"
    CLIENT_UPDATE = "client:update"
    CLIENT_DELETE = "client:delete"
    
    # Job Management
    JOB_CREATE = "job:create"
    JOB_READ = "job:read"
    JOB_UPDATE = "job:update"
    JOB_DELETE = "job:delete"
    JOB_APPROVE = "job:approve"
    
    # LR Management
    LR_CREATE = "lr:create"
    LR_READ = "lr:read"
    LR_UPDATE = "lr:update"
    LR_DELETE = "lr:delete"
    
    # Trip Management
    TRIP_CREATE = "trip:create"
    TRIP_READ = "trip:read"
    TRIP_UPDATE = "trip:update"
    TRIP_DELETE = "trip:delete"
    TRIP_START = "trip:start"
    TRIP_COMPLETE = "trip:complete"
    
    # Vehicle Management
    VEHICLE_CREATE = "vehicle:create"
    VEHICLE_READ = "vehicle:read"
    VEHICLE_UPDATE = "vehicle:update"
    VEHICLE_DELETE = "vehicle:delete"
    
    # Driver Management
    DRIVER_CREATE = "driver:create"
    DRIVER_READ = "driver:read"
    DRIVER_UPDATE = "driver:update"
    DRIVER_DELETE = "driver:delete"
    
    # Finance - Invoice
    INVOICE_CREATE = "invoice:create"
    INVOICE_READ = "invoice:read"
    INVOICE_UPDATE = "invoice:update"
    INVOICE_DELETE = "invoice:delete"
    INVOICE_APPROVE = "invoice:approve"
    
    # Finance - Payment
    PAYMENT_CREATE = "payment:create"
    PAYMENT_READ = "payment:read"
    PAYMENT_UPDATE = "payment:update"
    PAYMENT_DELETE = "payment:delete"
    
    # Finance - Ledger
    LEDGER_READ = "ledger:read"
    LEDGER_EXPORT = "ledger:export"
    
    # Reports
    REPORT_VIEW = "report:view"
    REPORT_EXPORT = "report:export"
    
    # Tracking
    TRACKING_VIEW = "tracking:view"
    TRACKING_LIVE = "tracking:live"
    
    # Alerts
    ALERT_VIEW = "alert:view"
    ALERT_MANAGE = "alert:manage"
    
    # Admin
    ADMIN_USERS = "admin:users"
    ADMIN_ROLES = "admin:roles"
    ADMIN_SETTINGS = "admin:settings"
    ADMIN_AUDIT = "admin:audit"
    
    # Fuel
    FUEL_CREATE = "fuel:create"
    FUEL_READ = "fuel:read"
    FUEL_APPROVE = "fuel:approve"
    
    # Maintenance
    MAINTENANCE_CREATE = "maintenance:create"
    MAINTENANCE_READ = "maintenance:read"
    MAINTENANCE_APPROVE = "maintenance:approve"
    
    # Expense
    EXPENSE_CREATE = "expense:create"
    EXPENSE_READ = "expense:read"
    EXPENSE_APPROVE = "expense:approve"
    
    # User Management
    USER_CREATE = "user:create"
    USER_READ = "user:read"
    USER_UPDATE = "user:update"
    USER_DELETE = "user:delete"
    
    # E-way Bill
    EWAY_CREATE = "eway:create"
    EWAY_READ = "eway:read"
    EWAY_UPDATE = "eway:update"
    EWAY_DELETE = "eway:delete"
    EWAY_BILL_CREATE = "eway:create"
    EWAY_BILL_READ = "eway:read"
    EWAY_BILL_UPDATE = "eway:update"
    
    # Expense verify
    EXPENSE_VERIFY = "expense:approve"
    
    # Documents
    DOCUMENT_CREATE = "document:create"
    DOCUMENT_READ = "document:read"
    DOCUMENT_UPDATE = "document:update"
    DOCUMENT_DELETE = "document:delete"
    DOCUMENT_APPROVE = "document:approve"


# Role-Permission Mapping
ROLE_PERMISSIONS = {
    "admin": [
        # Admin has all permissions
        "*"  # Wildcard for all
    ],
    
    "manager": [
        # Client
        Permissions.CLIENT_CREATE, Permissions.CLIENT_READ, 
        Permissions.CLIENT_UPDATE, Permissions.CLIENT_DELETE,
        # Job
        Permissions.JOB_CREATE, Permissions.JOB_READ, 
        Permissions.JOB_UPDATE, Permissions.JOB_DELETE, Permissions.JOB_APPROVE,
        # LR
        Permissions.LR_READ,
        # E-way Bill
        Permissions.EWAY_CREATE, Permissions.EWAY_READ, Permissions.EWAY_UPDATE, Permissions.EWAY_DELETE,
        # Trip
        Permissions.TRIP_READ,
        # Vehicle
        Permissions.VEHICLE_CREATE, Permissions.VEHICLE_READ, 
        Permissions.VEHICLE_UPDATE, Permissions.VEHICLE_DELETE,
        # Driver
        Permissions.DRIVER_CREATE, Permissions.DRIVER_READ, 
        Permissions.DRIVER_UPDATE, Permissions.DRIVER_DELETE,
        # Reports
        Permissions.REPORT_VIEW, Permissions.REPORT_EXPORT,
        # Tracking
        Permissions.TRACKING_VIEW, Permissions.TRACKING_LIVE,
        # Alerts
        Permissions.ALERT_VIEW, Permissions.ALERT_MANAGE,
        # Documents
        Permissions.DOCUMENT_CREATE, Permissions.DOCUMENT_READ,
        Permissions.DOCUMENT_UPDATE, Permissions.DOCUMENT_DELETE, Permissions.DOCUMENT_APPROVE,
    ],
    
    "fleet_manager": [
        # Trip
        Permissions.TRIP_CREATE, Permissions.TRIP_READ, 
        Permissions.TRIP_UPDATE, Permissions.TRIP_START, Permissions.TRIP_COMPLETE,
        # E-way Bill (view only)
        Permissions.EWAY_BILL_READ,
        # Vehicle
        Permissions.VEHICLE_READ, Permissions.VEHICLE_UPDATE,
        # Driver
        Permissions.DRIVER_READ, Permissions.DRIVER_UPDATE,
        # LR
        Permissions.LR_READ,
        # Fuel
        Permissions.FUEL_CREATE, Permissions.FUEL_READ, Permissions.FUEL_APPROVE,
        # Maintenance
        Permissions.MAINTENANCE_CREATE, Permissions.MAINTENANCE_READ, 
        Permissions.MAINTENANCE_APPROVE,
        # Tracking
        Permissions.TRACKING_VIEW, Permissions.TRACKING_LIVE,
        # Alerts
        Permissions.ALERT_VIEW, Permissions.ALERT_MANAGE,
        # Reports
        Permissions.REPORT_VIEW,
        # Documents
        Permissions.DOCUMENT_CREATE, Permissions.DOCUMENT_READ, Permissions.DOCUMENT_UPDATE,
    ],
    
    "accountant": [
        # Invoice
        Permissions.INVOICE_CREATE, Permissions.INVOICE_READ, 
        Permissions.INVOICE_UPDATE, Permissions.INVOICE_DELETE,
        # Payment
        Permissions.PAYMENT_CREATE, Permissions.PAYMENT_READ, 
        Permissions.PAYMENT_UPDATE,
        # Ledger
        Permissions.LEDGER_READ, Permissions.LEDGER_EXPORT,
        # Client (read only for billing)
        Permissions.CLIENT_READ,
        # Trip (read only for invoicing)
        Permissions.TRIP_READ,
        # Reports
        Permissions.REPORT_VIEW, Permissions.REPORT_EXPORT,
        # Expense
        Permissions.EXPENSE_CREATE,
        Permissions.EXPENSE_READ, Permissions.EXPENSE_APPROVE,
    ],
    
    "project_associate": [
        # LR
        Permissions.LR_CREATE, Permissions.LR_READ, Permissions.LR_UPDATE,
        # E-way Bill
        Permissions.EWAY_CREATE, Permissions.EWAY_READ, Permissions.EWAY_UPDATE,
        # Trip
        Permissions.TRIP_CREATE, Permissions.TRIP_READ, Permissions.TRIP_UPDATE,
        # Job
        Permissions.JOB_CREATE, Permissions.JOB_READ, Permissions.JOB_UPDATE,
        # Client
        Permissions.CLIENT_READ,
        # Vehicle
        Permissions.VEHICLE_READ,
        # Driver
        Permissions.DRIVER_READ,
        # Documents
        Permissions.DOCUMENT_CREATE, Permissions.DOCUMENT_READ, Permissions.DOCUMENT_UPDATE,
    ],
    
    "driver": [
        # Trip (own trips only)
        Permissions.TRIP_READ, Permissions.TRIP_START, Permissions.TRIP_COMPLETE,
        # Expense (own expenses)
        Permissions.EXPENSE_CREATE, Permissions.EXPENSE_READ,
        # Fuel (own entries)
        Permissions.FUEL_CREATE, Permissions.FUEL_READ,
        # LR (read own)
        Permissions.LR_READ,
        # Documents (read own)
        Permissions.DOCUMENT_READ,
    ],
}


def _is_admin_role(user_roles: List[str]) -> bool:
    """Check whether the user has an admin role."""
    return any(role.lower() == "admin" for role in user_roles)


def has_permission(user_roles: List[str], required_permission: str) -> bool:
    """Check if any of user's roles has the required permission."""
    for role in user_roles:
        role = role.lower()
        if role in ROLE_PERMISSIONS:
            role_perms = ROLE_PERMISSIONS[role]
            # Wildcard check (admin)
            if "*" in role_perms:
                return True
            # Direct permission check
            if required_permission in role_perms:
                return True
    return False


def has_any_permission(user_roles: List[str], required_permissions: List[str]) -> bool:
    """Check if user has ANY of the required permissions."""
    for permission in required_permissions:
        if has_permission(user_roles, permission):
            return True
    return False


def has_all_permissions(user_roles: List[str], required_permissions: List[str]) -> bool:
    """Check if user has ALL of the required permissions."""
    for permission in required_permissions:
        if not has_permission(user_roles, permission):
            return False
    return True


def require_permission(permission: Union[str, List[str]]):
    """
    Dependency factory for requiring a specific permission.
    
    Usage:
        @app.get("/clients")
        async def list_clients(
            current_user: TokenData = Depends(require_permission(Permissions.CLIENT_READ))
        ):
            ...
    """
    async def permission_checker(
        current_user: TokenData = Depends(get_current_user)
    ) -> TokenData:
        required_permissions = [permission] if isinstance(permission, str) else permission

        # Explicit admin bypass for resilience across permission models.
        if _is_admin_role(current_user.roles):
            return current_user

        # Prefer explicit permissions from JWT when present.
        user_permissions = set(current_user.permissions or [])
        if user_permissions:
            if "*" in user_permissions or any(req in user_permissions for req in required_permissions):
                return current_user

        # Backward-compatible fallback to role-permission map.
        if not has_any_permission(current_user.roles, required_permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required any of: {required_permissions}"
            )
        return current_user
    
    return permission_checker


def require_any_permission(permissions: List[str]):
    """
    Dependency factory for requiring ANY of the specified permissions.
    """
    async def permission_checker(
        current_user: TokenData = Depends(get_current_user)
    ) -> TokenData:
        if _is_admin_role(current_user.roles):
            return current_user

        user_permissions = set(current_user.permissions or [])
        if user_permissions:
            if "*" in user_permissions or any(req in user_permissions for req in permissions):
                return current_user

        if not has_any_permission(current_user.roles, permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required any of: {permissions}"
            )
        return current_user
    
    return permission_checker


def require_all_permissions(permissions: List[str]):
    """
    Dependency factory for requiring ALL specified permissions.
    """
    async def permission_checker(
        current_user: TokenData = Depends(get_current_user)
    ) -> TokenData:
        if _is_admin_role(current_user.roles):
            return current_user

        user_permissions = set(current_user.permissions or [])
        if user_permissions:
            if "*" in user_permissions or all(req in user_permissions for req in permissions):
                return current_user

        if not has_all_permissions(current_user.roles, permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required all of: {permissions}"
            )
        return current_user
    
    return permission_checker


def require_role(roles: Union[str, List[str]]):
    """
    Dependency factory for requiring specific role(s).
    
    Usage:
        @app.get("/admin/users")
        async def admin_users(
            current_user: TokenData = Depends(require_role("admin"))
        ):
            ...
    """
    if isinstance(roles, str):
        roles = [roles]
    
    roles_lower = [r.lower() for r in roles]
    
    async def role_checker(
        current_user: TokenData = Depends(get_current_user)
    ) -> TokenData:
        user_roles_lower = [r.lower() for r in current_user.roles]
        
        if not any(role in user_roles_lower for role in roles_lower):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role required: {roles}"
            )
        return current_user
    
    return role_checker


class PermissionChecker:
    """
    Class-based permission checker for more complex scenarios.
    
    Usage:
        permission = PermissionChecker(Permissions.CLIENT_READ)
        
        @app.get("/clients")
        async def list_clients(
            current_user: TokenData = Depends(permission)
        ):
            ...
    """
    
    def __init__(
        self,
        required_permissions: Union[str, List[str]],
        require_all: bool = False
    ):
        if isinstance(required_permissions, str):
            required_permissions = [required_permissions]
        self.required_permissions = required_permissions
        self.require_all = require_all
    
    async def __call__(
        self,
        current_user: TokenData = Depends(get_current_user)
    ) -> TokenData:
        if _is_admin_role(current_user.roles):
            return current_user

        user_permissions = set(current_user.permissions or [])

        if self.require_all:
            if user_permissions:
                has_required = "*" in user_permissions or all(
                    req in user_permissions for req in self.required_permissions
                )
            else:
                has_required = has_all_permissions(current_user.roles, self.required_permissions)

            if not has_required:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions"
                )
        else:
            if user_permissions:
                has_required = "*" in user_permissions or any(
                    req in user_permissions for req in self.required_permissions
                )
            else:
                has_required = has_any_permission(current_user.roles, self.required_permissions)

            if not has_required:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions"
                )
        
        return current_user


def get_user_permissions(roles: List[str]) -> List[str]:
    """Get all permissions for given roles."""
    permissions = set()
    
    for role in roles:
        role = role.lower()
        if role in ROLE_PERMISSIONS:
            role_perms = ROLE_PERMISSIONS[role]
            if "*" in role_perms:
                # Return all permissions for admin
                return list(set(
                    value for name, value in vars(Permissions).items() 
                    if not name.startswith('_')
                ))
            permissions.update(role_perms)
    
    return list(permissions)
