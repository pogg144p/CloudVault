import os
import asyncio
from typing import Optional
from PIL import Image
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.file import File
from app.services.storage_service import get_storage_service


class ThumbnailService:
    @staticmethod
    def create_image_thumbnail(physical_src_path: str, physical_dest_path: str, max_size: tuple = (320, 320)) -> bool:
        """Synchronously processes and downsamples an image to a web-optimized thumbnail."""
        try:
            with Image.open(physical_src_path) as img:
                # Convert RGBA / P palette images to RGB for clean JPEG output
                if img.mode in ("RGBA", "P", "LA"):
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    if img.mode == "P":
                        img = img.convert("RGBA")
                    background.paste(img, mask=img.split()[-1] if "A" in img.mode else None)
                    img = background
                elif img.mode != "RGB":
                    img = img.convert("RGB")

                img.thumbnail(max_size, Image.Resampling.LANCZOS)
                os.makedirs(os.path.dirname(physical_dest_path), exist_ok=True)
                img.save(physical_dest_path, "JPEG", quality=85, optimize=True)
                return True
        except Exception as e:
            print(f"[ThumbnailService] Warning: Failed to generate thumbnail: {e}")
            return False

    @staticmethod
    async def process_thumbnail_async(file_id: str, storage_key: str, mime_type: str) -> Optional[str]:
        """Background worker task: generates thumbnail and updates database record."""
        if not mime_type.startswith("image/"):
            return None

        storage = get_storage_service()
        src_path = storage.get_file_path(storage_key)
        if not os.path.exists(src_path):
            return None

        thumb_storage_key = f"{storage_key}_thumb.jpg"
        dest_path = storage.get_file_path(thumb_storage_key)

        # Offload CPU-bound image manipulation to thread pool
        success = await asyncio.to_thread(
            ThumbnailService.create_image_thumbnail, src_path, dest_path
        )

        if success:
            thumbnail_url = f"/api/v1/files/{file_id}/thumbnail"
            # Update database record
            try:
                async with AsyncSessionLocal() as session:
                    stmt = select(File).where(File.id == file_id)
                    res = await session.execute(stmt)
                    file = res.scalar_one_or_none()
                    if file:
                        file.thumbnail_url = thumbnail_url
                        session.add(file)
                        await session.commit()
                        print(f"[ThumbnailService] Created thumbnail for file {file.name}")
                return thumbnail_url
            except Exception as e:
                print(f"[ThumbnailService] Failed to update file thumbnail in DB: {e}")

        return None
