from abc import ABC, abstractmethod

from pr_insight.domain.models import (
    CodeReviewResult,
    ImprovementSuggestion,
    PRDescription,
    PRMetadata,
)


class CodeReviewPort(ABC):
    @abstractmethod
    async def review(self, pr_url: str) -> CodeReviewResult:
        ...

    @abstractmethod
    async def describe(self, pr_url: str) -> PRDescription:
        ...

    @abstractmethod
    async def improve(self, pr_url: str) -> list[ImprovementSuggestion]:
        ...


class GitHubPort(ABC):
    @abstractmethod
    async def get_pr_metadata(
        self, owner: str, repo: str, number: int
    ) -> PRMetadata:
        ...

    @abstractmethod
    async def get_review_comments(
        self, owner: str, repo: str, number: int
    ) -> list[dict]:
        ...


class NoteCallbackPort(ABC):
    @abstractmethod
    async def send_analysis_result(self, result: dict) -> dict:
        """Send analysis result to the callback endpoint.

        Returns the callback response dict, which includes nodeId
        needed for auto-select in the main window (per D-21).
        Expected response shape: {"success": True, "nodeId": "..."}
        """
        ...
