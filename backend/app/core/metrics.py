import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response

# Metrics definitions
REQUEST_COUNT = Counter(
    "cloudvault_http_requests_total",
    "Total count of HTTP requests processed by CloudVault API",
    ["method", "endpoint", "status_code"],
)

REQUEST_LATENCY = Histogram(
    "cloudvault_http_request_duration_seconds",
    "HTTP request latency histogram in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

FILE_UPLOAD_BYTES = Counter(
    "cloudvault_file_upload_bytes_total",
    "Total file payload bytes uploaded to CloudVault storage",
)


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Do not instrument metrics endpoint itself to avoid recursion
        if request.url.path == "/metrics":
            return await call_next(request)

        start_time = time.time()
        method = request.method
        path = request.url.path

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception:
            status_code = 500
            raise
        finally:
            duration = time.time() - start_time
            # Standardize endpoint path label to prevent cardinality explosion
            route = request.scope.get("route")
            endpoint = route.path if route else path
            REQUEST_COUNT.labels(method=method, endpoint=endpoint, status_code=status_code).inc()
            REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(duration)

        return response


def metrics_endpoint_handler():
    """Generates standard Prometheus telemetry text output."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
