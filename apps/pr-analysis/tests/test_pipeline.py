"""Tests for the analysis pipeline (per D-35, D-38)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from pr_insight.domain.models import (
    AnalysisJob,
    CodeReviewFinding,
    CodeReviewResult,
    ImprovementSuggestion,
    JobStatus,
    PRDescription,
    PRMetadata,
)
from pr_insight.domain.pipeline import AnalysisPipeline

PR_URL = "https://github.com/owner/repo/pull/42"


def _make_ports():
    """Create mock ports with default return values."""
    github_port = AsyncMock()
    github_port.get_pr_metadata.return_value = PRMetadata(
        title="Add feature X",
        body="This PR adds feature X",
        state="open",
        author="testuser",
        base_branch="main",
        head_branch="feat/x",
        created_at="2026-01-01T00:00:00Z",
        updated_at="2026-01-02T00:00:00Z",
        additions=100,
        deletions=20,
        changed_files=5,
        html_url=PR_URL,
        files=[
            {"filename": "src/main.py", "status": "modified", "additions": 50, "deletions": 10},
        ],
    )
    github_port.get_review_comments.return_value = [
        {"author": "reviewer", "body": "Looks good", "created_at": "2026-01-01", "url": ""}
    ]

    code_review_port = AsyncMock()
    code_review_port.review.return_value = CodeReviewResult(
        findings=[
            CodeReviewFinding(
                file="src/main.py",
                line=10,
                severity="warning",
                description="Missing error handling",
                suggestion="Add try/except",
            )
        ],
        raw_output="review output",
    )
    code_review_port.describe.return_value = PRDescription(
        summary="Adds feature X to the system",
        changes={"features": ["New feature X"]},
        raw_output="describe output",
    )
    code_review_port.improve.return_value = [
        ImprovementSuggestion(
            file="src/main.py",
            suggestion="Use typing hints",
            code_snippet="def foo() -> str:",
            raw_output="improve output",
        )
    ]

    note_callback_port = AsyncMock()
    note_callback_port.send_analysis_result.return_value = {
        "success": True,
        "nodeId": "test-node-123",
    }

    return github_port, code_review_port, note_callback_port


class TestGivenAnAnalysisPipeline:
    @pytest.fixture
    def jobs(self) -> dict[str, AnalysisJob]:
        return {}

    @pytest.fixture
    def setup(self, jobs):
        github_port, code_review_port, note_callback_port = _make_ports()
        pipeline = AnalysisPipeline(
            github_port=github_port,
            code_review_port=code_review_port,
            note_callback_port=note_callback_port,
            jobs=jobs,
        )
        job = AnalysisJob(pr_url=PR_URL)
        jobs[job.id] = job
        return pipeline, job, github_port, code_review_port, note_callback_port

    @patch("pr_insight.domain.pipeline.create_pr_agent")
    async def test_when_all_tools_succeed_then_job_completes(
        self, mock_agent_factory, setup
    ):
        """Pipeline completes with COMPLETED status when all adapters succeed."""
        pipeline, job, _, _, note_callback_port = setup

        # Mock agent to avoid real LLM calls -- force fallback path
        mock_agent_factory.side_effect = Exception("No LLM in tests")

        await pipeline.run_analysis(job.id, PR_URL)

        assert job.status == JobStatus.COMPLETED
        assert job.result is not None
        assert "--" in job.result.title  # D-25 title format
        assert "#42" in job.result.title  # D-25 PR number
        assert job.result.tags == "github-analysis"  # D-26
        assert job.result.node_id == "test-node-123"  # D-21 auto-select
        note_callback_port.send_analysis_result.assert_called_once()

    @patch("pr_insight.domain.pipeline.create_pr_agent")
    async def test_when_github_fails_then_job_fails_with_error(
        self, mock_agent_factory, setup
    ):
        """Job status is FAILED when GitHub adapter raises."""
        pipeline, job, github_port, _, _ = setup
        github_port.get_pr_metadata.side_effect = ValueError(
            "Cannot access repo -- check GITHUB_TOKEN permissions"
        )

        await pipeline.run_analysis(job.id, PR_URL)

        assert job.status == JobStatus.FAILED
        assert "Cannot access repo" in job.error

    @patch("pr_insight.domain.pipeline.create_pr_agent")
    async def test_when_qodo_fails_then_job_fails_entirely(
        self, mock_agent_factory, setup
    ):
        """Job status is FAILED when Qodo adapter raises (D-05, no partial notes)."""
        pipeline, job, _, code_review_port, _ = setup
        code_review_port.review.side_effect = RuntimeError("Qodo review failed")

        await pipeline.run_analysis(job.id, PR_URL)

        assert job.status == JobStatus.FAILED
        assert "Qodo review failed" in job.error

    @patch("pr_insight.domain.pipeline.create_pr_agent")
    async def test_when_callback_fails_then_job_fails(
        self, mock_agent_factory, setup
    ):
        """Job status is FAILED when note callback raises."""
        pipeline, job, _, _, note_callback_port = setup
        mock_agent_factory.side_effect = Exception("No LLM in tests")
        note_callback_port.send_analysis_result.side_effect = RuntimeError(
            "Note callback failed: 500"
        )

        await pipeline.run_analysis(job.id, PR_URL)

        assert job.status == JobStatus.FAILED
        assert "callback failed" in job.error.lower()

    @patch("pr_insight.domain.pipeline.create_pr_agent")
    async def test_when_callback_returns_node_id_then_stored_in_result(
        self, mock_agent_factory, setup
    ):
        """Pipeline captures nodeId from callback response (D-21 auto-select)."""
        pipeline, job, _, _, note_callback_port = setup
        mock_agent_factory.side_effect = Exception("No LLM in tests")
        note_callback_port.send_analysis_result.return_value = {
            "success": True,
            "nodeId": "abc-456",
        }

        await pipeline.run_analysis(job.id, PR_URL)

        assert job.status == JobStatus.COMPLETED
        assert job.result.node_id == "abc-456"

    @patch("pr_insight.domain.pipeline.create_pr_agent")
    async def test_when_running_then_status_progresses(
        self, mock_agent_factory, setup
    ):
        """Job status progresses through expected phases."""
        pipeline, job, github_port, code_review_port, note_callback_port = setup
        mock_agent_factory.side_effect = Exception("No LLM in tests")

        statuses: list[JobStatus] = [job.status]  # starts as PENDING

        # Capture status changes by wrapping adapter calls
        original_review = code_review_port.review.side_effect

        async def track_review(*args, **kwargs):
            statuses.append(job.status)
            return CodeReviewResult(raw_output="ok")

        async def track_metadata(*args, **kwargs):
            statuses.append(job.status)
            return PRMetadata(title="Test PR", html_url=PR_URL)

        async def track_callback(*args, **kwargs):
            statuses.append(job.status)
            return {"success": True, "nodeId": "tracked"}

        code_review_port.review.side_effect = track_review
        code_review_port.describe.return_value = PRDescription()
        code_review_port.improve.return_value = []
        github_port.get_pr_metadata.side_effect = track_metadata
        github_port.get_review_comments.return_value = []
        note_callback_port.send_analysis_result.side_effect = track_callback

        await pipeline.run_analysis(job.id, PR_URL)

        assert JobStatus.PENDING in statuses
        assert JobStatus.ANALYZING in statuses
        assert JobStatus.FETCHING_REVIEWS in statuses
        assert JobStatus.GENERATING_NOTE in statuses
        assert job.status == JobStatus.COMPLETED

    @patch("pr_insight.domain.pipeline.create_pr_agent")
    async def test_when_invalid_url_then_job_fails(
        self, mock_agent_factory, setup, jobs
    ):
        """Job fails with descriptive error for invalid PR URL."""
        pipeline, job, _, _, _ = setup

        await pipeline.run_analysis(job.id, "not-a-valid-url")

        assert job.status == JobStatus.FAILED
        assert "Invalid PR URL" in job.error
