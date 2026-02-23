"""Additional edge-case tests for the configuration module.

Covers type coercion, validation edge cases, and db_path property behavior
not covered by the existing test_config.py.
"""

import pytest
from pydantic import ValidationError

from app.config import Settings


class TestSettingsTypeCoercion:
    """Test that pydantic-settings coerces env var strings to correct types."""

    def test_rate_limit_string_coerced_to_int(self, monkeypatch):
        monkeypatch.setenv("SELF_LLM_RATE_LIMIT", "50")
        s = Settings()
        assert s.self_llm_rate_limit == 50
        assert isinstance(s.self_llm_rate_limit, int)

    def test_cost_alert_string_coerced_to_float(self, monkeypatch):
        monkeypatch.setenv("SELF_LLM_COST_ALERT", "12.34")
        s = Settings()
        assert s.self_llm_cost_alert == 12.34
        assert isinstance(s.self_llm_cost_alert, float)

    def test_integer_string_for_cost_alert_coerced_to_float(self, monkeypatch):
        monkeypatch.setenv("SELF_LLM_COST_ALERT", "7")
        s = Settings()
        assert s.self_llm_cost_alert == 7.0
        assert isinstance(s.self_llm_cost_alert, float)

    def test_invalid_rate_limit_raises_validation_error(self, monkeypatch):
        """Non-numeric string for an int field should raise a validation error."""
        monkeypatch.setenv("SELF_LLM_RATE_LIMIT", "not-a-number")
        with pytest.raises(ValidationError):
            Settings()

    def test_invalid_cost_alert_raises_validation_error(self, monkeypatch):
        """Non-numeric string for a float field should raise a validation error."""
        monkeypatch.setenv("SELF_LLM_COST_ALERT", "not-a-float")
        with pytest.raises(ValidationError):
            Settings()


class TestSettingsDbPathEdgeCases:
    """Test db_path property with various data_dir and db_name combinations."""

    def test_db_path_with_trailing_slash_data_dir(self, monkeypatch):
        """db_path should handle trailing slashes in data_dir gracefully."""
        monkeypatch.setenv("SELF_DATA_DIR", "/data/")
        monkeypatch.setenv("SELF_DB_NAME", "test.db")
        s = Settings()
        # PurePosixPath normalizes the trailing slash
        assert s.db_path == "/data/test.db"

    def test_db_path_with_deeply_nested_dir(self, monkeypatch):
        monkeypatch.setenv("SELF_DATA_DIR", "/a/b/c/d/e")
        monkeypatch.setenv("SELF_DB_NAME", "deep.db")
        s = Settings()
        assert s.db_path == "/a/b/c/d/e/deep.db"

    def test_db_path_reflects_defaults(self):
        s = Settings()
        assert s.db_path == f"{s.self_data_dir}/{s.self_db_name}"

    def test_db_path_with_relative_dir(self):
        s = Settings()
        # Default data_dir is "data" (relative)
        assert not s.db_path.startswith("/")


class TestSettingsEnvPrefixBehavior:
    """Test that env_prefix='' allows direct env var name mapping."""

    def test_llm_api_key_reads_without_prefix(self, monkeypatch):
        """LLM_API_KEY is read directly (no SELF_ prefix required)."""
        monkeypatch.setenv("LLM_API_KEY", "sk-test-key")
        s = Settings()
        assert s.llm_api_key == "sk-test-key"

    def test_self_prefixed_vars_read_correctly(self, monkeypatch):
        """SELF_ prefix is part of the field name, not a pydantic env prefix."""
        monkeypatch.setenv("SELF_LLM_PROVIDER", "deepseek-api")
        s = Settings()
        assert s.self_llm_provider == "deepseek-api"


class TestSettingsBoundaryValues:
    """Test boundary and edge-case values for settings fields."""

    def test_zero_rate_limit_accepted(self, monkeypatch):
        monkeypatch.setenv("SELF_LLM_RATE_LIMIT", "0")
        s = Settings()
        assert s.self_llm_rate_limit == 0

    def test_negative_rate_limit_rejected(self, monkeypatch):
        """Negative rate limit is nonsensical and should be rejected."""
        monkeypatch.setenv("SELF_LLM_RATE_LIMIT", "-1")
        with pytest.raises(ValidationError):
            Settings()

    def test_zero_cost_alert_accepted(self, monkeypatch):
        monkeypatch.setenv("SELF_LLM_COST_ALERT", "0")
        s = Settings()
        assert s.self_llm_cost_alert == 0.0

    def test_very_large_rate_limit_accepted(self, monkeypatch):
        monkeypatch.setenv("SELF_LLM_RATE_LIMIT", "999999")
        s = Settings()
        assert s.self_llm_rate_limit == 999999

    def test_empty_string_api_key_preserved(self, monkeypatch):
        monkeypatch.setenv("LLM_API_KEY", "")
        s = Settings()
        assert s.llm_api_key == ""

    def test_empty_string_provider_preserved(self, monkeypatch):
        monkeypatch.setenv("SELF_LLM_PROVIDER", "")
        s = Settings()
        assert s.self_llm_provider == ""

    def test_empty_db_name_accepted(self, monkeypatch):
        monkeypatch.setenv("SELF_DB_NAME", "")
        s = Settings()
        assert s.self_db_name == ""
        assert s.db_path == "data"
