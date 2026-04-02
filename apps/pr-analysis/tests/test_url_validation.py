from pr_insight.domain.models import parse_pr_url


class TestGivenAGitHubPrUrl:
    def test_when_valid_url_then_returns_pr_info(self) -> None:
        result = parse_pr_url("https://github.com/owner/repo/pull/123")
        assert result is not None
        assert result.owner == "owner"
        assert result.repo == "repo"
        assert result.number == 123

    def test_when_url_without_protocol_then_returns_pr_info(self) -> None:
        result = parse_pr_url("github.com/owner/repo/pull/456")
        assert result is not None
        assert result.number == 456

    def test_when_url_has_extra_path_then_still_matches(self) -> None:
        result = parse_pr_url("https://github.com/org/project/pull/789")
        assert result is not None
        assert result.owner == "org"

    def test_when_url_is_not_a_pr_then_returns_none(self) -> None:
        result = parse_pr_url("https://github.com/owner/repo/issues/123")
        assert result is None

    def test_when_url_is_empty_then_returns_none(self) -> None:
        result = parse_pr_url("")
        assert result is None

    def test_when_url_is_random_text_then_returns_none(self) -> None:
        result = parse_pr_url("not a url")
        assert result is None

    def test_when_draft_pr_url_then_returns_pr_info(self) -> None:
        result = parse_pr_url("https://github.com/owner/repo/pull/1")
        assert result is not None
        assert result.number == 1
