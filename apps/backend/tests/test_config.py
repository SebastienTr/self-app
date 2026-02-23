"""Tests for the configuration module (Task 1)."""

from app.config import Settings


class TestSettingsDefaults:
    """Test that Settings has sensible defaults."""

    def test_default_llm_provider(self):
        s = Settings()
        assert s.self_llm_provider == "claude-cli"

    def test_default_log_level(self):
        s = Settings()
        assert s.self_log_level == "info"

    def test_default_llm_rate_limit(self):
        s = Settings()
        assert s.self_llm_rate_limit == 10

    def test_default_llm_cost_alert(self):
        s = Settings()
        assert s.self_llm_cost_alert == 5.0

    def test_default_data_dir(self):
        s = Settings()
        assert s.self_data_dir == "data"

    def test_default_db_name(self):
        s = Settings()
        assert s.self_db_name == "self.db"

    def test_default_llm_api_key_is_empty(self):
        s = Settings()
        assert s.llm_api_key == ""

    def test_db_path_property(self):
        s = Settings()
        assert s.db_path == "data/self.db"


class TestSettingsFromEnv:
    """Test that Settings reads from environment variables."""

    def test_reads_llm_api_key_from_env(self, monkeypatch):
        monkeypatch.setenv("LLM_API_KEY", "test-key-123")
        s = Settings()
        assert s.llm_api_key == "test-key-123"

    def test_reads_llm_provider_from_env(self, monkeypatch):
        monkeypatch.setenv("SELF_LLM_PROVIDER", "anthropic-api")
        s = Settings()
        assert s.self_llm_provider == "anthropic-api"

    def test_reads_log_level_from_env(self, monkeypatch):
        monkeypatch.setenv("SELF_LOG_LEVEL", "debug")
        s = Settings()
        assert s.self_log_level == "debug"

    def test_reads_rate_limit_from_env(self, monkeypatch):
        monkeypatch.setenv("SELF_LLM_RATE_LIMIT", "20")
        s = Settings()
        assert s.self_llm_rate_limit == 20

    def test_reads_cost_alert_from_env(self, monkeypatch):
        monkeypatch.setenv("SELF_LLM_COST_ALERT", "10.0")
        s = Settings()
        assert s.self_llm_cost_alert == 10.0

    def test_reads_data_dir_from_env(self, monkeypatch):
        monkeypatch.setenv("SELF_DATA_DIR", "/tmp/mydata")
        s = Settings()
        assert s.self_data_dir == "/tmp/mydata"

    def test_reads_db_name_from_env(self, monkeypatch):
        monkeypatch.setenv("SELF_DB_NAME", "custom.db")
        s = Settings()
        assert s.self_db_name == "custom.db"

    def test_db_path_uses_custom_values(self, monkeypatch):
        monkeypatch.setenv("SELF_DATA_DIR", "/custom")
        monkeypatch.setenv("SELF_DB_NAME", "my.db")
        s = Settings()
        assert s.db_path == "/custom/my.db"


class TestSettingsSingleton:
    """Test that a settings singleton is exported."""

    def test_settings_instance_exists(self):
        from app.config import settings

        assert isinstance(settings, Settings)
