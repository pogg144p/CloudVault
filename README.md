# CloudVault ☁️🔐

> **Secure Cloud Storage & File Collaboration Platform**  
> A product-first, cloud-native storage platform engineered with FastAPI, React, PostgreSQL/MinIO, and modern DevOps observability.

---

## 🎯 Final Project Direction

CloudVault delivers an enterprise-grade cloud file storage experience inspired by Google Drive and Dropbox, designed with high usability, clean typography, and a modern dashboard UI.

### Key Capabilities
- **Authentication**: Secure registration, login, token refresh, Argon2id hashing, and JWT bearer authentication.
- **File Management**: Direct uploads, instant downloads, renaming, folder movements, soft-delete with recycle bin, and versioning.
- **Folder Hierarchies**: Arbitrary nested folders with materialized path queries and breadcrumb navigation.
- **File Sharing**: Granular link-based sharing with view/download permissions, optional expiry, and password protection.
- **Storage Metrics**: Visual dashboard with storage quota breakdown, recently modified files, and usage history.
- **Cloud-Native Storage**: Abstract storage interface supporting both local filesystem storage and S3-compatible object storage (MinIO/AWS S3).

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Tailwind CSS, Vite, Lucide Icons |
| **Backend** | Python 3.12, FastAPI, Pydantic v2 |
| **Data & ORM** | PostgreSQL / SQLite (async with SQLAlchemy 2.0 & Alembic) |
| **Auth & Security** | Argon2id password hashing, JWT access & refresh tokens |
| **Storage Engine** | MinIO (S3-compatible) & Local Storage Adapter |
| **Task Queue** | Redis + RQ (Phase 2) |
| **Containerization** | Docker, Docker Compose |
| **CI/CD & Tests** | GitHub Actions, Pytest, Playwright |

---

## 📁 Repository Structure

```
CloudVault/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Endpoints (auth, users, files, folders, shares)
│   │   ├── core/            # Config, security, database session
│   │   ├── models/          # SQLAlchemy async models
│   │   ├── schemas/         # Pydantic v2 validation models
│   │   ├── services/        # Business logic & storage adapters
│   │   └── main.py          # FastAPI application factory
│   ├── tests/               # Pytest suite
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components (Sidebar, Header, Dashboard, Files)
│   │   ├── context/         # Auth & App Context
│   │   ├── services/        # Axios API clients
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker/
│   └── docker-compose.yml   # Multi-container orchestration (FastAPI, Postgres, MinIO)
└── README.md
```
