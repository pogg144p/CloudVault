from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityLog
from app.models.file import File
from app.models.folder import Folder
from app.schemas.folder import BreadcrumbItem, FolderCreate, FolderUpdate


class FolderService:
    @staticmethod
    async def create_folder(
        db: AsyncSession, user_id: str, folder_in: FolderCreate
    ) -> Folder:
        # Validate parent folder if specified
        parent_path = "/"
        if folder_in.parent_id:
            parent_stmt = select(Folder).where(
                Folder.id == folder_in.parent_id,
                Folder.user_id == user_id,
                Folder.is_deleted == False,
            )
            parent_res = await db.execute(parent_stmt)
            parent = parent_res.scalar_one_or_none()
            if not parent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Parent folder not found.",
                )
            parent_path = parent.path

        cleaned_name = folder_in.name.strip().replace("/", "-")
        target_path = f"{parent_path}{cleaned_name}/"

        # Check for duplicate folder name in same parent
        dup_stmt = select(Folder).where(
            Folder.user_id == user_id,
            Folder.parent_id == folder_in.parent_id,
            Folder.name == cleaned_name,
            Folder.is_deleted == False,
        )
        dup_res = await db.execute(dup_stmt)
        if dup_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A folder named '{cleaned_name}' already exists in this directory.",
            )

        new_folder = Folder(
            user_id=user_id,
            parent_id=folder_in.parent_id,
            name=cleaned_name,
            path=target_path,
            color=folder_in.color or "#4F46E5",
        )
        db.add(new_folder)
        await db.flush()

        # Log activity
        activity = ActivityLog(
            user_id=user_id,
            action="create_folder",
            entity_type="folder",
            entity_name=cleaned_name,
            entity_id=new_folder.id,
        )
        db.add(activity)
        await db.commit()
        await db.refresh(new_folder)
        return new_folder

    @staticmethod
    async def get_breadcrumbs(
        db: AsyncSession, user_id: str, folder: Optional[Folder]
    ) -> List[BreadcrumbItem]:
        crumbs = [BreadcrumbItem(id=None, name="All Files", path="/")]
        if not folder:
            return crumbs

        # Traverse up hierarchy to collect trail
        trail = []
        curr = folder
        while curr:
            trail.append(BreadcrumbItem(id=curr.id, name=curr.name, path=curr.path))
            if curr.parent_id:
                p_stmt = select(Folder).where(
                    Folder.id == curr.parent_id,
                    Folder.user_id == user_id,
                    Folder.is_deleted == False,
                )
                p_res = await db.execute(p_stmt)
                curr = p_res.scalar_one_or_none()
            else:
                curr = None

        trail.reverse()
        return crumbs + trail

    @staticmethod
    async def list_folders(
        db: AsyncSession, user_id: str, parent_id: Optional[str] = None
    ) -> List[Folder]:
        stmt = (
            select(Folder)
            .where(
                Folder.user_id == user_id,
                Folder.parent_id == parent_id,
                Folder.is_deleted == False,
            )
            .order_by(Folder.name.asc())
        )
        result = await db.execute(stmt)
        folders = result.scalars().all()

        # Compute file counts & total size per folder
        enriched = []
        for f in folders:
            count_stmt = select(
                func.count(File.id), func.coalesce(func.sum(File.size_bytes), 0)
            ).where(
                File.folder_id == f.id,
                File.is_deleted == False,
            )
            count_res = await db.execute(count_stmt)
            count, size = count_res.one()
            f.files_count = count
            f.total_size_bytes = size
            enriched.append(f)

        return enriched

    @staticmethod
    async def rename_folder(
        db: AsyncSession, user_id: str, folder_id: str, update_in: FolderUpdate
    ) -> Folder:
        stmt = select(Folder).where(
            Folder.id == folder_id,
            Folder.user_id == user_id,
            Folder.is_deleted == False,
        )
        res = await db.execute(stmt)
        folder = res.scalar_one_or_none()
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found."
            )

        if update_in.color is not None:
            folder.color = update_in.color
        if update_in.is_favorite is not None:
            folder.is_favorite = update_in.is_favorite

        if update_in.name and update_in.name.strip() != folder.name:
            new_name = update_in.name.strip().replace("/", "-")
            old_path = folder.path

            # Determine new path
            parent_path = "/"
            if folder.parent_id:
                p_stmt = select(Folder).where(Folder.id == folder.parent_id)
                p_res = await db.execute(p_stmt)
                p = p_res.scalar_one_or_none()
                if p:
                    parent_path = p.path
            new_path = f"{parent_path}{new_name}/"

            folder.name = new_name
            folder.path = new_path

            # Update paths of all descendant folders
            desc_stmt = select(Folder).where(
                Folder.user_id == user_id,
                Folder.path.startswith(old_path),
                Folder.id != folder.id,
            )
            desc_res = await db.execute(desc_stmt)
            for desc in desc_res.scalars().all():
                desc.path = desc.path.replace(old_path, new_path, 1)
                db.add(desc)

        db.add(folder)
        await db.commit()
        await db.refresh(folder)
        return folder

    @staticmethod
    async def delete_folder(db: AsyncSession, user_id: str, folder_id: str) -> bool:
        stmt = select(Folder).where(
            Folder.id == folder_id,
            Folder.user_id == user_id,
            Folder.is_deleted == False,
        )
        res = await db.execute(stmt)
        folder = res.scalar_one_or_none()
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found."
            )

        now = datetime.now(timezone.utc)
        folder.is_deleted = True
        folder.deleted_at = now
        db.add(folder)

        # Soft-delete descendant folders
        desc_stmt = select(Folder).where(
            Folder.user_id == user_id,
            Folder.path.startswith(folder.path),
            Folder.is_deleted == False,
        )
        desc_res = await db.execute(desc_stmt)
        for desc in desc_res.scalars().all():
            desc.is_deleted = True
            desc.deleted_at = now
            db.add(desc)

            # Soft-delete files inside descendant folder
            files_stmt = select(File).where(
                File.folder_id == desc.id, File.is_deleted == False
            )
            files_res = await db.execute(files_stmt)
            for f in files_res.scalars().all():
                f.is_deleted = True
                f.deleted_at = now
                db.add(f)

        # Soft-delete direct files
        direct_files_stmt = select(File).where(
            File.folder_id == folder.id, File.is_deleted == False
        )
        direct_res = await db.execute(direct_files_stmt)
        for f in direct_res.scalars().all():
            f.is_deleted = True
            f.deleted_at = now
            db.add(f)

        await db.commit()
        return True
