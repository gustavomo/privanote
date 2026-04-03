"""Analysis pipeline orchestrating adapters and ADK agent (per D-03, D-05, D-23).

The pipeline collects data from all adapters, passes it to the ADK agent
for synthesis, formats the final note, calls the note callback, and
captures the returned nodeId for auto-select (D-21).
"""

from __future__ import annotations

import logging
import re
import traceback

from pr_insight.domain.agent import create_pr_agent
from pr_insight.domain.models import (
    AnalysisJob,
    AnalysisResult,
    JobStatus,
    parse_pr_url,
)
from pr_insight.domain.ports import CodeReviewPort, GitHubPort, NoteCallbackPort

logger = logging.getLogger(__name__)


class AnalysisPipeline:
    """Orchestrates PR analysis through adapters and ADK agent.

    Constructor injection of ports per D-46. Jobs dict is shared with
    the router so both can read/write job state.
    """

    def __init__(
        self,
        github_port: GitHubPort,
        code_review_port: CodeReviewPort,
        note_callback_port: NoteCallbackPort,
        jobs: dict[str, AnalysisJob],
    ) -> None:
        self._github_port = github_port
        self._code_review_port = code_review_port
        self._note_callback_port = note_callback_port
        self._jobs = jobs

    async def run_analysis(self, job_id: str, pr_url: str) -> None:
        """Run the full analysis pipeline for a PR.

        Updates job status through phases:
        PENDING -> ANALYZING -> FETCHING_REVIEWS -> GENERATING_NOTE -> COMPLETED

        On ANY failure: sets job to FAILED with error message (per D-05).
        """
        job = self._jobs.get(job_id)
        if not job:
            logger.error("Job %s not found in store", job_id)
            return

        try:
            # Parse the PR URL
            pr_info = parse_pr_url(pr_url)
            if pr_info is None:
                raise ValueError(f"Invalid PR URL: {pr_url}")

            # Phase 1: Fetch code reviews from Qodo
            job.status = JobStatus.ANALYZING
            review_result = await self._code_review_port.review(pr_url)
            pr_description = await self._code_review_port.describe(pr_url)
            improvements = await self._code_review_port.improve(pr_url)

            # Phase 2: Fetch GitHub metadata and review comments
            job.status = JobStatus.FETCHING_REVIEWS
            metadata = await self._github_port.get_pr_metadata(
                pr_info.owner, pr_info.repo, pr_info.number
            )
            review_comments = await self._github_port.get_review_comments(
                pr_info.owner, pr_info.repo, pr_info.number
            )

            # Phase 3: Generate note via ADK agent synthesis
            job.status = JobStatus.GENERATING_NOTE
            description = await self._synthesize_note(
                pr_url=pr_url,
                pr_info=pr_info,
                metadata=metadata,
                review_result=review_result,
                pr_description=pr_description,
                improvements=improvements,
                review_comments=review_comments,
            )

            # Build the title per D-25: "{PR title} -- {owner/repo}#{number}"
            title = f"{metadata.title} -- {pr_info.owner}/{pr_info.repo}#{pr_info.number}"

            # Build analysis result
            result = AnalysisResult(
                title=title,
                description=description,
                tags="github-analysis",
                pr_info=pr_info,
                metadata=metadata,
                review=review_result,
                pr_description=pr_description,
                improvements=improvements,
            )
            job.result = result

            # Phase 4: Send to note callback and capture nodeId (D-21, D-47)
            result_dict = result.model_dump()
            callback_response = await self._note_callback_port.send_analysis_result(
                result_dict
            )

            # Store nodeId so polling client can use it for auto-select (D-21)
            if callback_response and callback_response.get("nodeId"):
                job.result.node_id = str(callback_response["nodeId"])

            job.status = JobStatus.COMPLETED

        except Exception as exc:
            logger.error(
                "Pipeline failed for job %s: %s\n%s",
                job_id,
                exc,
                traceback.format_exc(),
            )
            job.status = JobStatus.FAILED
            job.error = str(exc)

    async def _synthesize_note(
        self,
        pr_url: str,
        pr_info,
        metadata,
        review_result,
        pr_description,
        improvements,
        review_comments: list[dict],
    ) -> str:
        """Use ADK agent to synthesize PR data into structured note.

        Falls back to a template-based format if agent synthesis fails.
        """
        # Build the data payload for the agent
        data_prompt = _build_data_prompt(
            pr_url=pr_url,
            pr_info=pr_info,
            metadata=metadata,
            review_result=review_result,
            pr_description=pr_description,
            improvements=improvements,
            review_comments=review_comments,
        )

        try:
            agent = create_pr_agent()
            # Use the agent's generate_content for single-turn synthesis
            from google.adk.runners import Runner
            from google.adk.sessions import InMemorySessionService
            from google.genai import types

            session_service = InMemorySessionService()
            runner = Runner(
                agent=agent,
                app_name="pr_insight",
                session_service=session_service,
            )

            session = await session_service.create_session(
                app_name="pr_insight", user_id="pipeline"
            )

            user_message = types.Content(
                role="user",
                parts=[types.Part(text=data_prompt)],
            )

            response_parts: list[str] = []
            async for event in runner.run_async(
                user_id="pipeline",
                session_id=session.id,
                new_message=user_message,
            ):
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.text:
                            response_parts.append(part.text)

            if response_parts:
                return "\n".join(response_parts)

            # Fallback if agent returned nothing
            logger.warning("Agent returned empty response, using template fallback")
            return _format_fallback_note(
                pr_url, pr_info, metadata, review_result,
                pr_description, improvements, review_comments,
            )

        except Exception as exc:
            logger.warning(
                "Agent synthesis failed (%s), using template fallback\n%s",
                exc,
                traceback.format_exc(),
            )
            return _format_fallback_note(
                pr_url, pr_info, metadata, review_result,
                pr_description, improvements, review_comments,
            )


def _build_data_prompt(
    pr_url: str,
    pr_info,
    metadata,
    review_result,
    pr_description,
    improvements,
    review_comments: list[dict],
) -> str:
    """Build the data prompt to send to the ADK agent for synthesis."""
    sections = [
        f"# PR Data for Analysis\n",
        f"**PR URL:** {pr_url}",
        f"**Repository:** {pr_info.owner}/{pr_info.repo}",
        f"**PR Number:** #{pr_info.number}",
        f"**GitHub Link:** {metadata.html_url}\n",
        f"## PR Metadata",
        f"- **Title:** {metadata.title}",
        f"- **Author:** {metadata.author}",
        f"- **State:** {metadata.state}",
        f"- **Base:** {metadata.base_branch} <- **Head:** {metadata.head_branch}",
        f"- **Created:** {metadata.created_at}",
        f"- **Updated:** {metadata.updated_at}",
        f"- **Merged:** {metadata.merged}",
        f"- **Additions:** +{metadata.additions}",
        f"- **Deletions:** -{metadata.deletions}",
        f"- **Changed Files:** {metadata.changed_files}",
        f"- **Labels:** {', '.join(metadata.labels) if metadata.labels else 'None'}",
    ]

    # Build full-diff index keyed by filename for fallback (GitHub truncates
    # per-file patches for large files; the full diff blob has no such limit)
    full_diff_by_file: dict[str, str] = {}
    if review_result and review_result.raw_output:
        full_diff_by_file = _extract_per_file_diffs(review_result.raw_output)

    # Changed files with per-file diffs (patch from GitHub API)
    if metadata.files:
        sections.append("\n## Changed Files with Diffs")
        for f in metadata.files:
            filename = f.get("filename", "")
            status = f.get("status", "modified")
            additions = f.get("additions", 0)
            deletions = f.get("deletions", 0)
            patch = f.get("patch", "") or full_diff_by_file.get(filename, "")
            file_url = f"{metadata.html_url}/files"

            sections.append(
                f"\n### `{filename}` ({status}) +{additions}/-{deletions}"
                f"\n[View on GitHub]({file_url})"
            )
            if patch:
                sections.append(f"```diff\n{patch}\n```")
            else:
                sections.append("_(binary file — no diff available)_")

    # PR Description from Qodo
    if pr_description:
        sections.append(f"\n## PR Description (from Qodo)")
        sections.append(f"**Summary:** {pr_description.summary}")
        if pr_description.changes:
            for category, items in pr_description.changes.items():
                sections.append(f"**{category}:**")
                for item in items:
                    sections.append(f"  - {item}")

    # Code Review Findings from Qodo (structured findings only — per-file diffs
    # are already included above in Changed Files with Diffs)
    if review_result and review_result.findings:
        sections.append("\n## Code Review Findings")
        for finding in review_result.findings:
            sections.append(
                f"- [{finding.severity}] `{finding.file}`"
                f"{f' L{finding.line}' if finding.line else ''}: "
                f"{finding.description}"
            )
            if finding.suggestion:
                sections.append(f"  Suggestion: {finding.suggestion}")

    # Improvement Suggestions from Qodo
    if improvements:
        sections.append("\n## Improvement Suggestions (from Qodo)")
        for imp in improvements:
            sections.append(f"- `{imp.file}`: {imp.suggestion}")
            if imp.code_snippet:
                sections.append(f"  ```\n  {imp.code_snippet}\n  ```")

    # GitHub Review Comments
    if review_comments:
        sections.append("\n## GitHub Review Comments")
        for comment in review_comments:
            sections.append(
                f"- **{comment.get('author', 'unknown')}** ({comment.get('created_at', '')}): "
                f"{comment.get('body', '')[:500]}"
            )
            if comment.get("url"):
                sections.append(f"  Link: {comment['url']}")

    # Body of the PR
    if metadata.body:
        sections.append(f"\n## PR Body\n{metadata.body}")

    sections.append("\n---\nPlease synthesize all the above data into the structured analysis note.")

    return "\n".join(sections)


def _format_fallback_note(
    pr_url: str,
    pr_info,
    metadata,
    review_result,
    pr_description,
    improvements,
    review_comments: list[dict],
) -> str:
    """Template-based fallback when ADK agent synthesis fails."""
    sections = []

    # Executive Summary
    sections.append("## Executive Summary\n")
    changed_files_list = [f.get("filename", "") for f in (metadata.files or [])]
    files_preview = ", ".join(f"`{f}`" for f in changed_files_list[:5])
    if len(changed_files_list) > 5:
        files_preview += f" and {len(changed_files_list) - 5} more"

    if metadata.body and len(metadata.body.strip()) > 20:
        # Use the PR author's own description as the basis for the summary
        sections.append(
            f"[{metadata.title}]({metadata.html_url}) by **{metadata.author}** "
            f"(+{metadata.additions}/-{metadata.deletions} across {metadata.changed_files} files).\n"
        )
        sections.append(metadata.body.strip()[:600])
    else:
        sections.append(
            f"[{metadata.title}]({metadata.html_url}) by **{metadata.author}** — "
            f"+{metadata.additions}/-{metadata.deletions} across {metadata.changed_files} files. "
            f"Changed files: {files_preview}."
        )

    # Code Review Findings
    sections.append("\n## Code Review Findings\n")
    if review_result and review_result.findings:
        for finding in review_result.findings:
            sections.append(
                f"- **[{finding.severity}]** `{finding.file}`"
                f"{f' L{finding.line}' if finding.line else ''}: "
                f"{finding.description}"
            )
    elif review_comments:
        for comment in review_comments:
            sections.append(
                f"- **{comment.get('author', 'unknown')}**: {comment.get('body', '')[:300]}"
            )
    else:
        sections.append("No review comments on this PR.")

    # Categorized Changes
    sections.append("\n## Categorized Changes\n")
    if metadata.files:
        for f in metadata.files:
            status = f.get("status", "modified")
            filename = f.get("filename", "")
            sections.append(f"- `{filename}` ({status}) +{f.get('additions', 0)}/-{f.get('deletions', 0)}")
    else:
        sections.append("No file change details available.")

    # Improvement Suggestions
    sections.append("\n## Improvement Suggestions\n")
    if improvements:
        for imp in improvements:
            sections.append(f"- `{imp.file}`: {imp.suggestion}")
    else:
        sections.append("No improvement suggestions available.")

    # Impact Analysis
    sections.append("\n## Impact Analysis\n")
    sections.append(f"- **Lines added:** {metadata.additions}")
    sections.append(f"- **Lines deleted:** {metadata.deletions}")
    sections.append(f"- **Files changed:** {metadata.changed_files}")

    # Note: Architecture Diagram omitted in fallback — only the ADK agent
    # can evaluate whether a diagram is meaningful for this PR.

    return "\n".join(sections)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DIFF_FILE_HEADER = re.compile(r"^diff --git a/.+ b/(.+)$", re.MULTILINE)


def _extract_per_file_diffs(full_diff: str) -> dict[str, str]:
    """Split a unified diff blob into a dict keyed by filename.

    GitHub's per-file ``patch`` field is capped at ~256 changed lines.
    The full diff fetched via Accept: application/vnd.github.v3.diff has no
    such cap, so we parse it as a fallback for files whose patch was empty.
    """
    result: dict[str, str] = {}
    matches = list(_DIFF_FILE_HEADER.finditer(full_diff))
    for i, match in enumerate(matches):
        filename = match.group(1)
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(full_diff)
        result[filename] = full_diff[start:end].strip()
    return result
