from typing import Any
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.schemas.trash import PurgeRequest, RestoreRequest, TrashListResponse
from app.services.trash_service import TrashService

router = APIRouter()


@router.get("/", response_model=TrashListResponse)
async def list_trash(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Retrieve all soft-deleted files and folders in the user's recycle bin."""
    return await TrashService.get_trash_items(db, current_user.id)


@router.post("/restore")
async def restore_item(
    req: RestoreRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Restore a deleted file or folder back to active storage."""
    if req.item_type == "folder":
        folder = await TrashService.restore_folder(db, current_user, req.item_id)
        return {"message": f"Folder '{folder.name}' restored successfully.", "item": folder}
    else:
        file = await TrashService.restore_file(db, current_user, req.item_id)
        return {"message": f"File '{file.name}' restored successfully.", "item": file}


@router.delete("/purge")
async def purge_item(
    req: PurgeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Permanently purge a file or folder and all its revisions from storage and database."""
    if req.item_type == "folder":
        await TrashService.purge_folder(db, current_user, req.item_id)
        return {"message": "Folder permanently purged from storage."}
    else:
        await TrashService.purge_file(db, current_user, req.item_id)
        return {"message": "File permanently purged from storage."}
