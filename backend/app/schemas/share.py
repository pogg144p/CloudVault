from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ShareCreate(BaseModel):
    file_id: Optional[str] = None
    folder_id: Optional[str] = None
    permission: str = Field("view", pattern="^(view|download|edit)$")
    password: Optional[str] = None
    expires_at: Optional[datetime] = None
    shared_with_email: Optional[EmailStr] = None


class ShareUpdate(BaseModel):
    permission: Optional[str] = Field(None, pattern="^(view|download|edit)$")
    password: Optional[str] = None
    remove_password: Optional[bool] = False
    expires_at: Optional[datetime] = None


class ShareResponse(BaseModel):
    id: str
    share_token: str
    created_by: str
    file_id: Optional[str] = None
    folder_id: Optional[str] = None
    permission: str
    has_password: bool = False
    expires_at: Optional[datetime] = None
    shared_with_email: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ShareVerifyPassword(BaseModel):
    password: str


class PublicShareItemResponse(BaseModel):
    share_token: str
    permission: str
    is_expired: bool
    requires_password: bool
    item_type: str  # 'file' | 'folder'
    item_id: Optional[str] = None
    item_name: Optional[str] = None
    item_size_bytes: Optional[int] = None
    item_mime_type: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
