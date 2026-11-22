import hashlib
import io
import mimetypes
import os
import uuid
from datetime import datetime, timezone
from typing import BinaryIO, List, Optional
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityLog
from app.models.file import File, FileVersion
from app.models.folder import Folder
from app.models.user import User
from app.schemas.file import (
    FileUpdate,
    PresignedConfirmRequest,
    PresignedDownloadResponse,
    PresignedUploadRequest,
    PresignedUrlResponse,
)
from app.services.storage_service import get_storage_service


class FileService:
    @staticmethod
    def classify_filename_category(filename: str, mime: str = "") -> str:
        """Determines default destination folder category from filename and MIME type."""
        lower = filename.lower()
        mime = mime.lower()
        image_exts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico", ".tiff", ".heic"]
        video_exts = [".mp4", ".mov", ".mkv", ".webm", ".avi", ".flv", ".wmv", ".m4v"]
        audio_exts = [".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a", ".wma"]

        if mime.startswith("image/") or any(lower.endswith(ext) for ext in image_exts):
            return "Images"
        if mime.startswith("video/") or any(lower.endswith(ext) for ext in video_exts):
            return "Videos"
        if mime.startswith("audio/") or any(lower.endswith(ext) for ext in audio_exts):
            return "Music"
        return "Documents"

    @staticmethod
    async def get_or_create_category_folder(db: AsyncSession, user_id: str, category_name: str) -> Folder:
        """Ensures the root category folder exists for the user."""
        color_map = {
            "Images": "#EF4444",
            "Videos": "#8B5CF6",
            "Documents": "#10B981",
            "Music": "#F59E0B",
        }
        stmt = select(Folder).where(
            Folder.user_id == user_id,
            Folder.name == category_name,
            Folder.parent_id == None,
            Folder.is_deleted == False,
        )
        res = await db.execute(stmt)
        folder = res.scalar_one_or_none()
        if not folder:
            folder = Folder(
                user_id=user_id,
                parent_id=None,
                name=category_name,
                path=f"/{category_name}/",
                color=color_map.get(category_name, "#4F46E5"),
            )
            db.add(folder)
            await db.flush()
        return folder

    @staticmethod
    async def upload_file(
        db: AsyncSession,
        user: User,
        upload_file: UploadFile,
        folder_id: Optional[str] = None,
        auto_sort: bool = False,
    ) -> File:
        clean_name = os.path.basename(upload_file.filename or "untitled")
        guessed_mime = (
            upload_file.content_type
            or mimetypes.guess_type(clean_name)[0]
            or "application/octet-stream"
        )

        # Handle intelligent auto-sorting
        if auto_sort or folder_id == "auto":
            target_cat = FileService.classify_filename_category(clean_name, guessed_mime)
            cat_folder = await FileService.get_or_create_category_folder(db, user.id, target_cat)
            folder_id = cat_folder.id
        elif folder_id:
            # Validate target folder if specified
            fol_stmt = select(Folder).where(
                Folder.id == folder_id,
                Folder.user_id == user.id,
                Folder.is_deleted == False,
            )
            fol_res = await db.execute(fol_stmt)
            if not fol_res.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Target folder not found.",
                )

        unique_id = uuid.uuid4().hex
        storage_key = f"{user.id}/{unique_id}_{clean_name}"

        # Read stream directly to compute size & SHA-256 in memory
        content = await upload_file.read()
        total_size = len(content)
        checksum = hashlib.sha256(content).hexdigest()

        # Quota enforcement check
        if user.storage_used_bytes + total_size > user.storage_quota_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Storage quota exceeded. Your remaining quota is {max(0, user.storage_quota_bytes - user.storage_used_bytes)} bytes.",
            )

        storage = get_storage_service()
        await storage.upload_file(io.BytesIO(content), storage_key)

        mime_type = (
            upload_file.content_type
            or mimetypes.guess_type(clean_name)[0]
            or "application/octet-stream"
        )

        # Create File record
        db_file = File(
            user_id=user.id,
            folder_id=folder_id,
            name=clean_name,
            mime_type=mime_type,
            size_bytes=total_size,
            storage_key=storage_key,
            checksum_sha256=checksum,
            current_version=1,
        )
        db.add(db_file)
        await db.flush()

        # Record FileVersion 1
        version = FileVersion(
            file_id=db_file.id,
            version_number=1,
            storage_key=storage_key,
            size_bytes=total_size,
            checksum_sha256=checksum,
            uploaded_by=user.id,
        )
        db.add(version)

        # Update user's used storage
        user.storage_used_bytes += total_size
        db.add(user)

        # Log upload activity
        activity = ActivityLog(
            user_id=user.id,
            action="upload_file",
            entity_type="file",
            entity_name=clean_name,
            entity_id=db_file.id,
        )
        db.add(activity)

        await db.commit()
        await db.refresh(db_file)
        return db_file

    @staticmethod
    async def generate_presigned_upload(
        db: AsyncSession,
        user: User,
        req: PresignedUploadRequest,
    ) -> PresignedUrlResponse:
        """Issue pre-signed direct PUT URL for cloud storage (S3 / MinIO)."""
        if user.storage_used_bytes + req.size_bytes > user.storage_quota_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Storage quota exceeded. Remaining: {max(0, user.storage_quota_bytes - user.storage_used_bytes)} bytes.",
            )

        clean_name = os.path.basename(req.filename)
        storage_key = f"{user.id}/{uuid.uuid4().hex}_{clean_name}"

        storage = get_storage_service()
        upload_url = storage.generate_presigned_upload_url(storage_key, expires_in=900)

        return PresignedUrlResponse(
            upload_url=upload_url,
            storage_key=storage_key,
            method="PUT",
            expires_in_seconds=900,
            headers={"Content-Type": req.content_type},
        )

    @staticmethod
    async def confirm_presigned_upload(
        db: AsyncSession,
        user: User,
        req: PresignedConfirmRequest,
    ) -> File:
        """Register completed direct cloud upload and reconcile user quota."""
        storage = get_storage_service()
        if not await storage.file_exists(req.storage_key):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Object was not detected on cloud storage. Upload may have failed or timed out.",
            )

        clean_name = os.path.basename(req.filename)
        mime_type = req.mime_type or mimetypes.guess_type(clean_name)[0] or "application/octet-stream"

        db_file = File(
            user_id=user.id,
            folder_id=req.folder_id,
            name=clean_name,
            mime_type=mime_type,
            size_bytes=req.size_bytes,
            storage_key=req.storage_key,
            current_version=1,
        )
        db.add(db_file)
        await db.flush()

        version = FileVersion(
            file_id=db_file.id,
            version_number=1,
            storage_key=req.storage_key,
            size_bytes=req.size_bytes,
            uploaded_by=user.id,
        )
        db.add(version)

        user.storage_used_bytes += req.size_bytes
        db.add(user)

        activity = ActivityLog(
            user_id=user.id,
            action="upload_file",
            entity_type="file",
            entity_name=clean_name,
            entity_id=db_file.id,
        )
        db.add(activity)

        await db.commit()
        await db.refresh(db_file)
        return db_file

    @staticmethod
    async def generate_presigned_download(
        db: AsyncSession,
        user_id: str,
        file_id: str,
    ) -> PresignedDownloadResponse:
        """Generate secure temporary GET URL for direct cloud download."""
        file = await FileService.get_file(db, user_id, file_id)
        storage = get_storage_service()
        download_url = storage.generate_presigned_download_url(file.storage_key, expires_in=900)
        return PresignedDownloadResponse(download_url=download_url, expires_in_seconds=900)

    @staticmethod
    async def get_file(db: AsyncSession, user_id: str, file_id: str) -> File:
        stmt = select(File).where(
            File.id == file_id,
            File.user_id == user_id,
            File.is_deleted == False,
        )
        res = await db.execute(stmt)
        file = res.scalar_one_or_none()
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="File not found."
            )
        return file

    @staticmethod
    async def list_files(
        db: AsyncSession,
        user_id: str,
        folder_id: Optional[str] = None,
        search: Optional[str] = None,
        only_favorites: bool = False,
        category: Optional[str] = None,
    ) -> List[File]:
        stmt = select(File).where(
            File.user_id == user_id,
            File.is_deleted == False,
        )
        if folder_id is not None:
            stmt = stmt.where(File.folder_id == folder_id)
        if search:
            stmt = stmt.where(File.name.ilike(f"%{search.strip()}%"))
        if only_favorites:
            stmt = stmt.where(File.is_favorite == True)

        if category in ("pictures", "images"):
            stmt = stmt.where(File.mime_type.ilike("image/%"))
        elif category == "videos":
            stmt = stmt.where(File.mime_type.ilike("video/%"))
        elif category in ("music", "audio"):
            stmt = stmt.where(File.mime_type.ilike("audio/%"))
        elif category == "documents":
            stmt = stmt.where(
                or_(
                    File.mime_type.ilike("%pdf%"),
                    File.mime_type.ilike("text/%"),
                    File.mime_type.ilike("%document%"),
                    File.mime_type.ilike("%sheet%"),
                    File.mime_type.ilike("%presentation%"),
                    File.mime_type.ilike("%msword%"),
                    File.mime_type.ilike("%officedocument%"),
                    File.name.ilike("%.pdf"),
                    File.name.ilike("%.doc"),
                    File.name.ilike("%.docx"),
                    File.name.ilike("%.txt"),
                    File.name.ilike("%.md"),
                    File.name.ilike("%.xls"),
                    File.name.ilike("%.xlsx"),
                    File.name.ilike("%.csv"),
                    File.name.ilike("%.ppt"),
                    File.name.ilike("%.pptx"),
                )
            )

        stmt = stmt.order_by(File.created_at.desc())
        res = await db.execute(stmt)
        return res.scalars().all()

    @staticmethod
    async def update_file(
        db: AsyncSession, user_id: str, file_id: str, update_in: FileUpdate
    ) -> File:
        file = await FileService.get_file(db, user_id, file_id)

        if update_in.name:
            file.name = update_in.name.strip()
        if update_in.is_favorite is not None:
            file.is_favorite = update_in.is_favorite
        if update_in.folder_id is not None:
            if update_in.folder_id != "":
                # Validate folder exists
                fol_stmt = select(Folder).where(
                    Folder.id == update_in.folder_id,
                    Folder.user_id == user_id,
                    Folder.is_deleted == False,
                )
                fol_res = await db.execute(fol_stmt)
                if not fol_res.scalar_one_or_none():
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Destination folder not found.",
                    )
                file.folder_id = update_in.folder_id
            else:
                file.folder_id = None

        db.add(file)
        await db.commit()
        await db.refresh(file)
        return file

    @staticmethod
    async def delete_file(db: AsyncSession, user: User, file_id: str) -> bool:
        file = await FileService.get_file(db, user.id, file_id)

        file.is_deleted = True
        file.deleted_at = datetime.now(timezone.utc)
        db.add(file)

        # Deduct used storage quota
        user.storage_used_bytes = max(0, user.storage_used_bytes - file.size_bytes)
        db.add(user)

        activity = ActivityLog(
            user_id=user.id,
            action="delete_file",
            entity_type="file",
            entity_name=file.name,
            entity_id=file.id,
        )
        db.add(activity)

        await db.commit()
        return True

    @staticmethod
    async def upload_new_version(
        db: AsyncSession,
        user: User,
        file_id: str,
        upload_file: UploadFile,
    ) -> File:
        """Uploads a new version of an existing file, increments version number, and records history."""
        file = await FileService.get_file(db, user.id, file_id)

        clean_name = os.path.basename(upload_file.filename or file.name)
        unique_id = uuid.uuid4().hex
        new_version_num = file.current_version + 1
        storage_key = f"{user.id}/{unique_id}_v{new_version_num}_{clean_name}"

        # Read stream directly to compute size & SHA-256 in memory
        content = await upload_file.read()
        total_size = len(content)
        checksum = hashlib.sha256(content).hexdigest()

        # Quota check for size difference
        size_delta = total_size - file.size_bytes
        if user.storage_used_bytes + size_delta > user.storage_quota_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Storage quota exceeded for new version.",
            )

        storage = get_storage_service()
        await storage.upload_file(io.BytesIO(content), storage_key)

        # Update active file record
        file.current_version = new_version_num
        file.storage_key = storage_key
        file.size_bytes = total_size
        file.checksum_sha256 = checksum
        file.updated_at = datetime.now(timezone.utc)
        db.add(file)

        # Record FileVersion entry
        version = FileVersion(
            file_id=file.id,
            version_number=new_version_num,
            storage_key=storage_key,
            size_bytes=total_size,
            checksum_sha256=checksum,
            uploaded_by=user.id,
        )
        db.add(version)

        user.storage_used_bytes += size_delta
        db.add(user)

        activity = ActivityLog(
            user_id=user.id,
            action="upload_version",
            entity_type="file",
            entity_name=file.name,
            entity_id=file.id,
        )
        db.add(activity)

        await db.commit()
        await db.refresh(file)
        return file

    @staticmethod
    async def list_versions(
        db: AsyncSession, user_id: str, file_id: str
    ) -> List[FileVersion]:
        """Lists all recorded revisions for a file."""
        # Ensure file belongs to user
        await FileService.get_file(db, user_id, file_id)

        stmt = (
            select(FileVersion)
            .where(FileVersion.file_id == file_id)
            .order_by(FileVersion.version_number.desc())
        )
        res = await db.execute(stmt)
        return res.scalars().all()

    @staticmethod
    async def get_version(
        db: AsyncSession, user_id: str, file_id: str, version_number: int
    ) -> FileVersion:
        """Retrieves a specific version record for a file."""
        await FileService.get_file(db, user_id, file_id)

        stmt = select(FileVersion).where(
            FileVersion.file_id == file_id,
            FileVersion.version_number == version_number,
        )
        res = await db.execute(stmt)
        version = res.scalar_one_or_none()
        if not version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version {version_number} not found for this file.",
            )
        return version

    @staticmethod
    async def restore_version(
        db: AsyncSession, user: User, file_id: str, version_number: int
    ) -> File:
        """Restores a previous version as the active file."""
        file = await FileService.get_file(db, user.id, file_id)
        target_version = await FileService.get_version(
            db, user.id, file_id, version_number
        )

        size_delta = target_version.size_bytes - file.size_bytes
        if user.storage_used_bytes + size_delta > user.storage_quota_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Storage quota exceeded to restore this version.",
            )

        file.storage_key = target_version.storage_key
        file.size_bytes = target_version.size_bytes
        file.checksum_sha256 = target_version.checksum_sha256
        file.current_version = target_version.version_number
        file.updated_at = datetime.now(timezone.utc)

        user.storage_used_bytes += size_delta
        db.add(file)
        db.add(user)

        activity = ActivityLog(
            user_id=user.id,
            action="restore_version",
            entity_type="file",
            entity_name=f"{file.name} (v{version_number})",
            entity_id=file.id,
        )
        db.add(activity)

        await db.commit()
        await db.refresh(file)
        return file
