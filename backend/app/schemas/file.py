from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class FileBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    folder_id: Optional[str] = None


class FileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    folder_id: Optional[str] = None
    is_favorite: Optional[bool] = None


class FileVersionResponse(BaseModel):
    id: str
    version_number: int
    size_bytes: int
    checksum_sha256: Optional[str] = None
    uploaded_by: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FileResponse(FileBase):
    id: str
    user_id: str
    mime_type: str
    size_bytes: int
    storage_key: str
    checksum_sha256: Optional[str] = None
    current_version: int
    thumbnail_url: Optional[str] = None
    is_favorite: bool
    is_deleted: bool
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FileDetailResponse(FileResponse):
    versions: List[FileVersionResponse] = []


class PresignedUploadRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    content_type: str = Field(default="application/octet-stream")
    size_bytes: int = Field(..., gt=0)
    folder_id: Optional[str] = None


class PresignedUrlResponse(BaseModel):
    upload_url: str
    storage_key: str
    method: str = "PUT"
    expires_in_seconds: int = 900
    headers: dict = {}


class PresignedDownloadResponse(BaseModel):
    download_url: str
    expires_in_seconds: int = 900


class PresignedConfirmRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    storage_key: str
    size_bytes: int = Field(..., gt=0)
    mime_type: Optional[str] = None
    folder_id: Optional[str] = None
