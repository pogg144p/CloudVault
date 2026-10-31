from datetime import datetime, timezone
from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.models.file import File
from app.models.folder import Folder
from app.models.user import User
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    MonthlyUsageStat,
    StorageBreakdown,
    StorageUsageResponse,
)
from app.schemas.file import FileResponse
from app.schemas.folder import FolderResponse

router = APIRouter()


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Returns aggregated stats, storage meter, quick access, and recent files for the user dashboard."""
    # 1. Fetch user's non-deleted folders
    stmt_folders = (
        select(Folder)
        .where(Folder.user_id == current_user.id, Folder.is_deleted == False)
        .order_by(Folder.created_at.asc())
    )
    folders_res = await db.execute(stmt_folders)
    folders = folders_res.scalars().all()

    # 2. Fetch user's non-deleted files
    stmt_files = (
        select(File)
        .where(File.user_id == current_user.id, File.is_deleted == False)
        .order_by(File.created_at.desc())
    )
    files_res = await db.execute(stmt_files)
    files = files_res.scalars().all()

    # 3. Categorize storage usage
    mime_breakdowns = {
        "Images": {"bytes": 0, "count": 0, "color": "#F43F5E", "types": ["image/"]},
        "Documents": {"bytes": 0, "count": 0, "color": "#10B981", "types": ["application/pdf", "text/", "application/msword", "officedocument"]},
        "Videos": {"bytes": 0, "count": 0, "color": "#8B5CF6", "types": ["video/"]},
        "Music": {"bytes": 0, "count": 0, "color": "#F59E0B", "types": ["audio/"]},
        "Others": {"bytes": 0, "count": 0, "color": "#6B7280", "types": []},
    }

    for f in files:
        matched = False
        for cat_name, cat_data in mime_breakdowns.items():
            if cat_name != "Others":
                if any(t in f.mime_type.lower() for t in cat_data["types"]):
                    cat_data["bytes"] += f.size_bytes
                    cat_data["count"] += 1
                    matched = True
                    break
        if not matched:
            mime_breakdowns["Others"]["bytes"] += f.size_bytes
            mime_breakdowns["Others"]["count"] += 1

    storage_breakdowns: List[StorageBreakdown] = [
        StorageBreakdown(
            category=cat,
            total_bytes=data["bytes"],
            files_count=data["count"],
            color=data["color"],
        )
        for cat, data in mime_breakdowns.items()
    ]

    total_used = sum(b.total_bytes for b in storage_breakdowns)
    free_bytes = max(0, current_user.storage_quota_bytes - total_used)
    pct = (
        round((total_used / current_user.storage_quota_bytes) * 100, 2)
        if current_user.storage_quota_bytes > 0
        else 0.0
    )

    storage_resp = StorageUsageResponse(
        quota_bytes=current_user.storage_quota_bytes,
        used_bytes=total_used,
        free_bytes=free_bytes,
        percentage_used=pct,
        breakdown=storage_breakdowns,
    )

    # 4. Quick Access (favorites + top recent)
    quick_access = [f for f in files if f.is_favorite][:6]
    if len(quick_access) < 3:
        for f in files[:6]:
            if f not in quick_access:
                quick_access.append(f)
            if len(quick_access) >= 6:
                break

    # 5. Monthly sample data for the stats bar chart
    months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"]
    monthly_stats = [
        MonthlyUsageStat(month=m, uploaded_bytes=1024 * 1024 * (100 * (i + 1)), uploaded_files_count=10 * (i + 1))
        for i, m in enumerate(months)
    ]

    return DashboardSummaryResponse(
        storage=storage_resp,
        recent_files=[FileResponse.model_validate(f) for f in files[:10]],
        quick_access=[FileResponse.model_validate(f) for f in quick_access],
        folder_categories=[FolderResponse.model_validate(fol) for fol in folders[:4]],
        monthly_stats=monthly_stats,
    )
