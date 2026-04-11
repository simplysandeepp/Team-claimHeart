"""
JWT Authentication Middleware for ClaimHeart API
Provides secure token-based authentication with Firebase integration
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
)

# Security scheme
security = HTTPBearer(auto_error=False)


class TokenData(BaseModel):
    """JWT Token payload data"""

    uid: str
    email: str
    role: str
    exp: Optional[datetime] = None


class AuthUser(BaseModel):
    """Authenticated user model"""

    uid: str
    email: str
    role: str


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token

    Args:
        data: Token payload data
        expires_delta: Token expiration time

    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> TokenData:
    """
    Verify and decode JWT token

    Args:
        token: JWT token string

    Returns:
        TokenData: Decoded token data

    Raises:
        HTTPException: If token is invalid or expired
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

        uid: str = payload.get("uid")
        email: str = payload.get("email")
        role: str = payload.get("role")

        if uid is None or email is None:
            raise credentials_exception

        token_data = TokenData(uid=uid, email=email, role=role or "patient")
        return token_data

    except JWTError as e:
        logger.error(f"JWT verification failed: {e}")
        raise credentials_exception


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> AuthUser:
    """
    Dependency to get current authenticated user from JWT token

    Args:
        credentials: HTTP Bearer credentials

    Returns:
        AuthUser: Authenticated user

    Raises:
        HTTPException: If authentication fails
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    token_data = verify_token(token)

    return AuthUser(uid=token_data.uid, email=token_data.email, role=token_data.role)


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[AuthUser]:
    """
    Optional authentication - returns None if no token provided

    Args:
        credentials: HTTP Bearer credentials

    Returns:
        AuthUser or None
    """
    if credentials is None:
        return None

    try:
        token = credentials.credentials
        token_data = verify_token(token)
        return AuthUser(
            uid=token_data.uid, email=token_data.email, role=token_data.role
        )
    except HTTPException:
        return None


def require_role(allowed_roles: list[str]):
    """
    Dependency factory to require specific roles

    Args:
        allowed_roles: List of allowed role names

    Returns:
        Dependency function
    """

    async def role_checker(current_user: AuthUser = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}",
            )
        return current_user

    return role_checker


# Role-specific dependencies
require_hospital = require_role(["hospital"])
require_insurer = require_role(["insurer"])
require_patient = require_role(["patient"])
require_hospital_or_insurer = require_role(["hospital", "insurer"])
