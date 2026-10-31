from fastapi import APIRouter
from app.api.v1.endpoints import auth, dashboard, files, folders, shares, trash, users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(folders.router, prefix="/folders", tags=["Folders"])
api_router.include_router(files.router, prefix="/files", tags=["Files"])
api_router.include_router(shares.router, prefix="/shares", tags=["Shares"])
api_router.include_router(trash.router, prefix="/trash", tags=["Recycle Bin"])
