import os

from fastapi import FastAPI

from pr_insight.adapters.github_adapter import GitHubAdapter
from pr_insight.adapters.note_callback import NoteCallbackAdapter
from pr_insight.adapters.qodo_adapter import QodoAdapter
from pr_insight.api.router import create_router
from pr_insight.config import get_settings
from pr_insight.domain.models import AnalysisJob
from pr_insight.domain.pipeline import AnalysisPipeline


def create_app() -> FastAPI:
    settings = get_settings()

    # LiteLlm reads API keys from env vars — set them from pydantic-settings
    # so they're available even when uvicorn doesn't inherit them from the shell.
    if settings.openai_api_key:
        os.environ["OPENAI_API_KEY"] = settings.openai_api_key
    if settings.anthropic_api_key:
        os.environ["ANTHROPIC_API_KEY"] = settings.anthropic_api_key
    app = FastAPI(
        title="PR Insight",
        version="0.1.0",
        description="GitHub PR analysis service using ADK and Qodo Merge",
    )

    # Dependency wiring (per D-46 constructor injection)
    jobs: dict[str, AnalysisJob] = {}
    github_adapter = GitHubAdapter(token=settings.github_token)
    qodo_adapter = QodoAdapter(
        github_token=settings.github_token,
        openai_api_key=settings.openai_api_key,
    )
    note_callback = NoteCallbackAdapter(callback_url=settings.note_callback_url)
    pipeline = AnalysisPipeline(
        github_port=github_adapter,
        code_review_port=qodo_adapter,
        note_callback_port=note_callback,
        jobs=jobs,
    )

    app.include_router(create_router(pipeline, jobs))

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
