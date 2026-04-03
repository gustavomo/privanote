from pathlib import Path

from pydantic_settings import BaseSettings

# Resolve .env relative to this file (src/pr_insight/config.py → ../../.env)
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    github_token: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    pr_analysis_model: str = "openai/o3"
    qodo_service_port: int = 8100
    note_callback_url: str = "http://127.0.0.1:4310/internal/pr-callback"

    # Token-budget knobs — tune via env vars
    max_diff_lines_per_file: int = 200
    max_total_diff_lines: int = 1500
    max_review_comment_chars: int = 300

    model_config = {"env_file": str(_ENV_FILE), "env_file_encoding": "utf-8"}


def get_settings() -> Settings:
    return Settings()
