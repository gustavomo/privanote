from fastapi import FastAPI

from pr_insight.api.router import create_router
from pr_insight.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="PR Insight",
        version="0.1.0",
        description="GitHub PR analysis service using ADK and Qodo Merge",
    )

    app.include_router(create_router())

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
