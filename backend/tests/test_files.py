import io
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def get_auth_token(client: AsyncClient, email: str = "file.user@example.com") -> str:
    res = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "File User", "password": "Password123!"},
    )
    return res.json()["access_token"]


async def test_file_upload_download_delete(client: AsyncClient):
    token = await get_auth_token(client, "uploader@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Upload a sample file
    file_content = b"CloudVault securely stores enterprise documents and data."
    files = {"file": ("document.txt", io.BytesIO(file_content), "text/plain")}

    upload_res = await client.post("/api/v1/files/upload", files=files, headers=headers)
    assert upload_res.status_code == 201
    file_data = upload_res.json()
    assert file_data["name"] == "document.txt"
    assert file_data["size_bytes"] == len(file_content)
    assert file_data["mime_type"] == "text/plain"
    file_id = file_data["id"]

    # 2. Check user storage usage updated
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["storage_used_bytes"] == len(file_content)

    # 3. Download the file and verify content
    download_res = await client.get(f"/api/v1/files/{file_id}/download", headers=headers)
    assert download_res.status_code == 200
    assert download_res.content == file_content
    assert 'attachment; filename="document.txt"' in download_res.headers.get("Content-Disposition", "")

    # 4. Rename file
    update_res = await client.put(
        f"/api/v1/files/{file_id}", json={"name": "renamed_doc.txt"}, headers=headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "renamed_doc.txt"

    # 5. Delete file
    del_res = await client.delete(f"/api/v1/files/{file_id}", headers=headers)
    assert del_res.status_code == 200

    # 6. Verify quota was released
    me_after_del = await client.get("/api/v1/auth/me", headers=headers)
    assert me_after_del.json()["storage_used_bytes"] == 0


async def test_file_search_and_filter(client: AsyncClient):
    token = await get_auth_token(client, "searcher@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Upload two files
    f1 = {"file": ("financial_report_2026.pdf", io.BytesIO(b"PDF data"), "application/pdf")}
    f2 = {"file": ("vacation_photo.png", io.BytesIO(b"PNG data"), "image/png")}

    await client.post("/api/v1/files/upload", files=f1, headers=headers)
    await client.post("/api/v1/files/upload", files=f2, headers=headers)

    # Search for "financial"
    search_res = await client.get("/api/v1/files/?search=financial", headers=headers)
    assert search_res.status_code == 200
    results = search_res.json()
    assert len(results) == 1
    assert results[0]["name"] == "financial_report_2026.pdf"
