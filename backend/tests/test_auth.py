# tests/test_auth.py — Authentication endpoint tests
import pytest
from httpx import AsyncClient

from app.models.postgres.user import User, Role, RoleType, user_roles
from app.core.security import get_password_hash


async def _seed_admin(db):
    """Create an admin user + role for login tests."""
    role = Role(name="admin", display_name="Administrator", description="Administrator", role_type=RoleType.ADMIN)
    db.add(role)
    await db.flush()

    user = User(
        email="admin@kavya.com",
        password_hash=get_password_hash("admin123"),
        first_name="Admin",
        last_name="User",
        is_active=True,
    )
    db.add(user)
    await db.flush()

    await db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
    await db.flush()
    return user


class TestLogin:
    async def test_login_success(self, client: AsyncClient, db_session):
        await _seed_admin(db_session)
        await db_session.commit()
        resp = await client.post("/auth/login", json={"email": "admin@kavya.com", "password": "admin123"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "access_token" in body["data"]
        assert "refresh_token" in body["data"]
        assert body["data"]["user"]["email"] == "admin@kavya.com"

    async def test_login_wrong_password(self, client: AsyncClient, db_session):
        await _seed_admin(db_session)
        await db_session.commit()
        resp = await client.post("/auth/login", json={"email": "admin@kavya.com", "password": "wrong"})
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        resp = await client.post("/auth/login", json={"email": "ghost@test.com", "password": "pass1234"})
        assert resp.status_code == 401

    async def test_login_missing_fields(self, client: AsyncClient):
        resp = await client.post("/auth/login", json={})
        assert resp.status_code == 422

    async def test_login_short_password(self, client: AsyncClient):
        resp = await client.post("/auth/login", json={"email": "a@b.com", "password": "ab"})
        assert resp.status_code == 422


class TestProfile:
    async def test_get_me(self, client: AsyncClient, db_session):
        user = await _seed_admin(db_session)
        await db_session.commit()
        resp = await client.get("/auth/me")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    async def test_logout(self, client: AsyncClient):
        resp = await client.post("/auth/logout")
        assert resp.status_code == 200
        assert resp.json()["success"] is True


class TestChangePassword:
    async def test_change_password_success(self, client: AsyncClient, db_session):
        await _seed_admin(db_session)
        await db_session.commit()
        resp = await client.post(
            "/auth/change-password",
            json={"current_password": "admin123", "new_password": "newpass123"},
        )
        assert resp.status_code == 200

    async def test_change_password_wrong_current(self, client: AsyncClient, db_session):
        await _seed_admin(db_session)
        await db_session.commit()
        resp = await client.post(
            "/auth/change-password",
            json={"current_password": "wrongold", "new_password": "newpass123"},
        )
        assert resp.status_code == 400

    async def test_change_password_short_new(self, client: AsyncClient):
        resp = await client.post(
            "/auth/change-password",
            json={"current_password": "admin123", "new_password": "ab"},
        )
        assert resp.status_code == 422
