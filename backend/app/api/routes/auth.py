"""
Authentication Routes
Provides JWT token generation for Firebase-authenticated users
"""

import logging
from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.core.auth import create_access_token, JWT_ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter()
logger = logging.getLogger(__name__)


class TokenRequest(BaseModel):
    """Request model for token generation"""

    uid: str
    email: EmailStr
    role: str


class TokenResponse(BaseModel):
    """Response model for token generation"""

    access_token: str
    token_type: str = "bearer"
    expires_in: int


@router.post("/token", response_model=TokenResponse)
async def generate_token(request: TokenRequest):
    """
    Generate JWT access token for authenticated Firebase user

    This endpoint is called by the frontend after Firebase authentication
    to get a JWT token for backend API access.

    Args:
        request: Token request with user details

    Returns:
        JWT access token
    """
    try:
        # Validate role
        valid_roles = ["patient", "hospital", "insurer"]
        if request.role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}",
            )

        # Create JWT token
        token_data = {
            "uid": request.uid,
            "email": request.email,
            "role": request.role,
        }

        access_token = create_access_token(
            data=token_data,
            expires_delta=timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
        )

        logger.info(f"Generated token for user {request.email} (role: {request.role})")

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # Convert to seconds
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate access token",
        )


@router.post("/refresh")
async def refresh_token(request: TokenRequest):
    """
    Refresh JWT access token

    Args:
        request: Token request with user details

    Returns:
        New JWT access token
    """
    # For now, just generate a new token
    # In production, you might want to validate the old token first
    return await generate_token(request)
