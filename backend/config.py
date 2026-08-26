"""Centralized configuration for Nethermind.

Loads settings from environment variables (via .env file or system env).
"""
import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Nethermind"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = "sqlite:///./switches.db"
    # Auto-fix postgres:// → postgresql:// for Railway/Render etc.
    @property
    def database_url_safe(self) -> str:
        url = self.DATABASE_URL
        if url and url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    # OpenAI / AI
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o"

    # SSH
    SSH_USERNAME: str = "admin"
    SSH_PASSWORD: str = ""
    SSH_TIMEOUT: int = 30

    # Security
    SECRET_KEY: str = "change-me"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # Containerlab
    CLAB_DIR: str = "/etc/containerlab/lab"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "case_sensitive": True}


settings = Settings()
