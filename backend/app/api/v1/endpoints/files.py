from typing import Any, List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, File as FastAPIFile, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.schemas.file import FileResponse, FileUpdate, FileVersionResponse
from app.services.file_service import FileService
from app.services.storage_service import get_storage_service
from app.services.thumbnail_service import ThumbnailService

router = APIRouter()


@router.post("/upload", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = FastAPIFile(...),
    folder_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Stream and upload a file to CloudVault storage, validating quota and computing checksum."""
    if folder_id == "" or folder_id == "null":
        folder_id = None
    created_file = await FileService.upload_file(db, current_user, file, folder_id)
    if created_file.mime_type.startswith("image/"):
        background_tasks.add_task(
            ThumbnailService.process_thumbnail_async,
            created_file.id,
            created_file.storage_key,
            created_file.mime_type,
        )
    return created_file


@router.get("/", response_model=List[FileResponse])
async def list_files(
    folder_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    only_favorites: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """List files for the user with optional folder filtering and keyword search."""
    return await FileService.list_files(
        db, current_user.id, folder_id, search, only_favorites
    )


@router.get("/{file_id}", response_model=FileResponse)
async def get_file_details(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get metadata for a single file."""
    return await FileService.get_file(db, current_user.id, file_id)


@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Stream file bytes with content-disposition headers for direct browser download."""
    file = await FileService.get_file(db, current_user.id, file_id)
    storage = get_storage_service()

    try:
        stream = storage.get_file_stream(file.storage_key)
        return StreamingResponse(
            stream,
            media_type=file.mime_type,
            headers={
                "Content-Disposition": f'attachment; filename="{file.name}"',
                "Content-Length": str(file.size_bytes),
            },
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File binary data not found on storage backend.",
        )


@router.put("/{file_id}", response_model=FileResponse)
async def update_file(
    file_id: str,
    update_in: FileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Rename file, move to a different folder, or toggle favorite."""
    return await FileService.update_file(db, current_user.id, file_id, update_in)


@router.delete("/{file_id}", status_code=status.HTTP_200_OK)
async def delete_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Soft delete a file and release the user's storage quota."""
    await FileService.delete_file(db, current_user, file_id)
    return {"message": "File deleted successfully."}


@router.post("/{file_id}/versions", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_new_version(
    file_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = FastAPIFile(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Upload a new revision for an existing file and track version history."""
    updated_file = await FileService.upload_new_version(db, current_user, file_id, file)
    if updated_file.mime_type.startswith("image/"):
        background_tasks.add_task(
            ThumbnailService.process_thumbnail_async,
            updated_file.id,
            updated_file.storage_key,
            updated_file.mime_type,
        )
    return updated_file


@router.get("/{file_id}/versions", response_model=List[FileVersionResponse])
async def list_file_versions(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """List all previous and current revisions for a file."""
    return await FileService.list_versions(db, current_user.id, file_id)


@router.get("/{file_id}/versions/{version_number}/download")
async def download_file_version(
    file_id: str,
    version_number: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Download a specific historical revision of a file."""
    file = await FileService.get_file(db, current_user.id, file_id)
    version = await FileService.get_version(db, current_user.id, file_id, version_number)
    storage = get_storage_service()

    try:
        stream = storage.get_file_stream(version.storage_key)
        return StreamingResponse(
            stream,
            media_type=file.mime_type,
            headers={
                "Content-Disposition": f'attachment; filename="v{version_number}_{file.name}"',
                "Content-Length": str(version.size_bytes),
            },
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Historical version binary not found on storage backend.",
        )


@router.post("/{file_id}/versions/{version_number}/restore", response_model=FileResponse)
async def restore_file_version(
    file_id: str,
    version_number: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Revert the file back to a previous historical revision."""
    return await FileService.restore_version(db, current_user, file_id, version_number)


@router.get("/{file_id}/thumbnail")
async def get_file_thumbnail(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Stream downscaled image thumbnail with client caching headers."""
    file = await FileService.get_file(db, current_user.id, file_id)
    storage = get_storage_service()
    thumb_key = f"{file.storage_key}_thumb.jpg"
    try:
        stream = storage.get_file_stream(thumb_key)
        return StreamingResponse(
            stream,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except FileNotFoundError:
        # Fall back to original file if thumbnail not yet ready
        try:
            stream = storage.get_file_stream(file.storage_key)
            return StreamingResponse(stream, media_type=file.mime_type)
        except FileNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File content not found.",
            )


@router.get("/{file_id}/preview")
async def preview_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Stream file content inline for in-browser preview (PDFs, images, text)."""
    file = await FileService.get_file(db, current_user.id, file_id)
    storage = get_storage_service()
    try:
        stream = storage.get_file_stream(file.storage_key)
        return StreamingResponse(
            stream,
            media_type=file.mime_type,
            headers={
                "Content-Disposition": f'inline; filename="{file.name}"',
                "Content-Length": str(file.size_bytes),
            },
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File content not found on storage backend.",
        )
