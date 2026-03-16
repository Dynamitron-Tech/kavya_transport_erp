# User, Role & Permission Models
# Transport ERP - PostgreSQL

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey, 
    DateTime, Text, Enum as SQLEnum, Table
)
from sqlalchemy.orm import relationship
import enum
from .base import Base, TimestampMixin, SoftDeleteMixin


class RoleType(enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    FLEET_MANAGER = "fleet_manager"
    ACCOUNTANT = "accountant"
    PROJECT_ASSOCIATE = "project_associate"
    DRIVER = "driver"


class PermissionAction(enum.Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    APPROVE = "approve"
    EXPORT = "export"


# Association table for User-Role many-to-many
user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('role_id', Integer, ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
)

# Association table for Role-Permission many-to-many
role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', Integer, ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
    Column('permission_id', Integer, ForeignKey('permissions.id', ondelete='CASCADE'), primary_key=True),
)


class User(Base, TimestampMixin, SoftDeleteMixin):
    """User model for authentication and authorization."""
    
    __tablename__ = "users"
    
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    last_login = Column(DateTime, nullable=True)
    
    # Multi-tenant support
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)
    
    # Relationships
    roles = relationship("Role", secondary=user_roles, back_populates="users")
    branch = relationship("Branch", back_populates="users")
    tenant = relationship("Tenant", back_populates="users")
    
    def __repr__(self):
        return f"<User {self.email}>"


class Role(Base, TimestampMixin):
    """Role model for RBAC."""
    
    __tablename__ = "roles"
    
    name = Column(String(50), unique=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    role_type = Column(SQLEnum(RoleType), nullable=False)
    is_system = Column(Boolean, default=False)  # System roles cannot be deleted
    
    # Relationships
    users = relationship("User", secondary=user_roles, back_populates="roles")
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")
    
    def __repr__(self):
        return f"<Role {self.name}>"


class Permission(Base, TimestampMixin):
    """Permission model for fine-grained access control."""
    
    __tablename__ = "permissions"
    
    module = Column(String(50), nullable=False)  # e.g., 'clients', 'trips', 'invoices'
    action = Column(SQLEnum(PermissionAction), nullable=False)
    resource = Column(String(100), nullable=True)  # Specific resource within module
    description = Column(Text, nullable=True)
    
    # Relationships
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")
    
    class Meta:
        unique_together = ('module', 'action', 'resource')
    
    def __repr__(self):
        return f"<Permission {self.module}:{self.action.value}>"


class UserRole(Base, TimestampMixin):
    """Extended user-role relationship with metadata."""
    
    __tablename__ = "user_role_assignments"
    
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    role_id = Column(Integer, ForeignKey('roles.id', ondelete='CASCADE'), nullable=False)
    assigned_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    valid_from = Column(DateTime, nullable=True)
    valid_until = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    role = relationship("Role")
    assigner = relationship("User", foreign_keys=[assigned_by])


class RolePermission(Base, TimestampMixin):
    """Extended role-permission relationship with metadata."""
    
    __tablename__ = "role_permission_assignments"
    
    role_id = Column(Integer, ForeignKey('roles.id', ondelete='CASCADE'), nullable=False)
    permission_id = Column(Integer, ForeignKey('permissions.id', ondelete='CASCADE'), nullable=False)
    granted_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    conditions = Column(Text, nullable=True)  # JSON conditions for conditional access
    
    # Relationships
    role = relationship("Role")
    permission = relationship("Permission")
    granter = relationship("User")


class Branch(Base, TimestampMixin, SoftDeleteMixin):
    """Branch model for multi-branch support."""
    
    __tablename__ = "branches"
    
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False)
    
    # Relationships
    users = relationship("User", back_populates="branch")
    tenant = relationship("Tenant", back_populates="branches")


class Tenant(Base, TimestampMixin, SoftDeleteMixin):
    """Tenant model for SaaS multi-tenant support."""
    
    __tablename__ = "tenants"
    
    name = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    domain = Column(String(255), unique=True, nullable=True)
    logo_url = Column(String(500), nullable=True)
    settings = Column(Text, nullable=True)  # JSON settings
    subscription_plan = Column(String(50), default='basic')
    subscription_valid_until = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    users = relationship("User", back_populates="tenant")
    branches = relationship("Branch", back_populates="tenant")
