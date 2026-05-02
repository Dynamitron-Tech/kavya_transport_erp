# tests/conftest.py — Shared fixtures for backend test suite
import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.models.postgres.base import Base
from app.core.security import TokenData, get_current_user
from app.db.postgres.connection import get_db


# ---------------------------------------------------------------------------
# SQLite in-memory async engine (no PostgreSQL needed for tests)
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ---------------------------------------------------------------------------
# Import *all* models so Base.metadata.create_all picks them up
# ---------------------------------------------------------------------------
import app.models.postgres  # noqa: F401, E402


# ---------------------------------------------------------------------------
# Event loop — single loop shared by the whole test session
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ---------------------------------------------------------------------------
# DB session — create tables once per test, rollback after
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ---------------------------------------------------------------------------
# Fake admin user — returned by dependency override for get_current_user
# ---------------------------------------------------------------------------
ADMIN_USER = TokenData(
    user_id=1,
    email="admin@kavyatransports.com",
    roles=["admin"],
    permissions=["*"],
    tenant_id=1,
    branch_id=1,
)


# ---------------------------------------------------------------------------
# Async HTTP client wired to the FastAPI app with overridden deps
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    from app.main import app

    # Override DB dependency
    async def _override_get_db():
        yield db_session

    # Override auth dependency — every request is treated as admin
    async def _override_get_current_user():
        return ADMIN_USER

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api/v1") as ac:
        yield ac

    app.dependency_overrides.clear()
