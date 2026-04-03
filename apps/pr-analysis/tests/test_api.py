"""API route tests (per D-35, D-37, D-38)."""

import pytest
from httpx import ASGITransport, AsyncClient

from pr_insight.domain.models import AnalysisJob, AnalysisResult, JobStatus


@pytest.fixture
def app():
    """Create app with mock adapters to avoid real API calls."""
    from unittest.mock import AsyncMock, MagicMock

    from pr_insight.api.router import create_router
    from fastapi import FastAPI

    jobs: dict[str, AnalysisJob] = {}
    pipeline = MagicMock()
    pipeline.run_analysis = AsyncMock()

    app = FastAPI()
    app.include_router(create_router(pipeline, jobs))

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok"}

    app.state.jobs = jobs
    app.state.pipeline = pipeline
    return app


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestGivenTheAnalyzeEndpoint:
    @pytest.mark.asyncio
    async def test_when_valid_pr_url_then_returns_job_id(self, client, app):
        response = await client.post(
            "/api/v1/analyze/pr",
            json={"url": "https://github.com/owner/repo/pull/1"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "job_id" in data
        assert len(data["job_id"]) > 0

    @pytest.mark.asyncio
    async def test_when_invalid_url_then_returns_422(self, client):
        response = await client.post(
            "/api/v1/analyze/pr",
            json={"url": "not-a-pr-url"},
        )
        assert response.status_code == 422
        assert "valid GitHub PR URL" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_when_job_exists_then_returns_status(self, client, app):
        # Create a job
        response = await client.post(
            "/api/v1/analyze/pr",
            json={"url": "https://github.com/owner/repo/pull/42"},
        )
        job_id = response.json()["job_id"]

        # Poll status
        status_response = await client.get(f"/api/v1/analyze/pr/{job_id}")
        assert status_response.status_code == 200
        data = status_response.json()
        assert data["id"] == job_id
        assert data["status"] in ["pending", "analyzing"]

    @pytest.mark.asyncio
    async def test_when_job_not_found_then_returns_404(self, client):
        response = await client.get("/api/v1/analyze/pr/nonexistent-id")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_when_job_completed_then_result_includes_node_id(self, client, app):
        # Create a job and manually complete it
        response = await client.post(
            "/api/v1/analyze/pr",
            json={"url": "https://github.com/owner/repo/pull/99"},
        )
        job_id = response.json()["job_id"]

        # Simulate completion with node_id
        job = app.state.jobs[job_id]
        job.status = JobStatus.COMPLETED
        job.result = AnalysisResult(
            title="PR Analysis: owner/repo#99",
            description="Test analysis content",
            tags=["github-analysis"],
            node_id="test-node-123",
        )

        status_response = await client.get(f"/api/v1/analyze/pr/{job_id}")
        assert status_response.status_code == 200
        data = status_response.json()
        assert data["result"]["node_id"] == "test-node-123"


class TestGivenTheHealthEndpoint:
    @pytest.mark.asyncio
    async def test_when_called_then_returns_ok(self, client):
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
