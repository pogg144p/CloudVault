import io
import os
import tempfile
import pytest
from PIL import Image
from httpx import AsyncClient

from app.services.thumbnail_service import ThumbnailService

pytestmark = pytest.mark.asyncio


async def get_auth_token(client: AsyncClient, email: str = "preview.user@example.com") -> str:
    res = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Preview User", "password": "Password123!"},
    )
    return res.json()["access_token"]


def test_pillow_thumbnail_generation():
    """Verify ThumbnailService downsamples large images to thumbnail boundaries."""
    with tempfile.TemporaryDirectory() as tmpdir:
        src_path = os.path.join(tmpdir, "test_large.png")
        dest_path = os.path.join(tmpdir, "test_thumb.jpg")

        # Create a large 1200x800 sample image
        img = Image.new("RGBA", (1200, 800), color=(100, 150, 250, 255))
        img.save(src_path, "PNG")

        success = ThumbnailService.create_image_thumbnail(src_path, dest_path, max_size=(320, 320))
        assert success is True
        assert os.path.exists(dest_path)

        # Inspect thumbnail dimensions
        with Image.open(dest_path) as thumb:
            assert thumb.format == "JPEG"
            assert thumb.width <= 320
            assert thumb.height <= 320


async def test_file_inline_preview_and_error_handling(client: AsyncClient):
    """Verify inline preview endpoint returns inline disposition headers."""
    token = await get_auth_token(client, "preview_test@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Upload a sample text file
    content = b"CloudVault inline preview payload."
    files = {"file": ("notes.txt", io.BytesIO(content), "text/plain")}
    upload_res = await client.post("/api/v1/files/upload", files=files, headers=headers)
    assert upload_res.status_code == 201
    file_id = upload_res.json()["id"]

    # Test preview endpoint
    preview_res = await client.get(f"/api/v1/files/{file_id}/preview", headers=headers)
    assert preview_res.status_code == 200
    assert preview_res.content == content
    assert 'inline; filename="notes.txt"' in preview_res.headers.get("Content-Disposition", "")

    # Test structured error handler on non-existent file
    error_res = await client.get("/api/v1/files/non-existent-id/preview", headers=headers)
    assert error_res.status_code == 404
    data = error_res.json()
    assert "detail" in data
    assert data["status_code"] == 404
