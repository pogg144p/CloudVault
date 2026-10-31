import pytest
from httpx import AsyncClient
from app.core.security import verify_password, get_password_hash

pytestmark = pytest.mark.asyncio


async def test_argon2id_hashing():
    raw_password = "SuperSecretPassword123!"
    hashed = get_password_hash(raw_password)
    assert hashed != raw_password
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword123!", hashed) is False


async def test_register_user_success(client: AsyncClient):
    payload = {
        "email": "alex.morgan@example.com",
        "full_name": "Alex Morgan",
        "password": "Password12345!",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


async def test_register_duplicate_email(client: AsyncClient):
    payload = {
        "email": "duplicate@example.com",
        "full_name": "First User",
        "password": "Password12345!",
    }
    res1 = await client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


async def test_login_flow_and_me(client: AsyncClient):
    # 1. Register user
    reg_payload = {
        "email": "shakir260@gmail.com",
        "full_name": "AR Shakir",
        "password": "SecurePassword123!",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201

    # 2. Login with valid password
    login_payload = {
        "email": "shakir260@gmail.com",
        "password": "SecurePassword123!",
    }
    login_res = await client.post("/api/v1/auth/login", json=login_payload)
    assert login_res.status_code == 200
    login_data = login_res.json()
    access_token = login_data["access_token"]
    refresh_token = login_data["refresh_token"]

    # 3. Access protected /me endpoint
    headers = {"Authorization": f"Bearer {access_token}"}
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    user_data = me_res.json()
    assert user_data["email"] == "shakir260@gmail.com"
    assert user_data["full_name"] == "AR Shakir"
    assert user_data["storage_quota_bytes"] == 10 * 1024 * 1024 * 1024

    # 4. Refresh token
    refresh_res = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert refresh_res.status_code == 200
    assert "access_token" in refresh_res.json()


async def test_login_invalid_password(client: AsyncClient):
    reg_payload = {
        "email": "valid@example.com",
        "full_name": "Valid User",
        "password": "CorrectPassword1!",
    }
    await client.post("/api/v1/auth/register", json=reg_payload)

    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "valid@example.com", "password": "WrongPassword!"},
    )
    assert login_res.status_code == 401
    assert "Incorrect email or password" in login_res.json()["detail"]


async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "CloudVault"
