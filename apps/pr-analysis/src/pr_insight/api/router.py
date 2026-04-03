from fastapi import APIRouter, BackgroundTasks, HTTPException

from pr_insight.api.schemas import AnalyzeRequest, AnalyzeResponse, JobStatusResponse
from pr_insight.domain.models import AnalysisJob, parse_pr_url
from pr_insight.domain.pipeline import AnalysisPipeline


def create_router(pipeline: AnalysisPipeline, jobs: dict[str, AnalysisJob]) -> APIRouter:
    router = APIRouter(prefix="/api/v1")

    @router.post("/analyze/pr", response_model=AnalyzeResponse)
    async def start_analysis(request: AnalyzeRequest, background_tasks: BackgroundTasks):
        pr_info = parse_pr_url(request.url)
        if pr_info is None:
            raise HTTPException(status_code=422, detail="Enter a valid GitHub PR URL")

        job = AnalysisJob(pr_url=request.url)
        jobs[job.id] = job
        background_tasks.add_task(pipeline.run_analysis, job.id, request.url)
        return AnalyzeResponse(job_id=job.id)

    @router.get("/analyze/pr/{job_id}", response_model=JobStatusResponse)
    async def get_analysis_status(job_id: str):
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return JobStatusResponse(
            id=job.id,
            status=job.status,
            result=job.result.model_dump() if job.result else None,
            error=job.error,
        )

    return router
