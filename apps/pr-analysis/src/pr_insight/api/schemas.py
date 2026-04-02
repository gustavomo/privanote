from pydantic import BaseModel

from pr_insight.domain.models import JobStatus


class AnalyzeRequest(BaseModel):
    url: str


class AnalyzeResponse(BaseModel):
    job_id: str


class JobStatusResponse(BaseModel):
    id: str
    status: JobStatus
    result: dict | None = None
    error: str | None = None
