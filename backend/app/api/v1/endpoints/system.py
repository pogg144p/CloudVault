import asyncio
import io
import os
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.metrics import REQUEST_COUNT, REQUEST_LATENCY, FILE_UPLOAD_BYTES
from app.services.storage_service import get_storage_service

router = APIRouter()
START_TIME = time.time()


@router.get("/health", status_code=status.HTTP_200_OK)
async def get_system_health(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Comprehensive site health monitoring endpoint:
    Checks Database, S3/MinIO Storage, Redis, and Prometheus telemetry metrics.
    """
    uptime_seconds = int(time.time() - START_TIME)

    # 1. Database Health Check
    db_status = "unhealthy"
    db_latency_ms = 0.0
    try:
        t0 = time.time()
        res = await db.execute(text("SELECT 1"))
        res.scalar()
        db_latency_ms = round((time.time() - t0) * 1000, 2)
        db_status = "healthy"
    except Exception as e:
        db_status = f"error: {str(e)[:50]}"

    # 2. Storage Health Check
    storage_status = "unhealthy"
    storage_latency_ms = 0.0
    storage = get_storage_service()
    try:
        t0 = time.time()
        # Non-destructive check (file_exists on sentinel key)
        await storage.file_exists("__healthcheck_sentinel__")
        storage_latency_ms = round((time.time() - t0) * 1000, 2)
        storage_status = "healthy"
    except Exception as e:
        storage_status = f"error: {str(e)[:50]}"

    # 3. Redis / Cache Health Check
    redis_status = "standby"
    redis_latency_ms = 0.0
    redis_url = getattr(settings, "REDIS_URL", "redis://localhost:6379/0")
    try:
        # Quick TCP ping check to Redis port
        host = "localhost"
        port = 6379
        if "://" in redis_url:
            clean = redis_url.split("://")[1].split("/")[0]
            if ":" in clean:
                host, port_str = clean.split(":")
                port = int(port_str)
            else:
                host = clean

        t0 = time.time()
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=0.8
        )
        writer.close()
        await writer.wait_closed()
        redis_latency_ms = round((time.time() - t0) * 1000, 2)
        redis_status = "healthy"
    except Exception:
        # In local dev without Redis container, mark as standby
        redis_status = "standby"

    # 4. Prometheus Metric Aggregation
    total_requests = 0
    status_2xx = 0
    status_4xx = 0
    status_5xx = 0

    try:
        for metric in REQUEST_COUNT.collect():
            for sample in metric.samples:
                if sample.name == "cloudvault_http_requests_total":
                    val = int(sample.value)
                    total_requests += val
                    sc = sample.labels.get("status_code", "")
                    if sc.startswith("2"):
                        status_2xx += val
                    elif sc.startswith("4"):
                        status_4xx += val
                    elif sc.startswith("5"):
                        status_5xx += val
    except Exception:
        pass

    overall_status = "healthy" if (db_status == "healthy" and storage_status == "healthy") else "degraded"

    return {
        "status": overall_status,
        "environment": settings.ENVIRONMENT,
        "uptime_seconds": uptime_seconds,
        "timestamp": time.time(),
        "services": {
            "api": {
                "name": "FastAPI Web Service",
                "status": "healthy",
                "version": settings.VERSION,
                "port": 8000,
            },
            "database": {
                "name": "PostgreSQL Database",
                "status": db_status,
                "latency_ms": db_latency_ms,
                "port": 5432,
            },
            "storage": {
                "name": f"Object Storage ({settings.STORAGE_BACKEND.upper()})",
                "status": storage_status,
                "latency_ms": storage_latency_ms,
                "driver": settings.STORAGE_BACKEND,
                "bucket": settings.S3_BUCKET_NAME,
            },
            "cache": {
                "name": "Redis In-Memory Broker",
                "status": redis_status,
                "latency_ms": redis_latency_ms,
                "port": 6379,
            },
        },
        "telemetry": {
            "total_requests": total_requests,
            "status_2xx": status_2xx,
            "status_4xx": status_4xx,
            "status_5xx": status_5xx,
            "error_rate_pct": round((status_5xx / max(1, total_requests)) * 100, 2),
        },
        "links": {
            "prometheus": "http://localhost:9090",
            "grafana": "http://localhost:3001",
            "minio": "http://localhost:9001",
            "swagger": f"{settings.API_V1_STR}/docs",
        },
    }


@router.post("/simulate/burst", status_code=status.HTTP_200_OK)
async def simulate_traffic_burst(count: int = 20) -> Dict[str, Any]:
    """
    Interactive DevOps Simulation:
    Fires simulated requests to exercise telemetry metrics and watch Prometheus graphs react in real-time.
    """
    count = min(max(1, count), 100)
    for _ in range(count):
        REQUEST_COUNT.labels(method="GET", endpoint="/api/v1/files", status_code=200).inc()
        REQUEST_LATENCY.labels(method="GET", endpoint="/api/v1/files").observe(0.045)

    return {
        "message": f"Successfully injected {count} simulated HTTP requests into telemetry pipeline.",
        "simulated_endpoint": "/api/v1/files",
        "injected_count": count,
    }


@router.post("/simulate/latency", status_code=status.HTTP_200_OK)
async def simulate_latency_spike() -> Dict[str, Any]:
    """
    Interactive DevOps Simulation:
    Injects an artificial latency delay to demonstrate P95/P99 latency threshold alerting.
    """
    t0 = time.time()
    await asyncio.sleep(0.35)  # 350ms sleep
    duration = time.time() - t0

    REQUEST_COUNT.labels(method="GET", endpoint="/api/v1/files/heavy-query", status_code=200).inc()
    REQUEST_LATENCY.labels(method="GET", endpoint="/api/v1/files/heavy-query").observe(duration)

    return {
        "message": "Injected artificial latency spike into telemetry stream.",
        "measured_duration_ms": round(duration * 1000, 2),
        "target_metric": "cloudvault_http_request_duration_seconds",
    }


@router.post("/simulate/error", status_code=status.HTTP_200_OK)
async def simulate_fault_injection() -> Dict[str, Any]:
    """
    Interactive DevOps Simulation:
    Emits simulated 500 error events to test SLA alert rules (HighHttp5xxErrorRate).
    """
    for _ in range(3):
        REQUEST_COUNT.labels(method="POST", endpoint="/api/v1/files/upload", status_code=500).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/api/v1/files/upload").observe(0.12)

    return {
        "message": "Injected 3 simulated HTTP 500 Internal Server Error events into Prometheus collector.",
        "simulated_error": "HighHttp5xxErrorRate (Testing Alertmanager rule)",
    }


@router.post("/simulate/storage-roundtrip", status_code=status.HTTP_200_OK)
async def simulate_storage_roundtrip() -> Dict[str, Any]:
    """
    Interactive DevOps Simulation:
    Executes a live 10KB write-then-delete roundtrip test to verify Object Storage read/write health.
    """
    storage = get_storage_service()
    test_key = f"__diagnostic_test_{int(time.time())}.tmp"
    payload = b"CloudVault DevOps Automated Diagnostic Test Block " * 200

    t_write_start = time.time()
    await storage.upload_file(io.BytesIO(payload), test_key)
    write_ms = round((time.time() - t_write_start) * 1000, 2)

    t_verify_start = time.time()
    exists = await storage.file_exists(test_key)
    verify_ms = round((time.time() - t_verify_start) * 1000, 2)

    t_delete_start = time.time()
    await storage.delete_file(test_key)
    delete_ms = round((time.time() - t_delete_start) * 1000, 2)

    FILE_UPLOAD_BYTES.inc(len(payload))

    return {
        "storage_mode": settings.STORAGE_BACKEND,
        "write_latency_ms": write_ms,
        "verify_latency_ms": verify_ms,
        "delete_latency_ms": delete_ms,
        "total_roundtrip_ms": round(write_ms + verify_ms + delete_ms, 2),
        "payload_bytes": len(payload),
        "status": "PASSED" if exists else "FAILED",
    }


# ─── Remote Cloud Site Probing & Multi-Environment Monitoring ───

class ProbeRequest(BaseModel):
    url: str = Field(..., min_length=4)
    timeout: float = Field(default=12.0, ge=1.0, le=45.0)


class TargetProbeResult(BaseModel):
    id: str
    name: str
    url: str
    environment: str  # "cloud" or "local"
    status: str       # "healthy", "degraded", "sleeping", "down"
    status_code: int
    latency_ms: float
    is_ssl: bool
    is_cold_start: bool
    server: str
    error: Optional[str] = None
    timestamp: float


def _sync_http_probe(target_url: str, timeout: float = 12.0) -> Dict[str, Any]:
    """Execute synchronous HTTP/HTTPS probe with latency measurement."""
    t0 = time.time()
    req = urllib.request.Request(
        target_url,
        headers={"User-Agent": "CloudVault-DevOps-Monitor/2.0"},
    )
    is_ssl = target_url.startswith("https://")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            latency_ms = round((time.time() - t0) * 1000, 2)
            code = response.getcode()
            headers = dict(response.headers)
            is_cold_start = latency_ms > 8000.0  # Cold start on Render free tier takes >8s
            return {
                "status": "healthy" if code < 400 else "degraded",
                "status_code": code,
                "latency_ms": latency_ms,
                "is_ssl": is_ssl,
                "is_cold_start": is_cold_start,
                "server": headers.get("server", "Render / Cloud"),
                "error": None,
                "timestamp": time.time(),
            }
    except urllib.error.HTTPError as e:
        latency_ms = round((time.time() - t0) * 1000, 2)
        return {
            "status": "degraded" if e.code < 500 else "unhealthy",
            "status_code": e.code,
            "latency_ms": latency_ms,
            "is_ssl": is_ssl,
            "is_cold_start": False,
            "server": "unknown",
            "error": f"HTTP {e.code}: {e.reason}",
            "timestamp": time.time(),
        }
    except Exception as e:
        latency_ms = round((time.time() - t0) * 1000, 2)
        err_str = str(e)
        is_sleeping = "timed out" in err_str.lower()
        return {
            "status": "sleeping" if is_sleeping else "down",
            "status_code": 0,
            "latency_ms": latency_ms,
            "is_ssl": is_ssl,
            "is_cold_start": is_sleeping,
            "server": "unknown",
            "error": "Render instance may be sleeping (cold start). Try longer probe." if is_sleeping else err_str,
            "timestamp": time.time(),
        }


@router.post("/probe", response_model=Dict[str, Any])
async def probe_single_url(req: ProbeRequest) -> Dict[str, Any]:
    """
    Probe any live web target (e.g., Render Cloud production URL or custom URL).
    Returns real-time latency, HTTP status code, SSL state, and cold-start detection.
    """
    clean_url = req.url.strip()
    if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
        clean_url = f"https://{clean_url}"

    result = await asyncio.to_thread(_sync_http_probe, clean_url, req.timeout)
    result["url"] = clean_url
    return result


@router.get("/fleet", response_model=List[TargetProbeResult])
async def monitor_fleet_targets() -> List[TargetProbeResult]:
    """
    Simultaneously probes the full CloudVault fleet:
    1. Render Production Backend API
    2. Render Production Frontend Web SPA
    3. Localhost FastAPI Backend
    4. Localhost React Frontend
    5. Localhost MinIO S3 Console
    6. Localhost Prometheus
    7. Localhost Grafana
    """
    targets = [
        {
            "id": "render-backend",
            "name": "CloudVault API (Render Cloud)",
            "url": "https://cloudvault-backend-cazy.onrender.com/health",
            "environment": "cloud",
            "timeout": 15.0,
        },
        {
            "id": "render-frontend",
            "name": "CloudVault Web App (Render Cloud)",
            "url": "https://cloudvault-frontend-z0wb.onrender.com",
            "environment": "cloud",
            "timeout": 15.0,
        },
        {
            "id": "local-backend",
            "name": "Localhost FastAPI Backend",
            "url": "http://localhost:8000/health",
            "environment": "local",
            "timeout": 3.0,
        },
        {
            "id": "local-frontend",
            "name": "Localhost React Frontend",
            "url": "http://localhost:5173",
            "environment": "local",
            "timeout": 3.0,
        },
        {
            "id": "local-minio",
            "name": "Localhost MinIO S3 Console",
            "url": "http://localhost:9001",
            "environment": "local",
            "timeout": 3.0,
        },
        {
            "id": "local-prometheus",
            "name": "Localhost Prometheus Scraper",
            "url": "http://localhost:9090",
            "environment": "local",
            "timeout": 3.0,
        },
        {
            "id": "local-grafana",
            "name": "Localhost Grafana Dashboards",
            "url": "http://localhost:3001",
            "environment": "local",
            "timeout": 3.0,
        },
    ]

    async def probe_wrapper(t: Dict[str, Any]) -> TargetProbeResult:
        res = await asyncio.to_thread(_sync_http_probe, t["url"], t["timeout"])
        return TargetProbeResult(
            id=t["id"],
            name=t["name"],
            url=t["url"],
            environment=t["environment"],
            status=res["status"],
            status_code=res["status_code"],
            latency_ms=res["latency_ms"],
            is_ssl=res["is_ssl"],
            is_cold_start=res["is_cold_start"],
            server=res["server"],
            error=res["error"],
            timestamp=res["timestamp"],
        )

    return await asyncio.gather(*(probe_wrapper(t) for t in targets))
