"""Tests for the /health endpoint and FastAPI lifespan (Tasks 5 & 10.3)."""

import importlib

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
async def client(tmp_path, monkeypatch):
    """Create a test client with an isolated temp database.

    Reloads app modules to pick up fresh env vars and resets module-level state.
    """
    # Set environment variables to use temp directory for DB
    monkeypatch.setenv("SELF_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("SELF_DB_NAME", "test.db")
    monkeypatch.setenv("SELF_LOG_LEVEL", "warning")

    # Reload config to pick up env vars
    import app.config

    importlib.reload(app.config)
    app.config.settings = app.config.Settings()

    # Reload main to reset _state and get fresh app instance
    import app.main

    importlib.reload(app.main)

    # Manually trigger the lifespan
    the_app = app.main.app
    async with the_app.router.lifespan_context(the_app):
        transport = ASGITransport(app=the_app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


class TestHealthEndpoint:
    """Test the /health endpoint."""

    async def test_health_returns_200(self, client):
        response = await client.get("/health")
        assert response.status_code == 200

    async def test_health_returns_ok_status(self, client):
        response = await client.get("/health")
        data = response.json()
        assert data["status"] == "ok"

    async def test_health_includes_schema_version(self, client):
        response = await client.get("/health")
        data = response.json()
        assert "schema_version" in data
        assert isinstance(data["schema_version"], int)

    async def test_health_includes_migrations_applied(self, client):
        response = await client.get("/health")
        data = response.json()
        assert "migrations_applied" in data
        assert isinstance(data["migrations_applied"], int)

    async def test_health_includes_uptime(self, client):
        response = await client.get("/health")
        data = response.json()
        assert "uptime" in data
        assert isinstance(data["uptime"], (int, float))
        assert data["uptime"] >= 0

    async def test_health_schema_version_is_1_after_init(self, client):
        response = await client.get("/health")
        data = response.json()
        assert data["schema_version"] == 1

    async def test_health_migrations_applied_is_1(self, client):
        response = await client.get("/health")
        data = response.json()
        assert data["migrations_applied"] == 1
