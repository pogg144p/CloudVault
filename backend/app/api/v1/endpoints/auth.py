from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
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


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Register a new user account, initialize default folders, and return auth tokens."""
    # Check if user already exists
    stmt = select(User).where(User.email == user_in.email.lower().strip())
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # Create new user
    db_user = User(
        email=user_in.email.lower().strip(),
        full_name=user_in.full_name.strip(),
        hashed_password=get_password_hash(user_in.password),
        storage_quota_bytes=settings.DEFAULT_STORAGE_QUOTA_BYTES,
        storage_used_bytes=0,
    )
    db.add(db_user)
    await db.flush()  # Generates db_user.id

    # Create default folders matching the CloudVault dashboard UI
    default_folders = [
        {"name": "Design", "color": "#6366F1"},     # Indigo
        {"name": "Documents", "color": "#10B981"},  # Emerald
        {"name": "Music", "color": "#F59E0B"},      # Amber
        {"name": "Images", "color": "#EF4444"},     # Rose
    ]
    for folder_data in default_folders:
        folder = Folder(
            user_id=db_user.id,
            name=folder_data["name"],
            path=f"/{folder_data['name']}/",
            color=folder_data["color"],
        )
        db.add(folder)

    # Log registration activity
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

    # Create tokens
    access_token = create_access_token(subject=db_user.id)
    refresh_token = create_refresh_token(subject=db_user.id)

    return Token(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token,
    )


@router.post("/login", response_model=Token)
async def login(
    user_in: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Authenticate with email and password, returning JWT tokens."""
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

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    # Record login activity
    activity = ActivityLog(
        user_id=user.id,
        action="login",
        entity_type="account",
        entity_name="User Login",
        entity_id=user.id,
    )
    db.add(activity)
    await db.commit()

    return Token(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_in: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Refreshes an expired access token using a valid refresh token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            refresh_in.refresh_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        token_data = TokenPayload(**payload)
        if token_data.sub is None or token_data.type != "refresh":
            raise credentials_exception
    except (JWTError, Exception):
        raise credentials_exception

    stmt = select(User).where(User.id == token_data.sub)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise credentials_exception

    new_access_token = create_access_token(subject=user.id)
    new_refresh_token = create_refresh_token(subject=user.id)

    return Token(
        access_token=new_access_token,
        token_type="bearer",
        refresh_token=new_refresh_token,
    )


@router.get("/me", response_model=UserResponse)
async def read_current_user(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Returns the authenticated user's profile and storage usage."""
    return current_user
