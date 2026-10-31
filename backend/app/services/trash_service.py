import os
from datetime import datetime, timezone
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityLog
from app.models.file import File, FileVersion
from app.models.folder import Folder
from app.models.user import User
from app.services.storage_service import get_storage_service


class TrashService:
    @staticmethod
    async def get_trash_items(db: AsyncSession, user_id: str) -> Dict[str, list]:
        """Returns all soft-deleted files and folders for the user."""
        # Query deleted files
        files_stmt = (
            select(File)
            .where(File.user_id == user_id, File.is_deleted == True)
            .order_by(File.deleted_at.desc())
        )
        files_res = await db.execute(files_stmt)
        files = files_res.scalars().all()

        # Query top-level deleted folders (avoid showing both parent and child in trash root)
        folders_stmt = (
            select(Folder)
            .where(Folder.user_id == user_id, Folder.is_deleted == True)
            .order_by(Folder.deleted_at.desc())
        )
        folders_res = await db.execute(folders_stmt)
        folders = folders_res.scalars().all()

        return {"files": files, "folders": folders}

    @staticmethod
    async def restore_file(db: AsyncSession, user: User, file_id: str) -> File:
        """Restores a soft-deleted file back to its folder or root."""
        stmt = select(File).where(File.id == file_id, File.user_id == user.id)
        res = await db.execute(stmt)
        file = res.scalar_one_or_none()
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="File not found."
            )

        if not file.is_deleted:
            return file

        # Check if parent folder still exists and is not deleted
        if file.folder_id:
            fol_stmt = select(Folder).where(
                Folder.id == file.folder_id,
                Folder.user_id == user.id,
                Folder.is_deleted == False,
            )
            fol_res = await db.execute(fol_stmt)
            if not fol_res.scalar_one_or_none():
                file.folder_id = None  # Revert to root

        # Check quota
        if user.storage_used_bytes + file.size_bytes > user.storage_quota_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot restore file: storage quota would be exceeded.",
            )

        file.is_deleted = False
        file.deleted_at = None
        user.storage_used_bytes += file.size_bytes

        db.add(file)
        db.add(user)

        activity = ActivityLog(
            user_id=user.id,
            action="restore_file",
            entity_type="file",
            entity_name=file.name,
            entity_id=file.id,
        )
        db.add(activity)

        await db.commit()
        await db.refresh(file)
        return file

    @staticmethod
    async def restore_folder(db: AsyncSession, user: User, folder_id: str) -> Folder:
        """Restores a soft-deleted folder and its contents."""
        stmt = select(Folder).where(Folder.id == folder_id, Folder.user_id == user.id)
        res = await db.execute(stmt)
        folder = res.scalar_one_or_none()
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found."
            )

        if not folder.is_deleted:
            return folder

        # If parent folder is deleted or missing, attach to root
        if folder.parent_id:
            p_stmt = select(Folder).where(
                Folder.id == folder.parent_id,
                Folder.user_id == user.id,
                Folder.is_deleted == False,
            )
            p_res = await db.execute(p_stmt)
            if not p_res.scalar_one_or_none():
                folder.parent_id = None
                folder.path = f"/{folder.name}/"

        folder.is_deleted = False
        folder.deleted_at = None
        db.add(folder)

        # Restore descendant folders
        desc_stmt = select(Folder).where(
            Folder.user_id == user.id,
            Folder.path.startswith(folder.path),
            Folder.is_deleted == True,
        )
        desc_res = await db.execute(desc_stmt)
        for desc in desc_res.scalars().all():
            desc.is_deleted = False
            desc.deleted_at = None
            db.add(desc)

        # Restore all files in restored hierarchy
        files_stmt = select(File).where(
            File.user_id == user.id,
            File.is_deleted == True,
        )
        files_res = await db.execute(files_stmt)
        total_restored_bytes = 0
        restored_files = []

        # Find which files belong to this folder tree
        valid_folder_ids = {folder.id} | {d.id for d in desc_res.scalars().all()}
        for f in files_res.scalars().all():
            if f.folder_id in valid_folder_ids:
                total_restored_bytes += f.size_bytes
                restored_files.append(f)

        # Quota check
        if user.storage_used_bytes + total_restored_bytes > user.storage_quota_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot restore folder: storage quota would be exceeded.",
            )

        for f in restored_files:
            f.is_deleted = False
            f.deleted_at = None
            db.add(f)

        user.storage_used_bytes += total_restored_bytes
        db.add(user)

        activity = ActivityLog(
            user_id=user.id,
            action="restore_folder",
            entity_type="folder",
            entity_name=folder.name,
            entity_id=folder.id,
        )
        db.add(activity)

        await db.commit()
        await db.refresh(folder)
        return folder

    @staticmethod
    async def purge_file(db: AsyncSession, user: User, file_id: str) -> bool:
        """Permanently purges a file from disk/S3 and deletes its database record."""
        stmt = select(File).where(File.id == file_id, File.user_id == user.id)
        res = await db.execute(stmt)
        file = res.scalar_one_or_none()
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="File not found."
            )

        storage = get_storage_service()

        # Delete physical storage for all revisions
        vers_stmt = select(FileVersion).where(FileVersion.file_id == file.id)
        vers_res = await db.execute(vers_stmt)
        for v in vers_res.scalars().all():
            try:
                await storage.delete_file(v.storage_key)
            except Exception:
                pass

        try:
            await storage.delete_file(file.storage_key)
        except Exception:
            pass

        # If file was not yet marked deleted when purged, deduct quota
        if not file.is_deleted:
            user.storage_used_bytes = max(0, user.storage_used_bytes - file.size_bytes)
            db.add(user)

        await db.delete(file)
        await db.commit()
        return True

    @staticmethod
    async def purge_folder(db: AsyncSession, user: User, folder_id: str) -> bool:
        """Permanently purges a folder and all its descendant files and subfolders."""
        stmt = select(Folder).where(Folder.id == folder_id, Folder.user_id == user.id)
        res = await db.execute(stmt)
        folder = res.scalar_one_or_none()
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found."
            )

        storage = get_storage_service()

        # Find all descendant folders
        desc_stmt = select(Folder).where(
            Folder.user_id == user.id,
            Folder.path.startswith(folder.path),
        )
        desc_res = await db.execute(desc_stmt)
        all_folder_ids = [folder.id] + [d.id for d in desc_res.scalars().all()]

        # Find and purge all files in these folders
        files_stmt = select(File).where(
            File.user_id == user.id,
            File.folder_id.in_(all_folder_ids),
        )
        files_res = await db.execute(files_stmt)
        for f in files_res.scalars().all():
            # Purge versions
            vers_stmt = select(FileVersion).where(FileVersion.file_id == f.id)
            vers_res = await db.execute(vers_stmt)
            for v in vers_res.scalars().all():
                try:
                    await storage.delete_file(v.storage_key)
                except Exception:
                    pass
            try:
                await storage.delete_file(f.storage_key)
            except Exception:
                pass
            if not f.is_deleted:
                user.storage_used_bytes = max(0, user.storage_used_bytes - f.size_bytes)
                db.add(user)
            await db.delete(f)

        # Delete folders
        for d in desc_res.scalars().all():
            await db.delete(d)
        await db.delete(folder)

        await db.commit()
        return True
