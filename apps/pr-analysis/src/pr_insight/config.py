from pathlib import Path

from pydantic_settings import BaseSettings

# Resolve .env relative to this file (src/pr_insight/config.py → ../../.env)
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    github_token: str = ""
    openai_api_key: str = ""
    qodo_service_port: int = 8100
    note_callback_url: str = "http://127.0.0.1:4310/internal/pr-callback"

    model_config = {"env_file": str(_ENV_FILE), "env_file_encoding": "utf-8"}


def get_settings() -> Settings:
    return Settings()
