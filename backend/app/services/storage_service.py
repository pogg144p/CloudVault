import asyncio
from datetime import timedelta
import io
import os
from abc import ABC, abstractmethod
from typing import AsyncGenerator, BinaryIO
from urllib.parse import urlparse

import aiofiles
from minio import Minio
from minio.error import S3Error

from app.core.config import settings


class StorageService(ABC):
    """Abstract interface defining standard object storage operations."""

    @abstractmethod
    async def upload_file(self, file_obj: BinaryIO, storage_key: str) -> str:
        """Stores a file object and returns its unique storage key/path."""
        pass

    @abstractmethod
    async def delete_file(self, storage_key: str) -> bool:
        """Deletes a file identified by its storage key."""
        pass

    @abstractmethod
    def get_file_path(self, storage_key: str) -> str:
        """Returns the physical file system path (if local)."""
        pass

    @abstractmethod
    async def file_exists(self, storage_key: str) -> bool:
        """Checks if a file exists on the storage backend."""
        pass

    @abstractmethod
    async def get_file_stream(self, storage_key: str) -> AsyncGenerator[bytes, None]:
        """Streams file bytes asynchronously in chunks."""
        pass

    @abstractmethod
    def generate_presigned_upload_url(
        self, storage_key: str, expires_in: int = 900
    ) -> str:
        """Generates a pre-signed URL for direct client upload (PUT)."""
        pass

    @abstractmethod
    def generate_presigned_download_url(
        self, storage_key: str, expires_in: int = 900
    ) -> str:
        """Generates a pre-signed URL for direct client download (GET)."""
        pass


class LocalStorageService(StorageService):
    """Local disk storage implementation for development and offline testing."""

    def __init__(self, base_dir: str = settings.LOCAL_STORAGE_DIR):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    def get_file_path(self, storage_key: str) -> str:
        safe_key = storage_key.lstrip("/\\")
        return os.path.join(self.base_dir, safe_key)

    async def upload_file(self, file_obj: BinaryIO, storage_key: str) -> str:
        full_path = self.get_file_path(storage_key)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        chunk_size = 1024 * 1024
        async with aiofiles.open(full_path, "wb") as f:
            while chunk := file_obj.read(chunk_size):
                await f.write(chunk)

        return storage_key

    async def delete_file(self, storage_key: str) -> bool:
        full_path = self.get_file_path(storage_key)
        if os.path.exists(full_path):
            os.remove(full_path)
            return True
        return False

    async def file_exists(self, storage_key: str) -> bool:
        full_path = self.get_file_path(storage_key)
        return os.path.exists(full_path)

    async def get_file_stream(self, storage_key: str) -> AsyncGenerator[bytes, None]:
        full_path = self.get_file_path(storage_key)
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"File {storage_key} not found")

        chunk_size = 1024 * 1024
        async with aiofiles.open(full_path, "rb") as f:
            while chunk := await f.read(chunk_size):
                yield chunk

    def generate_presigned_upload_url(
        self, storage_key: str, expires_in: int = 900
    ) -> str:
        return f"{settings.API_V1_STR}/files/upload"

    def generate_presigned_download_url(
        self, storage_key: str, expires_in: int = 900
    ) -> str:
        return f"{settings.API_V1_STR}/files/raw/{storage_key}"


class S3StorageService(StorageService):
    """Universal S3-compatible cloud storage driver (Supabase, AWS S3, Cloudflare R2, MinIO)."""

    def __init__(self):
        endpoint = settings.S3_ENDPOINT_URL.strip()
        path_prefix = ""
        if endpoint.startswith("http://") or endpoint.startswith("https://"):
            parsed = urlparse(endpoint)
            self.endpoint = parsed.netloc
            self.secure = parsed.scheme == "https"
            path_prefix = parsed.path.rstrip("/")
        else:
            self.endpoint = endpoint
            self.secure = settings.S3_SECURE

        self.bucket = settings.S3_BUCKET_NAME
        self.client = Minio(
            endpoint=self.endpoint,
            access_key=settings.S3_ACCESS_KEY,
            secret_key=settings.S3_SECRET_KEY,
            secure=self.secure,
            region=settings.S3_REGION,
        )

        # Support sub-paths for services like Supabase Storage (/storage/v1/s3)
        if path_prefix:
            from minio.helpers import url_replace
            orig_build = self.client._base_url.build
            endpoint_host = self.endpoint

            def custom_build(
                method,
                region,
                bucket_name=None,
                object_name=None,
                query_params=None,
            ):
                res = orig_build(
                    method=method,
                    region=region,
                    bucket_name=bucket_name,
                    object_name=object_name,
                    query_params=query_params,
                )
                clean_path = res.path if res.path.startswith("/") else f"/{res.path}"
                new_path = f"{path_prefix}{clean_path}"
                return url_replace(url=res, netloc=endpoint_host, path=new_path)

            self.client._base_url.build = custom_build

        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self):
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
        except Exception as e:
            # When using providers like Supabase, buckets may be created in web console
            print(f"[S3StorageService] Bucket check: {e}")

    def get_file_path(self, storage_key: str) -> str:
        # Fallback local path for thumbnail generation
        cache_dir = os.path.join(settings.LOCAL_STORAGE_DIR, "_cloud_cache")
        os.makedirs(cache_dir, exist_ok=True)
        safe_name = storage_key.replace("/", "_")
        local_cached = os.path.join(cache_dir, safe_name)
        if not os.path.exists(local_cached):
            try:
                self.client.fget_object(self.bucket, storage_key, local_cached)
            except Exception:
                pass
        return local_cached

    async def upload_file(self, file_obj: BinaryIO, storage_key: str) -> str:
        file_obj.seek(0, os.SEEK_END)
        size = file_obj.tell()
        file_obj.seek(0)

        # Upload in thread pool to prevent blocking asyncio event loop
        await asyncio.to_thread(
            self.client.put_object,
            bucket_name=self.bucket,
            object_name=storage_key,
            data=file_obj,
            length=size,
        )
        return storage_key

    async def delete_file(self, storage_key: str) -> bool:
        try:
            await asyncio.to_thread(
                self.client.remove_object,
                bucket_name=self.bucket,
                object_name=storage_key,
            )
            return True
        except Exception:
            return False

    async def file_exists(self, storage_key: str) -> bool:
        try:
            await asyncio.to_thread(
                self.client.stat_object,
                bucket_name=self.bucket,
                object_name=storage_key,
            )
            return True
        except Exception:
            return False

    async def get_file_stream(self, storage_key: str) -> AsyncGenerator[bytes, None]:
        try:
            response = await asyncio.to_thread(
                self.client.get_object,
                bucket_name=self.bucket,
                object_name=storage_key,
            )
        except S3Error as e:
            raise FileNotFoundError(f"S3 Object {storage_key} not found: {e}")

        chunk_size = 1024 * 1024
        try:
            while True:
                chunk = await asyncio.to_thread(response.read, chunk_size)
                if not chunk:
                    break
                yield chunk
        finally:
            response.close()
            response.release_conn()

    def generate_presigned_upload_url(
        self, storage_key: str, expires_in: int = 900
    ) -> str:
        return self.client.presigned_put_object(
            bucket_name=self.bucket,
            object_name=storage_key,
            expires=timedelta(seconds=expires_in),
        )

    def generate_presigned_download_url(
        self, storage_key: str, expires_in: int = 900
    ) -> str:
        return self.client.presigned_get_object(
            bucket_name=self.bucket,
            object_name=storage_key,
            expires=timedelta(seconds=expires_in),
        )


# Factory to return active storage backend
_storage_instance: StorageService | None = None


def get_storage_service() -> StorageService:
    global _storage_instance
    if _storage_instance is None:
        if settings.STORAGE_BACKEND.lower() == "s3":
            _storage_instance = S3StorageService()
        else:
            _storage_instance = LocalStorageService()
    return _storage_instance
