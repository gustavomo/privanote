from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    github_token: str = ""
    openai_api_key: str = ""
    qodo_service_port: int = 8100
    note_callback_url: str = "http://127.0.0.1:4310/internal/pr-callback"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


def get_settings() -> Settings:
    return Settings()
