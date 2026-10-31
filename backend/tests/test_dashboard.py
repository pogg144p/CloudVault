import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_dashboard_summary_flow(client: AsyncClient):
    # 1. Register a test user
    payload = {
        "email": "dashboard.user@example.com",
        "full_name": "Dashboard Tester",
        "password": "Password123!",
    }
    reg_res = await client.post("/api/v1/auth/register", json=payload)
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]

    # 2. Query dashboard summary
    headers = {"Authorization": f"Bearer {token}"}
    dash_res = await client.get("/api/v1/dashboard/summary", headers=headers)
    assert dash_res.status_code == 200

    data = dash_res.json()
    assert "storage" in data
    assert "recent_files" in data
    assert "folder_categories" in data
    assert "monthly_stats" in data
    assert data["storage"]["quota_bytes"] == 10 * 1024 * 1024 * 1024
    assert len(data["folder_categories"]) == 4  # Design, Documents, Music, Images
