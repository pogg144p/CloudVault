import io
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def get_auth_token(client: AsyncClient, email: str = "version.user@example.com") -> str:
    res = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Version User", "password": "Password123!"},
    )
    return res.json()["access_token"]


async def test_file_version_upload_download_restore(client: AsyncClient):
    token = await get_auth_token(client, "versioning@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Upload initial file (Version 1)
    v1_content = b"Version 1 of the CloudVault specification document."
    files_v1 = {"file": ("spec.txt", io.BytesIO(v1_content), "text/plain")}
    upload_res = await client.post("/api/v1/files/upload", files=files_v1, headers=headers)
    assert upload_res.status_code == 201
    file_id = upload_res.json()["id"]
    assert upload_res.json()["current_version"] == 1

    # 2. Upload revision (Version 2)
    v2_content = b"Version 2 with major revisions and new cloud architecture diagrams."
    files_v2 = {"file": ("spec_updated.txt", io.BytesIO(v2_content), "text/plain")}
    v2_res = await client.post(f"/api/v1/files/{file_id}/versions", files=files_v2, headers=headers)
    assert v2_res.status_code == 201
    assert v2_res.json()["current_version"] == 2
    assert v2_res.json()["size_bytes"] == len(v2_content)

    # 3. List all versions
    versions_res = await client.get(f"/api/v1/files/{file_id}/versions", headers=headers)
    assert versions_res.status_code == 200
    versions_list = versions_res.json()
    assert len(versions_list) == 2
    assert versions_list[0]["version_number"] == 2
    assert versions_list[1]["version_number"] == 1

    # 4. Download historical Version 1
    dl_v1 = await client.get(f"/api/v1/files/{file_id}/versions/1/download", headers=headers)
    assert dl_v1.status_code == 200
    assert dl_v1.content == v1_content

    # 5. Download active Version 2
    dl_v2 = await client.get(f"/api/v1/files/{file_id}/versions/2/download", headers=headers)
    assert dl_v2.status_code == 200
    assert dl_v2.content == v2_content

    # 6. Restore Version 1 as active
    restore_res = await client.post(f"/api/v1/files/{file_id}/versions/1/restore", headers=headers)
    assert restore_res.status_code == 200
    assert restore_res.json()["current_version"] == 1
    assert restore_res.json()["size_bytes"] == len(v1_content)

    # 7. Download main file to verify active version content restored
    dl_restored = await client.get(f"/api/v1/files/{file_id}/download", headers=headers)
    assert dl_restored.status_code == 200
    assert dl_restored.content == v1_content


async def test_trash_soft_delete_and_restore(client: AsyncClient):
    token = await get_auth_token(client, "trash_restore@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Upload file
    content = b"Content meant for trash testing."
    files = {"file": ("trash_test.txt", io.BytesIO(content), "text/plain")}
    upload_res = await client.post("/api/v1/files/upload", files=files, headers=headers)
    file_id = upload_res.json()["id"]

    # Soft delete file
    del_res = await client.delete(f"/api/v1/files/{file_id}", headers=headers)
    assert del_res.status_code == 200

    # Verify not in active files
    active_res = await client.get("/api/v1/files/", headers=headers)
    assert not any(f["id"] == file_id for f in active_res.json())

    # Verify present in trash
    trash_res = await client.get("/api/v1/trash/", headers=headers)
    assert trash_res.status_code == 200
    assert any(f["id"] == file_id for f in trash_res.json()["files"])

    # Restore from trash
    restore_res = await client.post(
        "/api/v1/trash/restore",
        json={"item_id": file_id, "item_type": "file"},
        headers=headers,
    )
    assert restore_res.status_code == 200

    # Verify back in active files
    active_after = await client.get("/api/v1/files/", headers=headers)
    assert any(f["id"] == file_id for f in active_after.json())


async def test_trash_permanent_purge(client: AsyncClient):
    token = await get_auth_token(client, "trash_purge@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Upload file
    content = b"Sensitive data to be permanently purged."
    files = {"file": ("purge_test.txt", io.BytesIO(content), "text/plain")}
    upload_res = await client.post("/api/v1/files/upload", files=files, headers=headers)
    file_id = upload_res.json()["id"]

    # Soft delete
    await client.delete(f"/api/v1/files/{file_id}", headers=headers)

    # Permanent purge
    purge_res = await client.request(
        "DELETE",
        "/api/v1/trash/purge",
        json={"item_id": file_id, "item_type": "file"},
        headers=headers,
    )
    assert purge_res.status_code == 200

    # Verify completely gone from trash
    trash_res = await client.get("/api/v1/trash/", headers=headers)
    assert not any(f["id"] == file_id for f in trash_res.json()["files"])

    # Verify 404 on direct lookup
    get_res = await client.get(f"/api/v1/files/{file_id}", headers=headers)
    assert get_res.status_code == 404
