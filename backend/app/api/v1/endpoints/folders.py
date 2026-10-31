from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.models.file import File
from app.models.folder import Folder
from app.models.user import User
from app.schemas.file import FileResponse
from app.schemas.folder import (
    BreadcrumbItem,
    FolderCreate,
    FolderDetailResponse,
    FolderResponse,
    FolderUpdate,
)
from app.services.folder_service import FolderService

router = APIRouter()


@router.post("/", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    folder_in: FolderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Create a new folder in the root directory or nested under a parent folder."""
    return await FolderService.create_folder(db, current_user.id, folder_in)


@router.get("/", response_model=List[FolderResponse])
async def list_folders(
    parent_id: Optional[str] = Query(None, description="Parent folder ID. If null, lists root folders."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """List non-deleted folders for the current user."""
    return await FolderService.list_folders(db, current_user.id, parent_id)


@router.get("/{folder_id}", response_model=FolderDetailResponse)
async def get_folder_details(
    folder_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get folder contents: breadcrumbs trail, child subfolders, and files inside."""
    target_folder: Optional[Folder] = None
    if folder_id != "root":
        stmt = select(Folder).where(
            Folder.id == folder_id,
            Folder.user_id == current_user.id,
            Folder.is_deleted == False,
        )
        res = await db.execute(stmt)
        target_folder = res.scalar_one_or_none()

    effective_parent_id = target_folder.id if target_folder else None

    # Get breadcrumbs
    breadcrumbs = await FolderService.get_breadcrumbs(db, current_user.id, target_folder)

    # Get child subfolders
    subfolders = await FolderService.list_folders(db, current_user.id, effective_parent_id)

    # Get files in folder
    files_stmt = (
        select(File)
        .where(
            File.user_id == current_user.id,
            File.folder_id == effective_parent_id,
            File.is_deleted == False,
        )
        .order_by(File.created_at.desc())
    )
    files_res = await db.execute(files_stmt)
    files = files_res.scalars().all()

    return FolderDetailResponse(
        folder=FolderResponse.model_validate(target_folder) if target_folder else None,
        breadcrumbs=breadcrumbs,
        subfolders=[FolderResponse.model_validate(f) for f in subfolders],
        files=[FileResponse.model_validate(f) for f in files],
    )


@router.put("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: str,
    folder_in: FolderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Rename a folder, update its color, or toggle favorite."""
    return await FolderService.rename_folder(db, current_user.id, folder_id, folder_in)


@router.delete("/{folder_id}", status_code=status.HTTP_200_OK)
async def delete_folder(
    folder_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Soft delete a folder and all its contents."""
    await FolderService.delete_folder(db, current_user.id, folder_id)
    return {"message": "Folder deleted successfully."}
