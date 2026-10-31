from typing import List, Optional
from pydantic import BaseModel
from app.schemas.file import FileResponse
from app.schemas.folder import FolderResponse


class StorageBreakdown(BaseModel):
    category: str  # Images, Documents, Videos, Audio, Others
    total_bytes: int
    files_count: int
    color: str


class StorageUsageResponse(BaseModel):
    quota_bytes: int
    used_bytes: int
    free_bytes: int
    percentage_used: float
    breakdown: List[StorageBreakdown]


class MonthlyUsageStat(BaseModel):
    month: str
    uploaded_bytes: int
    uploaded_files_count: int


class DashboardSummaryResponse(BaseModel):
    storage: StorageUsageResponse
    recent_files: List[FileResponse]
    quick_access: List[FileResponse]
    folder_categories: List[FolderResponse]
    monthly_stats: List[MonthlyUsageStat]
