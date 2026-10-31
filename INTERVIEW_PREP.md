# CloudVault — Architecture & Engineering Interview Guide

## 1. Project Summary
**CloudVault** is a full-stack, secure cloud storage & file collaboration platform inspired by Dropbox and Google Drive. Designed with a product-first, cloud-native architecture capable of running locally with zero external dependencies, or at scale with managed PostgreSQL and AWS S3 object storage.

---

## 2. Key Architecture Decisions & "Why"

| Component | Choice | Why? |
| :--- | :--- | :--- |
| **Backend** | Python 3.12 + FastAPI | Async I/O for high concurrency; automatic OpenAPI (Swagger/ReDoc) generation; native Pydantic validation. |
| **Authentication** | Argon2id + Dual JWT | Argon2id won the Password Hashing Competition; resistant to GPU/ASIC brute forcing. Short-lived access token + long-lived refresh token in HTTP headers. |
| **Storage Pattern** | Driver Abstraction Pattern | `StorageService` interface decouples business logic from physical storage. Dev runs chunked local file streaming; Prod switches to AWS S3 via environment variable (`STORAGE_BACKEND=s3`) without changing a single line of application code. |
| **Streaming & Integrity** | Chunked Streaming + SHA-256 | Streaming multipart uploads in 1MB chunks guarantees files never load entirely into RAM ($O(1)$ memory usage). Simultaneous SHA-256 calculation guarantees data integrity against bit rot or upload corruption. |
| **Folder Hierarchy** | Materialized Path | Paths like `/Design/Logos/` allow instant breadcrumb reconstruction and descendant operations (rename, soft delete, cascade restore) in single SQL queries without recursive queries. |
| **File Collaboration** | 256-bit URL-Safe Tokens | Cryptographically random `secrets.token_urlsafe(32)` share tokens prevent brute-forcing. Granular permissions (`view` vs `download`) and Argon2id password protection. |
| **Background Processing** | Asynchronous Workers | Image thumbnailing downscaled with Pillow via `asyncio.to_thread` and FastAPI `BackgroundTasks`. Fast HTTP responses with non-blocking processing. |
| **Frontend** | React + TypeScript + Tailwind CSS | Type safety across API responses; modular component architecture with instant visual previews (PDFs, images, videos, audio, and code). |
| **DevOps & CI/CD** | GitHub Actions + Docker + Render Blueprint | Multi-stage Docker builds; automated CI linting and testing; 1-click cloud deployment via `render.yaml`. |

---

## 3. Resume Bullet Points

- **Full-Stack Cloud Storage Platform:** Architected an enterprise-grade cloud storage system using FastAPI, PostgreSQL, and React + TypeScript with zero-memory-leak chunked streaming and SHA-256 integrity verification.
- **Security & Authorization:** Implemented Argon2id password hashing and dual-token JWT authentication with granular public sharing permissions, password protection, and time-based token expiration (`HTTP 410`).
- **Storage Abstraction & Cloud Integration:** Designed a pluggable storage driver supporting local asynchronous file I/O and AWS S3 object storage with automated quota budgeting (10GB) and version rollback.
- **CI/CD & Containerization:** Authored automated GitHub Actions pipelines for linting, unit testing, and multi-stage Docker builds, with blueprint deployment configuration for cloud hosting.
