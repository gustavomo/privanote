"""Tests for GitHubAdapter and NoteCallbackAdapter (per D-35, D-38)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from pr_insight.adapters.github_adapter import GitHubAdapter
from pr_insight.adapters.note_callback import NoteCallbackAdapter


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------

def _make_response(
    status_code: int = 200,
    json_data: dict | list | None = None,
    headers: dict | None = None,
) -> httpx.Response:
    """Build an httpx.Response for mocking."""
    resp = httpx.Response(
        status_code=status_code,
        json=json_data,
        headers=headers or {},
        request=httpx.Request("GET", "https://api.github.com/test"),
    )
    return resp


PR_JSON = {
    "title": "Add feature X",
    "body": "This PR adds feature X.",
    "state": "open",
    "user": {"login": "octocat"},
    "base": {"ref": "main"},
    "head": {"ref": "feature-x"},
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-02T00:00:00Z",
    "merged": False,
    "additions": 10,
    "deletions": 2,
    "changed_files": 3,
    "labels": [{"name": "enhancement"}],
    "html_url": "https://github.com/owner/repo/pull/1",
}

FILES_JSON = [
    {
        "filename": "README.md",
        "status": "modified",
        "additions": 5,
        "deletions": 1,
        "patch": "@@ -1 +1 @@\n-old\n+new",
    },
]


# ------------------------------------------------------------------
# GitHubAdapter tests
# ------------------------------------------------------------------

class TestGivenAGitHubAdapterWithValidToken:
    """Tests for GitHubAdapter with mocked httpx."""

    @pytest.mark.asyncio
    async def test_when_pr_exists_then_returns_metadata(self) -> None:
        adapter = GitHubAdapter(token="ghp_test123")

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get = AsyncMock(
            side_effect=[
                _make_response(json_data=PR_JSON),
                _make_response(json_data=FILES_JSON),
            ]
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("pr_insight.adapters.github_adapter.httpx.AsyncClient", return_value=mock_client):
            result = await adapter.get_pr_metadata("owner", "repo", 1)

        assert result.title == "Add feature X"
        assert result.author == "octocat"
        assert result.base_branch == "main"
        assert result.additions == 10
        assert result.deletions == 2
        assert result.changed_files == 3
        assert len(result.files) == 1
        assert result.files[0]["filename"] == "README.md"
        assert result.labels == ["enhancement"]
        assert result.html_url == "https://github.com/owner/repo/pull/1"

    @pytest.mark.asyncio
    async def test_when_repo_not_found_then_raises_value_error(self) -> None:
        adapter = GitHubAdapter(token="ghp_test123")

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get = AsyncMock(
            return_value=_make_response(status_code=404, json_data={"message": "Not Found"}),
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("pr_insight.adapters.github_adapter.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(ValueError, match="Cannot access repo"):
                await adapter.get_pr_metadata("owner", "repo", 999)

    @pytest.mark.asyncio
    async def test_when_rate_limited_then_raises_with_retry_message(self) -> None:
        adapter = GitHubAdapter(token="ghp_test123")

        import time
        future_reset = str(int(time.time()) + 600)

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get = AsyncMock(
            return_value=_make_response(
                status_code=403,
                json_data={"message": "rate limit exceeded"},
                headers={
                    "x-ratelimit-reset": future_reset,
                    "x-ratelimit-remaining": "0",
                },
            ),
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("pr_insight.adapters.github_adapter.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(ValueError, match="GitHub API rate limit reached"):
                await adapter.get_pr_metadata("owner", "repo", 1)

    @pytest.mark.asyncio
    async def test_when_getting_review_comments_then_returns_combined_list(self) -> None:
        adapter = GitHubAdapter(token="ghp_test123")

        review_comment = [{"user": {"login": "bot"}, "body": "LGTM", "created_at": "2024-01-01T00:00:00Z", "html_url": "https://example.com/1"}]
        issue_comment = [{"user": {"login": "human"}, "body": "Looks good", "created_at": "2024-01-01T01:00:00Z", "html_url": "https://example.com/2"}]
        review = [{"user": {"login": "reviewer"}, "body": "Approved", "submitted_at": "2024-01-01T02:00:00Z", "html_url": "https://example.com/3"}]

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get = AsyncMock(
            side_effect=[
                _make_response(json_data=review_comment),
                _make_response(json_data=issue_comment),
                _make_response(json_data=review),
            ]
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("pr_insight.adapters.github_adapter.httpx.AsyncClient", return_value=mock_client):
            result = await adapter.get_review_comments("owner", "repo", 1)

        assert len(result) == 3
        assert result[0]["author"] == "bot"
        assert result[1]["author"] == "human"
        assert result[2]["author"] == "reviewer"


# ------------------------------------------------------------------
# NoteCallbackAdapter tests
# ------------------------------------------------------------------

class TestGivenANoteCallbackAdapter:
    """Tests for NoteCallbackAdapter with mocked httpx."""

    @pytest.mark.asyncio
    async def test_when_callback_succeeds_then_returns_response_with_node_id(self) -> None:
        adapter = NoteCallbackAdapter(callback_url="http://localhost:4310/internal/pr-callback")

        response_data = {"success": True, "nodeId": "abc-123"}
        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_resp = _make_response(status_code=200, json_data=response_data)
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("pr_insight.adapters.note_callback.httpx.AsyncClient", return_value=mock_client):
            result = await adapter.send_analysis_result({"title": "Test PR"})

        assert result == {"success": True, "nodeId": "abc-123"}

    @pytest.mark.asyncio
    async def test_when_callback_fails_then_raises_runtime_error(self) -> None:
        adapter = NoteCallbackAdapter(callback_url="http://localhost:4310/internal/pr-callback")

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_resp = _make_response(status_code=500, json_data={"error": "Internal Server Error"})
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("pr_insight.adapters.note_callback.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(RuntimeError, match="Note callback failed: 500"):
                await adapter.send_analysis_result({"title": "Test PR"})
