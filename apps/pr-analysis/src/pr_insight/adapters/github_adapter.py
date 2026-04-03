"""GitHub API adapter using httpx (per D-06, D-31, D-34, D-46)."""

from __future__ import annotations

import re
import time

import httpx

from pr_insight.domain.models import PRMetadata, ReviewComment
from pr_insight.domain.ports import GitHubPort

_LINK_NEXT_RE = re.compile(r'<([^>]+)>;\s*rel="next"')


class GitHubAdapter(GitHubPort):
    """Fetches PR metadata and review comments from the GitHub REST API."""

    def __init__(self, token: str) -> None:
        self._token = token
        self._base_url = "https://api.github.com"
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    # ------------------------------------------------------------------
    # Port implementation
    # ------------------------------------------------------------------

    async def get_pr_metadata(
        self, owner: str, repo: str, number: int
    ) -> PRMetadata:
        async with httpx.AsyncClient(
            base_url=self._base_url, headers=self._headers, timeout=30.0
        ) as client:
            pr_resp = await client.get(
                f"/repos/{owner}/{repo}/pulls/{number}"
            )
            self._raise_on_error(pr_resp)
            pr_data = pr_resp.json()

            files = await self._paginated_get(
                f"{self._base_url}/repos/{owner}/{repo}/pulls/{number}/files",
                client,
            )

            return PRMetadata(
                title=pr_data.get("title", ""),
                body=pr_data.get("body", "") or "",
                state=pr_data.get("state", ""),
                author=pr_data.get("user", {}).get("login", ""),
                base_branch=pr_data.get("base", {}).get("ref", ""),
                head_branch=pr_data.get("head", {}).get("ref", ""),
                created_at=pr_data.get("created_at", ""),
                updated_at=pr_data.get("updated_at", ""),
                merged=pr_data.get("merged", False),
                additions=pr_data.get("additions", 0),
                deletions=pr_data.get("deletions", 0),
                changed_files=pr_data.get("changed_files", 0),
                files=[
                    {
                        "filename": f.get("filename", ""),
                        "status": f.get("status", ""),
                        "additions": f.get("additions", 0),
                        "deletions": f.get("deletions", 0),
                        "patch": f.get("patch", ""),
                    }
                    for f in files
                ],
                labels=[
                    lbl.get("name", "")
                    for lbl in pr_data.get("labels", [])
                ],
                html_url=pr_data.get("html_url", ""),
            )

    async def get_review_comments(
        self, owner: str, repo: str, number: int
    ) -> list[dict]:
        async with httpx.AsyncClient(
            base_url=self._base_url, headers=self._headers, timeout=30.0
        ) as client:
            base = f"{self._base_url}/repos/{owner}/{repo}"

            # Line-level review comments
            review_comments = await self._paginated_get(
                f"{base}/pulls/{number}/comments", client
            )
            # General issue/PR comments (CodeRabbit, Copilot, human)
            issue_comments = await self._paginated_get(
                f"{base}/issues/{number}/comments", client
            )
            # Review-level comments
            reviews = await self._paginated_get(
                f"{base}/pulls/{number}/reviews", client
            )

            combined: list[dict] = []
            for c in review_comments + issue_comments:
                combined.append(
                    ReviewComment(
                        author=c.get("user", {}).get("login", ""),
                        body=c.get("body", ""),
                        created_at=c.get("created_at", ""),
                        url=c.get("html_url", ""),
                    ).model_dump()
                )
            for r in reviews:
                if r.get("body"):
                    combined.append(
                        ReviewComment(
                            author=r.get("user", {}).get("login", ""),
                            body=r.get("body", ""),
                            created_at=r.get("submitted_at", ""),
                            url=r.get("html_url", ""),
                        ).model_dump()
                    )

            return combined

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _paginated_get(
        self, url: str, client: httpx.AsyncClient
    ) -> list[dict]:
        """Follow GitHub ``Link: <url>; rel="next"`` pagination headers."""
        results: list[dict] = []
        next_url: str | None = url
        while next_url:
            resp = await client.get(next_url)
            self._raise_on_error(resp)
            data = resp.json()
            if isinstance(data, list):
                results.extend(data)
            else:
                results.append(data)

            link_header = resp.headers.get("link", "")
            match = _LINK_NEXT_RE.search(link_header)
            next_url = match.group(1) if match else None
        return results

    def _raise_on_error(self, response: httpx.Response) -> None:
        """Raise descriptive errors for 404 and rate-limit responses."""
        if response.status_code == 404:
            raise ValueError(
                "Cannot access repo -- check GITHUB_TOKEN permissions"
            )
        if response.status_code == 403:
            reset_ts = int(response.headers.get("x-ratelimit-reset", "0"))
            remaining = response.headers.get("x-ratelimit-remaining")
            if remaining == "0" or reset_ts > 0:
                minutes = max(1, round((reset_ts - time.time()) / 60))
                raise ValueError(
                    f"GitHub API rate limit reached. Try again in {minutes} minutes."
                )
            raise ValueError(
                "Cannot access repo -- check GITHUB_TOKEN permissions"
            )
        response.raise_for_status()
