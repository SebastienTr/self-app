"""Application configuration using pydantic-settings.

Reads environment variables with sensible defaults for local development.
"""

from pathlib import PurePosixPath

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Backend configuration loaded from environment variables."""

    # LLM Configuration
    llm_api_key: str = ""
    self_llm_provider: str = "claude-cli"
    self_log_level: str = "info"
    self_llm_rate_limit: int = Field(default=10, ge=0)  # max LLM calls per minute
    self_llm_cost_alert: float = Field(default=5.0, ge=0)  # daily cost alert threshold ($)

    # Database
    self_data_dir: str = "data"
    self_db_name: str = "self.db"

    # Background refresh
    self_refresh_timeout: int = Field(default=10, ge=1)  # per-source HTTP timeout (seconds)

    @property
    def db_path(self) -> str:
        """Full path to the SQLite database file."""
        return str(PurePosixPath(self.self_data_dir) / self.self_db_name)

    model_config = {"env_prefix": ""}  # No prefix — reads LLM_API_KEY directly


settings = Settings()
