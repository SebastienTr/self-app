"""Additional edge-case tests for the /health endpoint and FastAPI app.

Covers HTTP method handling, app metadata, uptime behavior, response structure,
and lifespan edge cases not covered by test_health.py.
"""

import importlib

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
async def client(tmp_path, monkeypatch):
    """Create a test client with an isolated temp database.

    Reloads app modules to pick up fresh env vars and resets module-level state.
    """
    monkeypatch.setenv("SELF_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("SELF_DB_NAME", "test.db")
    monkeypatch.setenv("SELF_LOG_LEVEL", "warning")

    import app.config

    importlib.reload(app.config)
    app.config.settings = app.config.Settings()

    import app.main

    importlib.reload(app.main)

    the_app = app.main.app
    async with the_app.router.lifespan_context(the_app):
        transport = ASGITransport(app=the_app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


class TestHealthHttpMethods:
    """Test that /health only responds to GET requests."""

    async def test_post_health_returns_405(self, client):
        response = await client.post("/health")
        assert response.status_code == 405

    async def test_put_health_returns_405(self, client):
        response = await client.put("/health")
        assert response.status_code == 405

    async def test_delete_health_returns_405(self, client):
        response = await client.delete("/health")
        assert response.status_code == 405

    async def test_patch_health_returns_405(self, client):
        response = await client.patch("/health")
        assert response.status_code == 405


class TestHealthResponseStructure:
    """Test the exact structure and types of the /health response."""

    async def test_response_has_expected_keys(self, client):
        response = await client.get("/health")
        data = response.json()
        assert set(data.keys()) == {
            "status", "schema_version", "migrations_applied", "uptime", "providers"
        }

    async def test_response_content_type_is_json(self, client):
        response = await client.get("/health")
        assert "application/json" in response.headers["content-type"]

    async def test_status_is_string(self, client):
        response = await client.get("/health")
        data = response.json()
        assert isinstance(data["status"], str)

    async def test_schema_version_is_positive(self, client):
        response = await client.get("/health")
        data = response.json()
        assert data["schema_version"] >= 1

    async def test_uptime_is_non_negative(self, client):
        response = await client.get("/health")
        data = response.json()
        assert data["uptime"] >= 0


class TestHealthUptimeBehavior:
    """Test that uptime increases across calls."""

    async def test_uptime_increases_on_second_call(self, client):
        import asyncio

        r1 = await client.get("/health")
        uptime1 = r1.json()["uptime"]

        await asyncio.sleep(0.1)

        r2 = await client.get("/health")
        uptime2 = r2.json()["uptime"]

        assert uptime2 >= uptime1


class TestNonExistentEndpoints:
    """Test behavior for non-existent routes."""

    async def test_unknown_route_returns_404(self, client):
        response = await client.get("/nonexistent")
        assert response.status_code == 404

    async def test_unknown_route_json_response(self, client):
        response = await client.get("/nonexistent")
        data = response.json()
        assert "detail" in data


class TestAppMetadata:
    """Test FastAPI app metadata is set correctly."""

    def test_app_title(self):
        import app.main

        importlib.reload(app.main)
        assert app.main.app.title == "self-app backend"

    def test_app_version(self):
        import app.main

        importlib.reload(app.main)
        assert app.main.app.version == "0.1.0"


class TestLifespanInitializesState:
    """Test that the lifespan properly initializes module-level state."""

    async def test_state_has_start_time_after_lifespan(self, tmp_path, monkeypatch):
        monkeypatch.setenv("SELF_DATA_DIR", str(tmp_path))
        monkeypatch.setenv("SELF_DB_NAME", "test.db")
        monkeypatch.setenv("SELF_LOG_LEVEL", "warning")

        import app.config

        importlib.reload(app.config)
        app.config.settings = app.config.Settings()

        import app.main

        importlib.reload(app.main)

        the_app = app.main.app
        async with the_app.router.lifespan_context(the_app):
            assert app.main._state["start_time"] > 0

    async def test_state_has_schema_version_after_lifespan(self, tmp_path, monkeypatch):
        monkeypatch.setenv("SELF_DATA_DIR", str(tmp_path))
        monkeypatch.setenv("SELF_DB_NAME", "test.db")
        monkeypatch.setenv("SELF_LOG_LEVEL", "warning")

        import app.config

        importlib.reload(app.config)
        app.config.settings = app.config.Settings()

        import app.main

        importlib.reload(app.main)

        the_app = app.main.app
        async with the_app.router.lifespan_context(the_app):
            assert app.main._state["schema_version"] == 1

    async def test_state_has_migrations_applied_after_lifespan(self, tmp_path, monkeypatch):
        monkeypatch.setenv("SELF_DATA_DIR", str(tmp_path))
        monkeypatch.setenv("SELF_DB_NAME", "test.db")
        monkeypatch.setenv("SELF_LOG_LEVEL", "warning")

        import app.config

        importlib.reload(app.config)
        app.config.settings = app.config.Settings()

        import app.main

        importlib.reload(app.main)

        the_app = app.main.app
        async with the_app.router.lifespan_context(the_app):
            assert app.main._state["migrations_applied"] == 1
