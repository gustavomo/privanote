import re
import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

PR_URL_PATTERN = re.compile(
    r"(?:https?://)?github\.com/([^/]+)/([^/]+)/pull/(\d+)"
)


class JobStatus(str, Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    FETCHING_REVIEWS = "fetching_reviews"
    GENERATING_NOTE = "generating_note"
    COMPLETED = "completed"
    FAILED = "failed"


class PRInfo(BaseModel):
    url: str
    owner: str
    repo: str
    number: int


class CodeReviewFinding(BaseModel):
    file: str = ""
    line: int | None = None
    severity: str = ""
    description: str = ""
    suggestion: str = ""


class CodeReviewResult(BaseModel):
    findings: list[CodeReviewFinding] = Field(default_factory=list)
    raw_output: str = ""


class PRDescription(BaseModel):
    summary: str = ""
    changes: dict[str, list[str]] = Field(default_factory=dict)
    raw_output: str = ""


class ImprovementSuggestion(BaseModel):
    file: str = ""
    suggestion: str = ""
    code_snippet: str = ""
    raw_output: str = ""


class ReviewComment(BaseModel):
    author: str = ""
    body: str = ""
    created_at: str = ""
    url: str = ""


class PRMetadata(BaseModel):
    title: str = ""
    body: str = ""
    state: str = ""
    author: str = ""
    base_branch: str = ""
    head_branch: str = ""
    created_at: str = ""
    updated_at: str = ""
    merged: bool = False
    additions: int = 0
    deletions: int = 0
    changed_files: int = 0
    files: list[dict] = Field(default_factory=list)
    labels: list[str] = Field(default_factory=list)
    review_comments: list[ReviewComment] = Field(default_factory=list)
    html_url: str = ""


class AnalysisResult(BaseModel):
    title: str = ""
    description: str = ""
    tags: str = "github-analysis"
    node_id: str = ""
    pr_info: PRInfo | None = None
    metadata: PRMetadata | None = None
    review: CodeReviewResult | None = None
    pr_description: PRDescription | None = None
    improvements: list[ImprovementSuggestion] = Field(default_factory=list)


class AnalysisJob(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: JobStatus = JobStatus.PENDING
    pr_url: str = ""
    result: AnalysisResult | None = None
    error: str | None = None
    created_at: datetime = Field(default_factory=datetime.now)


def parse_pr_url(url: str) -> PRInfo | None:
    match = PR_URL_PATTERN.match(url.strip())
    if not match:
        return None
    return PRInfo(
        url=url.strip(),
        owner=match.group(1),
        repo=match.group(2),
        number=int(match.group(3)),
    )
