"""Shared test fixtures for the backend test suite."""

import importlib

import pytest


@pytest.fixture
def test_settings(tmp_path, monkeypatch):
    """Create a Settings instance pointing to a temp database directory."""
    monkeypatch.setenv("SELF_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("SELF_DB_NAME", "test.db")
    monkeypatch.setenv("SELF_LOG_LEVEL", "warning")

    import app.config

    importlib.reload(app.config)
    s = app.config.Settings()
    app.config.settings = s
    return s


@pytest.fixture
def test_db_path(test_settings):
    """Return the path to the test database file."""
    return test_settings.db_path
