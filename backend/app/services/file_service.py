import hashlib
import mimetypes
import os
import uuid
from datetime import datetime, timezone
from typing import BinaryIO, List, Optional
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityLog
from app.models.file import File, FileVersion
from app.models.folder import Folder
from app.models.user import User
from app.schemas.file import FileUpdate
from app.services.storage_service import get_storage_service


class FileService:
    @staticmethod
    async def upload_file(
        db: AsyncSession,
        user: User,
        upload_file: UploadFile,
        folder_id: Optional[str] = None,
    ) -> File:
        # Validate target folder if specified
        if folder_id:
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

        clean_name = os.path.basename(upload_file.filename or "untitled")
        unique_id = uuid.uuid4().hex
        storage_key = f"{user.id}/{unique_id}_{clean_name}"

        # Stream chunks, compute SHA-256 and size
        hasher = hashlib.sha256()
        total_size = 0
        storage = get_storage_service()

        # Write to temporary memory / local file storage
        await storage.upload_file(upload_file.file, storage_key)

        # Calculate exact size from written file
        physical_path = storage.get_file_path(storage_key)
        total_size = os.path.getsize(physical_path)

        # Read back to compute hash (fast on local NVMe/SSD)
        with open(physical_path, "rb") as f:
            while chunk := f.read(1024 * 1024):
                hasher.update(chunk)
        checksum = hasher.hexdigest()

        # Quota enforcement check
        if user.storage_used_bytes + total_size > user.storage_quota_bytes:
            await storage.delete_file(storage_key)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Storage quota exceeded. Your remaining quota is {max(0, user.storage_quota_bytes - user.storage_used_bytes)} bytes.",
            )

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

        # Write new version to storage
        hasher = hashlib.sha256()
        storage = get_storage_service()
        await storage.upload_file(upload_file.file, storage_key)

        physical_path = storage.get_file_path(storage_key)
        total_size = os.path.getsize(physical_path)

        with open(physical_path, "rb") as f:
            while chunk := f.read(1024 * 1024):
                hasher.update(chunk)
        checksum = hasher.hexdigest()

        # Quota check for size difference
        size_delta = total_size - file.size_bytes
        if user.storage_used_bytes + size_delta > user.storage_quota_bytes:
            await storage.delete_file(storage_key)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Storage quota exceeded for new version.",
            )

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
