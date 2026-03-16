# Security Module - JWT Authentication
# Transport ERP - FastAPI Backend

from datetime import datetime, timedelta
from typing import Optional, Union

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.core.config import settings


# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token scheme
bearer_scheme = HTTPBearer(auto_error=False)


class TokenPayload(BaseModel):
    """JWT Token payload."""
    sub: str  # user_id
    email: str
    roles: list[str]
    permissions: list[str] = []
    tenant_id: Optional[int] = None
    branch_id: Optional[int] = None
    exp: datetime
    iat: datetime
    type: str = "access"  # access or refresh


class Token(BaseModel):
    """Token response model."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    """Extracted token data."""
    user_id: int
    email: str
    roles: list[str]
    permissions: list[str] = []
    tenant_id: Optional[int] = None
    branch_id: Optional[int] = None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)


def create_access_token(
    user_id: int,
    email: str,
    roles: list[str],
    permissions: Optional[list[str]] = None,
    tenant_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT access token."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "sub": str(user_id),
        "email": email,
        "roles": roles,
        "permissions": permissions or [],
        "tenant_id": tenant_id,
        "branch_id": branch_id,
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    }
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(
    user_id: int,
    email: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT refresh token."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode = {
        "sub": str(user_id),
        "email": email,
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh"
    }
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def create_tokens(
    user_id: int,
    email: str,
    roles: list[str],
    tenant_id: Optional[int] = None,
    branch_id: Optional[int] = None
) -> Token:
    """Create both access and refresh tokens."""
    from app.middleware.permissions import get_user_permissions

    permissions = get_user_permissions(roles)

    access_token = create_access_token(
        user_id=user_id,
        email=email,
        roles=roles,
        permissions=permissions,
        tenant_id=tenant_id,
        branch_id=branch_id
    )
    
    refresh_token = create_refresh_token(
        user_id=user_id,
        email=email
    )
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> TokenData:
    """
    Dependency to get current authenticated user from JWT token.
    
    Usage:
        @app.get("/protected")
        async def protected_route(current_user: TokenData = Depends(get_current_user)):
            ...
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not credentials:
        raise credentials_exception
    
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload is None:
        raise credentials_exception
    
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    
    user_id = payload.get("sub")
    email = payload.get("email")
    roles = payload.get("roles", [])
    permissions = payload.get("permissions", [])
    tenant_id = payload.get("tenant_id")
    branch_id = payload.get("branch_id")
    
    if user_id is None or email is None:
        raise credentials_exception
    
    return TokenData(
        user_id=int(user_id),
        email=email,
        roles=roles,
        permissions=permissions,
        tenant_id=tenant_id,
        branch_id=branch_id
    )


async def get_current_active_user(
    current_user: TokenData = Depends(get_current_user)
) -> TokenData:
    """
    Dependency to get current active user.
    Can be extended to check if user is active in database.
    """
    # TODO: Add database check for user active status if needed
    return current_user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> Optional[TokenData]:
    """
    Dependency for optional authentication.
    Returns None if no valid token is provided.
    """
    if not credentials:
        return None
    
    payload = decode_token(credentials.credentials)
    if payload is None or payload.get("type") != "access":
        return None
    
    return TokenData(
        user_id=int(payload.get("sub")),
        email=payload.get("email"),
        roles=payload.get("roles", []),
        permissions=payload.get("permissions", []),
        tenant_id=payload.get("tenant_id"),
        branch_id=payload.get("branch_id")
    )
