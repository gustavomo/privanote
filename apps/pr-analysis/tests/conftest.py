import os

import pytest
from pr_insight.config import Settings

# Dedicated test repo with a known, stable PR as fixture (per D-39).
# This should be a small, merged PR in a public repo that will not change.
# Override via TEST_PR_URL env var for your own test fixture.
TEST_PR_URL = os.environ.get(
    "TEST_PR_URL",
    "https://github.com/anthropics/anthropic-cookbook/pull/1",
)


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        github_token="test-token",
        openai_api_key="test-key",
        qodo_service_port=8100,
        note_callback_url="http://127.0.0.1:4310/internal/pr-callback",
    )


@pytest.fixture
def test_pr_url() -> str:
    """Known, stable PR URL for integration tests (per D-39)."""
    return TEST_PR_URL
