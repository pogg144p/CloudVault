from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
)
from app.models.activity import ActivityLog
from app.models.folder import Folder
from app.models.user import User
from app.schemas.token import RefreshTokenRequest, Token, TokenPayload
from app.schemas.user import UserCreate, UserLogin, UserResponse

router = APIRouter()

# ── Cookie settings ────────────────────────────────────────────────────────────
_COOKIE_SECURE   = settings.ENVIRONMENT != "development"   # True in production (HTTPS only)
_COOKIE_SAMESITE = "lax"                                   # Protects against CSRF
_ACCESS_MAX_AGE  = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
_REFRESH_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Write HttpOnly, Secure, SameSite=Lax cookies for both tokens."""
    response.set_cookie(
        key="cloudvault_access",
        value=access_token,
        max_age=_ACCESS_MAX_AGE,
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite=_COOKIE_SAMESITE,
        path="/",
    )
    response.set_cookie(
        key="cloudvault_refresh",
        value=refresh_token,
        max_age=_REFRESH_MAX_AGE,
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite=_COOKIE_SAMESITE,
        path="/api/v1/auth/refresh",   # Scoped — only sent on refresh endpoint
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("cloudvault_access", path="/")
    response.delete_cookie("cloudvault_refresh", path="/api/v1/auth/refresh")


# ── Register ───────────────────────────────────────────────────────────────────
@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Register a new user account, initialize default folders, and return auth tokens."""
    stmt = select(User).where(User.email == user_in.email.lower().strip())
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    db_user = User(
        email=user_in.email.lower().strip(),
        full_name=user_in.full_name.strip(),
        hashed_password=get_password_hash(user_in.password),
        storage_quota_bytes=settings.DEFAULT_STORAGE_QUOTA_BYTES,
        storage_used_bytes=0,
    )
    db.add(db_user)
    await db.flush()

    default_folders = [
        {"name": "Design",    "color": "#6366F1"},
        {"name": "Documents", "color": "#10B981"},
        {"name": "Music",     "color": "#F59E0B"},
        {"name": "Images",    "color": "#EF4444"},
    ]
    for folder_data in default_folders:
        folder = Folder(
            user_id=db_user.id,
            name=folder_data["name"],
            path=f"/{folder_data['name']}/",
            color=folder_data["color"],
        )
        db.add(folder)

    activity = ActivityLog(
        user_id=db_user.id,
        action="account_created",
        entity_type="account",
        entity_name="Account Created",
        entity_id=db_user.id,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(db_user)

    access_token  = create_access_token(subject=db_user.id)
    refresh_token = create_refresh_token(subject=db_user.id)

    _set_auth_cookies(response, access_token, refresh_token)

    return Token(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token,
    )


# ── Login ──────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=Token)
async def login(
    user_in: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Authenticate with email and password, returning JWT tokens via HttpOnly cookies."""
    stmt = select(User).where(User.email == user_in.email.lower().strip())
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive.",
        )

    access_token  = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    activity = ActivityLog(
        user_id=user.id,
        action="login",
        entity_type="account",
        entity_name="User Login",
        entity_id=user.id,
    )
    db.add(activity)
    await db.commit()

    _set_auth_cookies(response, access_token, refresh_token)

    return Token(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token,
    )


# ── Refresh ────────────────────────────────────────────────────────────────────
@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: Request,
    response: Response,
    refresh_in: RefreshTokenRequest | None = None,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Refreshes an expired access token using the HttpOnly cookie or body refresh token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Prefer cookie, fall back to request body
    raw_token = request.cookies.get("cloudvault_refresh")
    if not raw_token and refresh_in:
        raw_token = refresh_in.refresh_token

    if not raw_token:
        raise credentials_exception

    try:
        payload    = jwt.decode(raw_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_data = TokenPayload(**payload)
        if token_data.sub is None or token_data.type != "refresh":
            raise credentials_exception
    except (JWTError, Exception):
        raise credentials_exception

    stmt   = select(User).where(User.id == token_data.sub)
    result = await db.execute(stmt)
    user   = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise credentials_exception

    new_access_token  = create_access_token(subject=user.id)
    new_refresh_token = create_refresh_token(subject=user.id)

    _set_auth_cookies(response, new_access_token, new_refresh_token)

    return Token(
        access_token=new_access_token,
        token_type="bearer",
        refresh_token=new_refresh_token,
    )


# ── Logout ─────────────────────────────────────────────────────────────────────
@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    """Clear auth cookies — invalidates the session client-side."""
    _clear_auth_cookies(response)


# ── Me ─────────────────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
async def read_current_user(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Returns the authenticated user's profile and storage usage."""
    return current_user
