"""Qodo/code-review adapter using the GitHub API for PR diff and file changes.

pr-agent cannot be installed alongside google-adk due to a starlette version
conflict (pr-agent pins fastapi==0.111.0 which requires starlette<0.38.0,
while google-adk requires starlette>=0.49.1). This adapter fetches the same
raw data (diff, file changes) directly from the GitHub REST API instead.
The ADK agent handles AI synthesis from this raw data.
"""

from __future__ import annotations

import httpx

from pr_insight.domain.models import (
    CodeReviewFinding,
    CodeReviewResult,
    ImprovementSuggestion,
    PRDescription,
)
from pr_insight.domain.ports import CodeReviewPort


class QodoAdapter(CodeReviewPort):
    """Fetches PR diff and file-change data from the GitHub API.

    Returns raw diff content that the ADK agent uses for analysis.
    Constructor injection compatible with the original interface (per D-46).
    The openai_api_key param is kept for interface compatibility but unused here
    — the ADK agent owns model calls.
    """

    def __init__(self, github_token: str, openai_api_key: str) -> None:
        self._headers = {
            "Authorization": f"Bearer {github_token}",
            "Accept": "application/vnd.github.v3.diff",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        self._json_headers = {
            "Authorization": f"Bearer {github_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        self._base_url = "https://api.github.com"

    def _parse_pr_url(self, pr_url: str) -> tuple[str, str, int]:
        """Extract owner, repo, number from a GitHub PR URL."""
        parts = pr_url.rstrip("/").split("/")
        # https://github.com/{owner}/{repo}/pull/{number}
        number = int(parts[-1])
        owner = parts[-4]
        repo = parts[-3]
        return owner, repo, number

    async def review(self, pr_url: str) -> CodeReviewResult:
        """Fetch the full PR diff for code review analysis."""
        try:
            owner, repo, number = self._parse_pr_url(pr_url)
            url = f"{self._base_url}/repos/{owner}/{repo}/pulls/{number}"
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self._headers)
                response.raise_for_status()
                raw_diff = response.text
            return CodeReviewResult(findings=[], raw_output=raw_diff)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                raise RuntimeError("Cannot access repo — check GITHUB_TOKEN permissions") from exc
            raise RuntimeError(f"GitHub diff fetch failed: {exc}") from exc
        except Exception as exc:
            raise RuntimeError(f"Code review fetch failed: {exc}") from exc

    async def describe(self, pr_url: str) -> PRDescription:
        """Fetch the list of changed files for PR description context."""
        try:
            owner, repo, number = self._parse_pr_url(pr_url)
            url = f"{self._base_url}/repos/{owner}/{repo}/pulls/{number}/files"
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self._json_headers)
                response.raise_for_status()
                files_data = response.json()

            changes: dict[str, list[str]] = {"modified": [], "added": [], "removed": []}
            for f in files_data:
                status = f.get("status", "modified")
                filename = f.get("filename", "")
                if status == "added":
                    changes["added"].append(filename)
                elif status == "removed":
                    changes["removed"].append(filename)
                else:
                    changes["modified"].append(filename)

            summary = f"PR modifies {len(files_data)} file(s)."
            return PRDescription(summary=summary, changes=changes, raw_output=str(files_data))
        except Exception as exc:
            raise RuntimeError(f"PR files fetch failed: {exc}") from exc

    async def improve(self, pr_url: str) -> list[ImprovementSuggestion]:
        """Fetch existing PR review comments as improvement context."""
        try:
            owner, repo, number = self._parse_pr_url(pr_url)
            url = f"{self._base_url}/repos/{owner}/{repo}/pulls/{number}/comments"
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self._json_headers)
                response.raise_for_status()
                comments = response.json()

            suggestions: list[ImprovementSuggestion] = []
            for comment in comments:
                suggestions.append(
                    ImprovementSuggestion(
                        file=comment.get("path", ""),
                        suggestion=comment.get("body", ""),
                        code_snippet=comment.get("diff_hunk", ""),
                        raw_output=comment.get("body", ""),
                    )
                )
            return suggestions
        except Exception as exc:
            raise RuntimeError(f"PR comments fetch failed: {exc}") from exc
