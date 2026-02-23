"""Tests for main.py helper functions and module-level constants.

Covers _ensure_data_dir, _MIGRATIONS_DIR resolution, and _state initialization.
"""

import importlib
import os
from pathlib import Path


class TestEnsureDataDir:
    """Test the _ensure_data_dir helper in main.py."""

    def test_creates_data_directory(self, tmp_path, monkeypatch):
        data_dir = str(tmp_path / "new_data")
        monkeypatch.setenv("SELF_DATA_DIR", data_dir)
        monkeypatch.setenv("SELF_DB_NAME", "test.db")

        import app.config

        importlib.reload(app.config)
        app.config.settings = app.config.Settings()

        import app.main

        importlib.reload(app.main)
        app.main._ensure_data_dir()

        assert os.path.isdir(data_dir)

    def test_existing_directory_no_error(self, tmp_path, monkeypatch):
        data_dir = str(tmp_path)  # Already exists
        monkeypatch.setenv("SELF_DATA_DIR", data_dir)
        monkeypatch.setenv("SELF_DB_NAME", "test.db")

        import app.config

        importlib.reload(app.config)
        app.config.settings = app.config.Settings()

        import app.main

        importlib.reload(app.main)
        app.main._ensure_data_dir()  # Should not raise


class TestMigrationsDir:
    """Test that _MIGRATIONS_DIR points to the correct location."""

    def test_migrations_dir_exists(self):
        import app.main

        importlib.reload(app.main)
        assert os.path.isdir(app.main._MIGRATIONS_DIR)

    def test_migrations_dir_contains_sql_files(self):
        import app.main

        importlib.reload(app.main)
        files = os.listdir(app.main._MIGRATIONS_DIR)
        sql_files = [f for f in files if f.endswith(".sql")]
        assert len(sql_files) >= 1

    def test_migrations_dir_relative_to_app(self):
        import app.main

        importlib.reload(app.main)
        # Should be sibling to app/ directory
        expected = str(Path(app.main.__file__).parent.parent / "migrations")
        assert app.main._MIGRATIONS_DIR == expected


class TestInitialState:
    """Test the initial _state dict before lifespan runs."""

    def test_initial_start_time_is_zero(self):
        import app.main

        importlib.reload(app.main)
        assert app.main._state["start_time"] == 0.0

    def test_initial_migrations_applied_is_zero(self):
        import app.main

        importlib.reload(app.main)
        assert app.main._state["migrations_applied"] == 0

    def test_initial_schema_version_is_zero(self):
        import app.main

        importlib.reload(app.main)
        assert app.main._state["schema_version"] == 0

    def test_state_has_exactly_three_keys(self):
        import app.main

        importlib.reload(app.main)
        assert set(app.main._state.keys()) == {
            "start_time",
            "migrations_applied",
            "schema_version",
        }
