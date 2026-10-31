import sqlite3
import uuid
import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import init_db
from app.core.metrics import PrometheusMiddleware, metrics_endpoint_handler
from app.core.security import get_password_hash

tags_metadata = [
    {
        "name": "Authentication",
        "description": "🔐 User registration, secure Argon2id password verification, JWT token issuance and refresh.",
    },
    {
        "name": "Dashboard",
        "description": "📊 Real-time storage capacity, quota calculation, category breakdowns, and recent file telemetry.",
    },
    {
        "name": "Folders",
        "description": "📁 Hierarchical folder management with materialized paths (`/Design/Logos/`), breadcrumb trails, and cascade deletion.",
    },
    {
        "name": "Files",
        "description": "📄 Streaming multipart uploads, SHA-256 integrity checksum calculation, storage quota validation, and file downloads.",
    },
    {
        "name": "Shares",
        "description": "🔗 Public & private sharing links, permission control (`view` vs `download`), password protection, and token expiration handling.",
    },
    {
        "name": "Recycle Bin",
        "description": "🗑️ Soft delete recovery, file restoration, and permanent storage purge.",
    },
    {
        "name": "Users",
        "description": "👤 User profile settings and storage quota monitoring.",
    },
    {
        "name": "System",
        "description": "⚙️ System health checks and operational status.",
    },
]

API_DESCRIPTION = """
### ☁️ CloudVault API — Secure Cloud Storage & File Collaboration Platform

Welcome to the **CloudVault Interactive Backend Guide**. This API powers the entire CloudVault ecosystem — providing enterprise-grade authentication, storage abstraction (Local Disk & AWS S3), streaming uploads, and file collaboration.

---

### 🚀 Quick Testing Walkthrough (3 Steps)

1. **Step 1: Authenticate**
   - Open **`Authentication`** below $\\to$ select `POST /api/v1/auth/login`.
   - Click **Try it out** and use the pre-seeded demo credentials:
     - **Email:** `shakir260@gmail.com`
     - **Password:** `SecurePassword123!`
   - Click **Execute** and copy the returned `access_token`.

2. **Step 2: Authorize in Swagger**
   - Click the green **Authorize 🔓** button at the top right of this page.
   - Paste the token and click **Authorize**. All protected endpoints are now unlocked!

3. **Step 3: Try Operations**
   - **`GET /api/v1/dashboard/summary`**: View your storage usage & folders.
   - **`POST /api/v1/files/upload`**: Upload a real file directly through Swagger!
   - **`POST /api/v1/shares/`**: Generate an encrypted public share link with optional expiration & password.

---

### 🛡️ Security & Architecture Standards
- **Password Security:** Argon2id memory-hard hashing algorithm.
- **Session Tokens:** Cryptographically signed HMAC-SHA256 JWTs (Access + Refresh tokens).
- **Storage Engine:** Modular Storage Driver Pattern (swappable between Local disk and AWS S3).
- **Data Integrity:** Real-time SHA-256 checksum calculated on streaming file uploads.
"""


def ensure_demo_user():
    """Seeds the demo user AR Shakir if not present in the local database."""
    if settings.DATABASE_URL.startswith("sqlite"):
        try:
            db_path = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "")
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = 'shakir260@gmail.com'")
            if not cursor.fetchone():
                user_id = str(uuid.uuid4())
                now = datetime.datetime.now(datetime.timezone.utc).isoformat()
                pwd_hash = get_password_hash("SecurePassword123!")
                quota = settings.DEFAULT_STORAGE_QUOTA_BYTES

                cursor.execute("""
                    INSERT INTO users (id, email, full_name, hashed_password, avatar_url, storage_quota_bytes, storage_used_bytes, is_active, is_superuser, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (user_id, "shakir260@gmail.com", "AR Shakir", pwd_hash, None, quota, 0, 1, 0, now, now))

                for name, color in [("Design", "#6366F1"), ("Documents", "#10B981"), ("Music", "#F59E0B"), ("Images", "#EF4444")]:
                    cursor.execute("""
                        INSERT INTO folders (id, user_id, parent_id, name, path, color, is_favorite, is_deleted, deleted_at, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (str(uuid.uuid4()), user_id, None, name, f"/{name}/", color, 0, 0, None, now, now))

                conn.commit()
            conn.close()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler: runs database table initialization on startup."""
    await init_db()
    ensure_demo_user()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=API_DESCRIPTION,
    openapi_tags=tags_metadata,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus Telemetry Middleware
app.add_middleware(PrometheusMiddleware)


@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    """Centralized HTTP exception handler ensuring structured error JSON."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(Exception)
async def global_unhandled_exception_handler(request: Request, exc: Exception):
    """Fallback error handler catching unexpected server errors."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred. Our engineering team has been notified.",
            "status_code": 500,
        },
    )


# Mount API routers
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint to verify backend status and storage provider."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "storage_backend": settings.STORAGE_BACKEND,
    }


@app.get("/metrics", tags=["System"])
async def metrics():
    """Prometheus telemetry scrape endpoint."""
    return metrics_endpoint_handler()


@app.get("/", tags=["System"])
async def root():
    """Root navigation directory for CloudVault Backend API."""
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "status": "online",
        "storage_driver": settings.STORAGE_BACKEND,
        "documentation": {
            "interactive_swagger": f"{settings.API_V1_STR}/docs",
            "technical_spec_redoc": f"{settings.API_V1_STR}/redoc",
            "openapi_json": f"{settings.API_V1_STR}/openapi.json",
        },
        "endpoints_summary": {
            "auth": f"{settings.API_V1_STR}/auth",
            "dashboard": f"{settings.API_V1_STR}/dashboard",
            "folders": f"{settings.API_V1_STR}/folders",
            "files": f"{settings.API_V1_STR}/files",
            "shares": f"{settings.API_V1_STR}/shares",
            "users": f"{settings.API_V1_STR}/users",
        },
    }
