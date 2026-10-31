import secrets
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash, verify_password
from app.models.activity import ActivityLog
from app.models.file import File
from app.models.folder import Folder
from app.models.share import Share
from app.schemas.share import PublicShareItemResponse, ShareCreate, ShareResponse, ShareUpdate


class ShareService:
    @staticmethod
    async def create_share(
        db: AsyncSession, user_id: str, share_in: ShareCreate
    ) -> ShareResponse:
        if not share_in.file_id and not share_in.folder_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either file_id or folder_id must be provided to create a share.",
            )
        if share_in.file_id and share_in.folder_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A share cannot link to both a file and a folder simultaneously.",
            )

        # Validate existence & ownership
        entity_name = "Item"
        if share_in.file_id:
            f_stmt = select(File).where(
                File.id == share_in.file_id,
                File.user_id == user_id,
                File.is_deleted == False,
            )
            f_res = await db.execute(f_stmt)
            file_item = f_res.scalar_one_or_none()
            if not file_item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="File not found."
                )
            entity_name = file_item.name
        else:
            fol_stmt = select(Folder).where(
                Folder.id == share_in.folder_id,
                Folder.user_id == user_id,
                Folder.is_deleted == False,
            )
            fol_res = await db.execute(fol_stmt)
            fol_item = fol_res.scalar_one_or_none()
            if not fol_item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found."
                )
            entity_name = fol_item.name

        pw_hash = get_password_hash(share_in.password) if share_in.password else None
        token = secrets.token_urlsafe(32)

        share = Share(
            share_token=token,
            created_by=user_id,
            file_id=share_in.file_id,
            folder_id=share_in.folder_id,
            permission=share_in.permission,
            password_hash=pw_hash,
            expires_at=share_in.expires_at,
            shared_with_email=share_in.shared_with_email,
        )
        db.add(share)
        await db.flush()

        # Log share activity
        activity = ActivityLog(
            user_id=user_id,
            action="create_share",
            entity_type="share",
            entity_name=f"Shared {entity_name} ({share_in.permission})",
            entity_id=share.id,
        )
        db.add(activity)

        await db.commit()
        await db.refresh(share)

        return ShareResponse(
            id=share.id,
            share_token=share.share_token,
            created_by=share.created_by,
            file_id=share.file_id,
            folder_id=share.folder_id,
            permission=share.permission,
            has_password=bool(share.password_hash),
            expires_at=share.expires_at,
            shared_with_email=share.shared_with_email,
            created_at=share.created_at,
        )

    @staticmethod
    async def list_user_shares(db: AsyncSession, user_id: str) -> List[ShareResponse]:
        stmt = (
            select(Share)
            .where(Share.created_by == user_id)
            .order_by(Share.created_at.desc())
        )
        res = await db.execute(stmt)
        shares = res.scalars().all()
        return [
            ShareResponse(
                id=s.id,
                share_token=s.share_token,
                created_by=s.created_by,
                file_id=s.file_id,
                folder_id=s.folder_id,
                permission=s.permission,
                has_password=bool(s.password_hash),
                expires_at=s.expires_at,
                shared_with_email=s.shared_with_email,
                created_at=s.created_at,
            )
            for s in shares
        ]

    @staticmethod
    async def revoke_share(db: AsyncSession, user_id: str, share_id: str) -> bool:
        stmt = select(Share).where(Share.id == share_id, Share.created_by == user_id)
        res = await db.execute(stmt)
        share = res.scalar_one_or_none()
        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found."
            )
        await db.delete(share)
        await db.commit()
        return True

    @staticmethod
    async def get_public_share(
        db: AsyncSession, share_token: str, password: Optional[str] = None
    ) -> PublicShareItemResponse:
        stmt = select(Share).where(Share.share_token == share_token)
        res = await db.execute(stmt)
        share = res.scalar_one_or_none()

        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shared link is invalid or has been revoked.",
            )

        now = datetime.now(timezone.utc)
        if share.expires_at:
            # Handle tz-aware comparison
            exp = share.expires_at if share.expires_at.tzinfo else share.expires_at.replace(tzinfo=timezone.utc)
            if now > exp:
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail="This shared link has expired.",
                )

        has_password = bool(share.password_hash)

        # If protected by password and either no password provided or incorrect password:
        if has_password:
            if not password:
                return PublicShareItemResponse(
                    share_token=share.share_token,
                    permission=share.permission,
                    is_expired=False,
                    requires_password=True,
                    item_type="file" if share.file_id else "folder",
                    item_name=None,
                    item_size_bytes=None,
                    item_mime_type=None,
                    expires_at=share.expires_at,
                    created_at=share.created_at,
                )
            if not verify_password(password, share.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect password for this protected share link.",
                )

        # Unlocked: fetch item metadata
        item_name = "Untitled"
        item_size = 0
        item_mime = "application/octet-stream"
        item_id = None

        if share.file_id:
            f_stmt = select(File).where(File.id == share.file_id, File.is_deleted == False)
            f_res = await db.execute(f_stmt)
            file_item = f_res.scalar_one_or_none()
            if not file_item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="The shared file was deleted or is no longer available.",
                )
            item_name = file_item.name
            item_size = file_item.size_bytes
            item_mime = file_item.mime_type
            item_id = file_item.id
        elif share.folder_id:
            fol_stmt = select(Folder).where(Folder.id == share.folder_id, Folder.is_deleted == False)
            fol_res = await db.execute(fol_stmt)
            fol_item = fol_res.scalar_one_or_none()
            if not fol_item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="The shared folder was deleted or is no longer available.",
                )
            item_name = fol_item.name
            item_id = fol_item.id

        return PublicShareItemResponse(
            share_token=share.share_token,
            permission=share.permission,
            is_expired=False,
            requires_password=False,
            item_type="file" if share.file_id else "folder",
            item_id=item_id,
            item_name=item_name,
            item_size_bytes=item_size,
            item_mime_type=item_mime,
            expires_at=share.expires_at,
            created_at=share.created_at,
        )
