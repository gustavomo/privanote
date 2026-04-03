"""Tests for QodoAdapter with mocked pr-agent library (per D-35, D-38)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from pr_insight.adapters.qodo_adapter import QodoAdapter


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------

@pytest.fixture
def adapter() -> QodoAdapter:
    return QodoAdapter(github_token="ghp_test", openai_api_key="sk-test")


# ------------------------------------------------------------------
# QodoAdapter tests
# ------------------------------------------------------------------

class TestGivenAQodoAdapterWithCredentials:
    """Tests for QodoAdapter with mocked pr-agent CLI and settings."""

    @pytest.mark.asyncio
    async def test_when_review_succeeds_then_returns_code_review_result(
        self, adapter: QodoAdapter
    ) -> None:
        mock_settings = MagicMock()
        with (
            patch(
                "pr_insight.adapters.qodo_adapter.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "pr_insight.adapters.qodo_adapter.pr_agent_cli"
            ) as mock_cli,
        ):
            mock_cli.run_command.return_value = "Review output text"
            result = await adapter.review("https://github.com/o/r/pull/1")

        assert result.raw_output == "Review output text"
        assert result.findings == []

    @pytest.mark.asyncio
    async def test_when_review_returns_dict_then_parses_findings(
        self, adapter: QodoAdapter
    ) -> None:
        mock_settings = MagicMock()
        review_data = {
            "findings": [
                {
                    "file": "main.py",
                    "line": 42,
                    "severity": "warning",
                    "description": "Unused import",
                    "suggestion": "Remove it",
                }
            ]
        }
        with (
            patch(
                "pr_insight.adapters.qodo_adapter.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "pr_insight.adapters.qodo_adapter.pr_agent_cli"
            ) as mock_cli,
        ):
            mock_cli.run_command.return_value = review_data
            result = await adapter.review("https://github.com/o/r/pull/1")

        assert len(result.findings) == 1
        assert result.findings[0].file == "main.py"
        assert result.findings[0].severity == "warning"

    @pytest.mark.asyncio
    async def test_when_describe_succeeds_then_returns_pr_description(
        self, adapter: QodoAdapter
    ) -> None:
        mock_settings = MagicMock()
        with (
            patch(
                "pr_insight.adapters.qodo_adapter.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "pr_insight.adapters.qodo_adapter.pr_agent_cli"
            ) as mock_cli,
        ):
            mock_cli.run_command.return_value = "Description text"
            result = await adapter.describe("https://github.com/o/r/pull/1")

        assert result.raw_output == "Description text"
        assert result.summary == ""

    @pytest.mark.asyncio
    async def test_when_improve_succeeds_then_returns_suggestions(
        self, adapter: QodoAdapter
    ) -> None:
        mock_settings = MagicMock()
        with (
            patch(
                "pr_insight.adapters.qodo_adapter.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "pr_insight.adapters.qodo_adapter.pr_agent_cli"
            ) as mock_cli,
        ):
            mock_cli.run_command.return_value = "Improvement suggestions text"
            result = await adapter.improve("https://github.com/o/r/pull/1")

        assert len(result) >= 1
        assert result[0].raw_output == "Improvement suggestions text"

    @pytest.mark.asyncio
    async def test_when_review_fails_then_raises_with_context(
        self, adapter: QodoAdapter
    ) -> None:
        mock_settings = MagicMock()
        with (
            patch(
                "pr_insight.adapters.qodo_adapter.get_settings",
                return_value=mock_settings,
            ),
            patch(
                "pr_insight.adapters.qodo_adapter.pr_agent_cli"
            ) as mock_cli,
        ):
            mock_cli.run_command.side_effect = ConnectionError("API timeout")
            with pytest.raises(RuntimeError, match="Qodo review failed"):
                await adapter.review("https://github.com/o/r/pull/1")

    @pytest.mark.asyncio
    async def test_when_called_then_configures_settings_fresh(
        self, adapter: QodoAdapter
    ) -> None:
        mock_settings = MagicMock()
        with (
            patch(
                "pr_insight.adapters.qodo_adapter.get_settings",
                return_value=mock_settings,
            ) as mock_get_settings,
            patch(
                "pr_insight.adapters.qodo_adapter.pr_agent_cli"
            ) as mock_cli,
        ):
            mock_cli.run_command.return_value = "output"
            await adapter.review("https://github.com/o/r/pull/1")

        mock_get_settings.assert_called_once()
        calls = mock_settings.set.call_args_list
        keys_set = [c[0][0] for c in calls]
        assert "CONFIG.git_provider" in keys_set
        assert "openai.key" in keys_set
        assert "github.user_token" in keys_set
