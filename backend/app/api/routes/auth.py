"""
Authentication Routes
Provides JWT token generation for Firebase-authenticated users,
plus user management endpoints (signup / login / profile).
"""

import logging
from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.schemas.platform import AppUser, LoginRequest, ProfileUpdateRequest, SignupRequest
from app.services.workflow_service import workflow_service

try:
    from app.core.auth import create_access_token, JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    _jwt_available = True
except ImportError:
    _jwt_available = False

router = APIRouter()
logger = logging.getLogger(__name__)


# ── User-management endpoints (used by frontend auth flows) ──────────────────

@router.post("/signup", response_model=AppUser)
def signup(request: SignupRequest) -> AppUser:
    return workflow_service.signup(request)


@router.post("/login", response_model=AppUser)
def login(request: LoginRequest) -> AppUser:
    return workflow_service.login(request)


@router.get("/users/{user_id}", response_model=AppUser)
def get_user(user_id: str) -> AppUser:
    return workflow_service.get_user(user_id)


@router.patch("/users/{user_id}", response_model=AppUser)
def update_user(user_id: str, request: ProfileUpdateRequest) -> AppUser:
    return workflow_service.update_user(user_id, request)


# ── JWT token endpoints (used by Firebase-auth flow) ────────────────────────

class TokenRequest(BaseModel):
    uid: str
    email: EmailStr
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


@router.post("/token", response_model=TokenResponse)
async def generate_token(request: TokenRequest):
    """Generate JWT access token for an authenticated Firebase user."""
    if not _jwt_available:
        raise HTTPException(status_code=501, detail="JWT auth not configured.")
    try:
        valid_roles = ["patient", "hospital", "insurer"]
        if request.role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}",
            )
        token_data = {"uid": request.uid, "email": request.email, "role": request.role}
        access_token = create_access_token(
            data=token_data,
            expires_delta=timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        logger.info(f"Generated token for {request.email} (role: {request.role})")
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate access token")


@router.post("/refresh")
async def refresh_token(request: TokenRequest):
    return await generate_token(request)
