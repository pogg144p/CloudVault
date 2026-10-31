from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.file import FileResponse


class FolderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_id: Optional[str] = None
    color: Optional[str] = "#4F46E5"


class FolderCreate(FolderBase):
    pass


class FolderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    parent_id: Optional[str] = None
    color: Optional[str] = None
    is_favorite: Optional[bool] = None


class FolderResponse(FolderBase):
    id: str
    user_id: str
    path: str
    is_favorite: bool
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    files_count: Optional[int] = 0
    total_size_bytes: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


class BreadcrumbItem(BaseModel):
    id: Optional[str] = None
    name: str
    path: str


class FolderDetailResponse(BaseModel):
    folder: Optional[FolderResponse] = None
    breadcrumbs: List[BreadcrumbItem]
    subfolders: List[FolderResponse]
    files: List[FileResponse]
