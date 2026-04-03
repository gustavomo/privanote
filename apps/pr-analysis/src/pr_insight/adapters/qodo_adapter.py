"""Qodo PR-Agent adapter wrapping the pr-agent library (per D-09, D-11, D-03)."""

from __future__ import annotations

import asyncio

from pr_agent import cli as pr_agent_cli
from pr_agent.config_loader import get_settings

from pr_insight.domain.models import (
    CodeReviewFinding,
    CodeReviewResult,
    ImprovementSuggestion,
    PRDescription,
)
from pr_insight.domain.ports import CodeReviewPort


class QodoAdapter(CodeReviewPort):
    """Wraps Qodo PR-Agent library for code review, describe, and improve.

    Uses ``asyncio.to_thread`` to avoid blocking the event loop
    since pr-agent calls are synchronous (per Pitfall 2).
    Settings are configured fresh before each call (per Pitfall 6).
    """

    def __init__(self, github_token: str, openai_api_key: str) -> None:
        self._github_token = github_token
        self._openai_api_key = openai_api_key

    def _configure_qodo(self) -> None:
        """Set Qodo global settings fresh before each call (per Pitfall 6)."""
        settings = get_settings()
        settings.set("CONFIG.git_provider", "github")
        settings.set("openai.key", self._openai_api_key)
        settings.set("github.user_token", self._github_token)

    async def review(self, pr_url: str) -> CodeReviewResult:
        try:
            self._configure_qodo()
            result = await asyncio.to_thread(
                pr_agent_cli.run_command, pr_url, "/review"
            )
            return self._parse_review_result(result)
        except Exception as exc:
            raise RuntimeError(f"Qodo review failed: {exc}") from exc

    async def describe(self, pr_url: str) -> PRDescription:
        try:
            self._configure_qodo()
            result = await asyncio.to_thread(
                pr_agent_cli.run_command, pr_url, "/describe"
            )
            return self._parse_describe_result(result)
        except Exception as exc:
            raise RuntimeError(f"Qodo describe failed: {exc}") from exc

    async def improve(self, pr_url: str) -> list[ImprovementSuggestion]:
        try:
            self._configure_qodo()
            result = await asyncio.to_thread(
                pr_agent_cli.run_command, pr_url, "/improve"
            )
            return self._parse_improve_result(result)
        except Exception as exc:
            raise RuntimeError(f"Qodo improve failed: {exc}") from exc

    # ------------------------------------------------------------------
    # Result parsers – handle both string and dict returns gracefully.
    # The exact return format of cli.run_command() is under-documented
    # (per RESEARCH.md Open Question 2), so we store raw output when
    # structured parsing is not possible.
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_review_result(result: object) -> CodeReviewResult:
        raw = str(result) if result is not None else ""
        findings: list[CodeReviewFinding] = []

        if isinstance(result, dict):
            for item in result.get("findings", []):
                findings.append(
                    CodeReviewFinding(
                        file=item.get("file", ""),
                        line=item.get("line"),
                        severity=item.get("severity", ""),
                        description=item.get("description", ""),
                        suggestion=item.get("suggestion", ""),
                    )
                )

        return CodeReviewResult(findings=findings, raw_output=raw)

    @staticmethod
    def _parse_describe_result(result: object) -> PRDescription:
        raw = str(result) if result is not None else ""
        summary = ""
        changes: dict[str, list[str]] = {}

        if isinstance(result, dict):
            summary = result.get("summary", "")
            changes = result.get("changes", {})

        return PRDescription(summary=summary, changes=changes, raw_output=raw)

    @staticmethod
    def _parse_improve_result(result: object) -> list[ImprovementSuggestion]:
        raw = str(result) if result is not None else ""
        suggestions: list[ImprovementSuggestion] = []

        if isinstance(result, list):
            for item in result:
                suggestions.append(
                    ImprovementSuggestion(
                        file=item.get("file", "") if isinstance(item, dict) else "",
                        suggestion=item.get("suggestion", "") if isinstance(item, dict) else str(item),
                        code_snippet=item.get("code_snippet", "") if isinstance(item, dict) else "",
                        raw_output=raw,
                    )
                )
        else:
            # Single string or dict -- wrap as one suggestion with raw output
            suggestions.append(
                ImprovementSuggestion(raw_output=raw)
            )

        return suggestions
