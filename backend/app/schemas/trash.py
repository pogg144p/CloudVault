from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.file import FileResponse
from app.schemas.folder import FolderResponse


class TrashItemResponse(BaseModel):
    id: str
    name: str
    type: str  # 'file' or 'folder'
    size_bytes: int
    deleted_at: Optional[datetime] = None
    original_folder_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TrashListResponse(BaseModel):
    files: List[FileResponse]
    folders: List[FolderResponse]


class RestoreRequest(BaseModel):
    item_id: str
    item_type: str  # 'file' or 'folder'


class PurgeRequest(BaseModel):
    item_id: str
    item_type: str  # 'file' or 'folder'
