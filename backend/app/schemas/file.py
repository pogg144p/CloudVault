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
