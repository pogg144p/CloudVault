import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def get_auth_token(client: AsyncClient, email: str = "folder.user@example.com") -> str:
    res = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Folder User", "password": "Password123!"},
    )
    return res.json()["access_token"]


async def test_create_and_nest_folders(client: AsyncClient):
    token = await get_auth_token(client, "nest.user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create root folder "Projects"
    f1_res = await client.post(
        "/api/v1/folders/",
        json={"name": "Projects", "color": "#6366F1"},
        headers=headers,
    )
    assert f1_res.status_code == 201
    f1 = f1_res.json()
    assert f1["name"] == "Projects"
    assert f1["path"] == "/Projects/"
    assert f1["parent_id"] is None

    # 2. Create subfolder "CloudVault" inside "Projects"
    f2_res = await client.post(
        "/api/v1/folders/",
        json={"name": "CloudVault", "parent_id": f1["id"]},
        headers=headers,
    )
    assert f2_res.status_code == 201
    f2 = f2_res.json()
    assert f2["name"] == "CloudVault"
    assert f2["path"] == "/Projects/CloudVault/"
    assert f2["parent_id"] == f1["id"]

    # 3. Test breadcrumbs for subfolder
    detail_res = await client.get(f"/api/v1/folders/{f2['id']}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    crumbs = detail["breadcrumbs"]
    assert len(crumbs) == 3
    assert crumbs[0]["name"] == "All Files"
    assert crumbs[1]["name"] == "Projects"
    assert crumbs[2]["name"] == "CloudVault"


async def test_duplicate_folder_name_rejected(client: AsyncClient):
    token = await get_auth_token(client, "dup.user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    res1 = await client.post(
        "/api/v1/folders/", json={"name": "Marketing"}, headers=headers
    )
    assert res1.status_code == 201

    res2 = await client.post(
        "/api/v1/folders/", json={"name": "Marketing"}, headers=headers
    )
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


async def test_rename_and_delete_folder(client: AsyncClient):
    token = await get_auth_token(client, "rename.user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Create folder
    create_res = await client.post(
        "/api/v1/folders/", json={"name": "OldName"}, headers=headers
    )
    folder_id = create_res.json()["id"]

    # Rename
    rename_res = await client.put(
        f"/api/v1/folders/{folder_id}", json={"name": "NewName"}, headers=headers
    )
    assert rename_res.status_code == 200
    assert rename_res.json()["name"] == "NewName"
    assert rename_res.json()["path"] == "/NewName/"

    # Delete
    del_res = await client.delete(f"/api/v1/folders/{folder_id}", headers=headers)
    assert del_res.status_code == 200

    # Ensure deleted folder no longer appears in listings
    list_res = await client.get("/api/v1/folders/", headers=headers)
    names = [f["name"] for f in list_res.json()]
    assert "NewName" not in names
