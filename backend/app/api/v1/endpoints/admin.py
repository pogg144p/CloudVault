from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()


@router.get("/users", response_model=List[UserResponse])
async def list_all_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Admin only: List all registered users."""
    result = await db.execute(select(User).order_by(User.created_at))
    return result.scalars().all()


@router.patch("/users/{user_id}/role", response_model=UserResponse)
async def set_user_role(
    user_id: str,
    is_admin: bool,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Admin only: Grant or revoke admin (superuser) role for a user."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own admin role.",
        )
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    target.is_superuser = is_admin
    db.add(target)
    await db.commit()
    await db.refresh(target)
    return target
