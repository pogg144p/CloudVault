import io
from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def setup_user_and_file(client: AsyncClient, email: str = "sharer@example.com"):
    # Register user
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Sharer User", "password": "Password123!"},
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Upload file
    content = b"Confidential Quarterly Strategy Roadmap 2026."
    files = {"file": ("strategy.pdf", io.BytesIO(content), "application/pdf")}
    upload = await client.post("/api/v1/files/upload", files=files, headers=headers)
    file_id = upload.json()["id"]

    return token, headers, file_id, content


async def test_create_and_view_public_share(client: AsyncClient):
    token, headers, file_id, _ = await setup_user_and_file(client, "alice.share@example.com")

    # 1. Create a view-only public share
    create_payload = {
        "file_id": file_id,
        "permission": "view",
    }
    share_res = await client.post("/api/v1/shares/", json=create_payload, headers=headers)
    assert share_res.status_code == 201
    share_data = share_res.json()
    share_token = share_data["share_token"]
    assert share_data["permission"] == "view"
    assert share_data["has_password"] is False

    # 2. Access public endpoint WITHOUT ANY AUTH HEADERS
    pub_res = await client.get(f"/api/v1/shares/public/{share_token}")
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["item_name"] == "strategy.pdf"
    assert pub_data["permission"] == "view"
    assert pub_data["requires_password"] is False

    # 3. View-only permission must block direct download with 403
    down_res = await client.get(f"/api/v1/shares/public/{share_token}/download")
    assert down_res.status_code == 403
    assert "view-only" in down_res.json()["detail"].lower()


async def test_download_permitted_share(client: AsyncClient):
    token, headers, file_id, content = await setup_user_and_file(client, "bob.share@example.com")

    # Create share with download permission
    share_res = await client.post(
        "/api/v1/shares/",
        json={"file_id": file_id, "permission": "download"},
        headers=headers,
    )
    assert share_res.status_code == 201
    share_token = share_res.json()["share_token"]

    # Public download should succeed
    down_res = await client.get(f"/api/v1/shares/public/{share_token}/download")
    assert down_res.status_code == 200
    assert down_res.content == content


async def test_password_protected_share(client: AsyncClient):
    token, headers, file_id, _ = await setup_user_and_file(client, "charlie.share@example.com")

    # Create share with password
    share_res = await client.post(
        "/api/v1/shares/",
        json={
            "file_id": file_id,
            "permission": "download",
            "password": "SecretVaultKey99!",
        },
        headers=headers,
    )
    assert share_res.status_code == 201
    share_token = share_res.json()["share_token"]
    assert share_res.json()["has_password"] is True

    # 1. Access without password -> should report requires_password and hide name
    pub_res = await client.get(f"/api/v1/shares/public/{share_token}")
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["requires_password"] is True
    assert pub_data["item_name"] is None

    # 2. Access with wrong password -> 401
    verify_wrong = await client.post(
        f"/api/v1/shares/public/{share_token}/verify",
        json={"password": "WrongPassword!"},
    )
    assert verify_wrong.status_code == 401

    # 3. Access with correct password -> 200 with full details
    verify_ok = await client.post(
        f"/api/v1/shares/public/{share_token}/verify",
        json={"password": "SecretVaultKey99!"},
    )
    assert verify_ok.status_code == 200
    assert verify_ok.json()["item_name"] == "strategy.pdf"
    assert verify_ok.json()["requires_password"] is False


async def test_expired_share(client: AsyncClient):
    token, headers, file_id, _ = await setup_user_and_file(client, "expired.share@example.com")

    # Create share with past expiration
    past_date = datetime.now(timezone.utc) - timedelta(days=1)
    share_res = await client.post(
        "/api/v1/shares/",
        json={
            "file_id": file_id,
            "permission": "view",
            "expires_at": past_date.isoformat(),
        },
        headers=headers,
    )
    assert share_res.status_code == 201
    share_token = share_res.json()["share_token"]

    # Public access should return 410 GONE
    pub_res = await client.get(f"/api/v1/shares/public/{share_token}")
    assert pub_res.status_code == 410
    assert "expired" in pub_res.json()["detail"].lower()


async def test_revoke_share(client: AsyncClient):
    token, headers, file_id, _ = await setup_user_and_file(client, "revoke.share@example.com")

    share_res = await client.post(
        "/api/v1/shares/",
        json={"file_id": file_id, "permission": "view"},
        headers=headers,
    )
    share_id = share_res.json()["id"]
    share_token = share_res.json()["share_token"]

    # Revoke share
    del_res = await client.delete(f"/api/v1/shares/{share_id}", headers=headers)
    assert del_res.status_code == 200

    # Ensure public access fails with 404
    pub_res = await client.get(f"/api/v1/shares/public/{share_token}")
    assert pub_res.status_code == 404
