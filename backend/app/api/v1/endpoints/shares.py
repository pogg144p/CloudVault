from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.models.file import File
from app.models.share import Share
from app.models.user import User
from app.schemas.share import (
    PublicShareItemResponse,
    ShareCreate,
    ShareResponse,
    ShareVerifyPassword,
)
from app.services.share_service import ShareService
from app.services.storage_service import get_storage_service

router = APIRouter()


@router.post("/", response_model=ShareResponse, status_code=status.HTTP_201_CREATED)
async def create_share_link(
    share_in: ShareCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Create a new public/restricted share link with custom permissions and optional password."""
    return await ShareService.create_share(db, current_user.id, share_in)


@router.get("/", response_model=List[ShareResponse])
async def list_my_shares(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """List all active share links created by the current user."""
    return await ShareService.list_user_shares(db, current_user.id)


@router.delete("/{share_id}", status_code=status.HTTP_200_OK)
async def revoke_share_link(
    share_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Revoke and delete a share link."""
    await ShareService.revoke_share(db, current_user.id, share_id)
    return {"message": "Share link successfully revoked."}


@router.get("/public/{share_token}", response_model=PublicShareItemResponse)
async def get_public_share_info(
    share_token: str,
    password: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Public endpoint: Inspect a shared file or folder link, validating expiration and password."""
    return await ShareService.get_public_share(db, share_token, password)


@router.post("/public/{share_token}/verify", response_model=PublicShareItemResponse)
async def verify_share_password(
    share_token: str,
    verify_in: ShareVerifyPassword,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Public endpoint: Verify password for a protected share link and unlock metadata."""
    return await ShareService.get_public_share(db, share_token, verify_in.password)


@router.get("/public/{share_token}/download")
async def download_public_shared_file(
    share_token: str,
    password: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Public endpoint: Download a shared file if the share permission permits downloading."""
    public_info = await ShareService.get_public_share(db, share_token, password)

    if public_info.requires_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password required to download this protected file.",
        )

    if public_info.permission == "view":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This share link has view-only permissions. Downloading is not allowed.",
        )

    if public_info.item_type != "file" or not public_info.item_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Direct single-file download is only available for shared files.",
        )

    # Fetch file record to stream
    stmt = select(File).where(File.id == public_info.item_id)
    res = await db.execute(stmt)
    file_record = res.scalar_one_or_none()
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared file data could not be located.",
        )

    storage = get_storage_service()
    try:
        stream = storage.get_file_stream(file_record.storage_key)
        return StreamingResponse(
            stream,
            media_type=file_record.mime_type,
            headers={
                "Content-Disposition": f'attachment; filename="{file_record.name}"',
                "Content-Length": str(file_record.size_bytes),
            },
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File binary is missing from object storage.",
        )
