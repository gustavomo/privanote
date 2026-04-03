"""Analysis pipeline orchestrating adapters and ADK agent (per D-03, D-05, D-23).

The pipeline collects data from all adapters, passes it to the ADK agent
for synthesis, formats the final note, calls the note callback, and
captures the returned nodeId for auto-select (D-21).
"""

from __future__ import annotations

import logging
import re
import traceback

from pr_insight.config import get_settings
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

            # Phase 1: Fetch full diff (for fallback patches) and GitHub metadata
            # Note: describe() and improve() are skipped — their data overlaps
            # with get_pr_metadata() (files) and get_review_comments() (comments),
            # saving 2 redundant GitHub API round-trips.
            job.status = JobStatus.ANALYZING
            review_result = await self._code_review_port.review(pr_url)

            # Phase 2: Fetch GitHub metadata and review comments
            job.status = JobStatus.FETCHING_REVIEWS
            metadata = await self._github_port.get_pr_metadata(
                pr_info.owner, pr_info.repo, pr_info.number
            )
            review_comments = await self._github_port.get_review_comments(
                pr_info.owner, pr_info.repo, pr_info.number
            )

            # Build pr_description from metadata.files (same data describe() fetched)
            file_changes: dict[str, list[str]] = {"modified": [], "added": [], "removed": []}
            for f in (metadata.files or []):
                status = f.get("status", "modified")
                filename = f.get("filename", "")
                bucket = "added" if status == "added" else "removed" if status == "removed" else "modified"
                file_changes[bucket].append(filename)
            from pr_insight.domain.models import PRDescription, ImprovementSuggestion
            pr_description = PRDescription(
                summary=f"PR modifies {metadata.changed_files} file(s).",
                changes=file_changes,
            )

            # Build improvements from review comments (same data improve() fetched)
            improvements = [
                ImprovementSuggestion(
                    file=c.get("path", ""),
                    suggestion=c.get("body", ""),
                )
                for c in review_comments
                if c.get("body")
            ]

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
            # Exclude raw_output fields — they're large and only used internally
            result_dict = result.model_dump(exclude={"review": {"raw_output"}, "pr_description": {"raw_output"}, "improvements": {"__all__": {"raw_output"}}})
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


def _truncate_patch(patch: str, max_lines: int) -> tuple[str, bool]:
    """Truncate a patch to *max_lines* keeping the head. Returns (text, was_truncated)."""
    lines = patch.split("\n")
    if len(lines) <= max_lines:
        return patch, False
    return "\n".join(lines[:max_lines]), True


def _build_data_prompt(
    pr_url: str,
    pr_info,
    metadata,
    review_result,
    pr_description,
    improvements,
    review_comments: list[dict],
) -> str:
    """Build a token-efficient data prompt for the ADK agent.

    Optimizations vs. the original implementation:
    - Per-file diffs are capped at ``max_diff_lines_per_file`` lines.
    - Total diff budget is capped at ``max_total_diff_lines`` lines.
    - Review comment bodies are capped at ``max_review_comment_chars``.
    - Redundant fields (raw_output, duplicate PR body) are omitted.
    - Metadata is compacted into fewer lines.
    """
    cfg = get_settings()
    max_per_file = cfg.max_diff_lines_per_file
    max_total = cfg.max_total_diff_lines

    sections = [
        f"# PR Data for Analysis",
        f"**URL:** {pr_url}  **Repo:** {pr_info.owner}/{pr_info.repo}  **#{pr_info.number}**",
        f"**Title:** {metadata.title}  |  **Author:** {metadata.author}  |  **State:** {metadata.state}",
        f"**Branches:** {metadata.base_branch} <- {metadata.head_branch}  |  "
        f"**+{metadata.additions}/-{metadata.deletions}** across {metadata.changed_files} files  |  "
        f"**Merged:** {metadata.merged}",
    ]
    if metadata.labels:
        sections.append(f"**Labels:** {', '.join(metadata.labels)}")

    # PR body (author's own description — single source, not duplicated)
    if metadata.body and metadata.body.strip():
        body = metadata.body.strip()[:1000]
        sections.append(f"\n## PR Body\n{body}")

    # Build full-diff index keyed by filename for fallback
    full_diff_by_file: dict[str, str] = {}
    if review_result and review_result.raw_output:
        full_diff_by_file = _extract_per_file_diffs(review_result.raw_output)

    # Changed files with per-file diffs — budget-capped
    total_diff_lines = 0
    budget_exhausted = False
    if metadata.files:
        sections.append("\n## Changed Files with Diffs")
        for f in metadata.files:
            filename = f.get("filename", "")
            status = f.get("status", "modified")
            additions = f.get("additions", 0)
            deletions = f.get("deletions", 0)
            patch = f.get("patch", "") or full_diff_by_file.get(filename, "")

            header = f"\n### `{filename}` ({status}) +{additions}/-{deletions}"

            if not patch:
                sections.append(f"{header}\n_(binary or empty — no diff)_")
                continue

            if budget_exhausted:
                sections.append(f"{header}\n_(diff omitted — total budget reached)_")
                continue

            remaining = max_total - total_diff_lines
            effective_max = min(max_per_file, remaining)
            patch, was_truncated = _truncate_patch(patch, effective_max)
            patch_line_count = patch.count("\n") + 1
            total_diff_lines += patch_line_count

            suffix = ""
            if was_truncated:
                suffix = "\n_(truncated — see full diff on GitHub)_"
            sections.append(f"{header}\n```diff\n{patch}\n```{suffix}")

            if total_diff_lines >= max_total:
                budget_exhausted = True

    # File change summary from describe() — only the structured bits
    if pr_description and pr_description.changes:
        non_empty = {k: v for k, v in pr_description.changes.items() if v}
        if non_empty:
            sections.append("\n## File Change Summary")
            for category, items in non_empty.items():
                sections.append(f"**{category}:** {', '.join(items)}")

    # Code review findings (structured only)
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

    # Improvement suggestions — compact
    if improvements:
        sections.append("\n## Improvement Suggestions")
        for imp in improvements:
            body = imp.suggestion[:cfg.max_review_comment_chars]
            sections.append(f"- `{imp.file}`: {body}")

    # GitHub review comments — compact
    if review_comments:
        sections.append("\n## Review Comments")
        for comment in review_comments:
            body = comment.get("body", "")[:cfg.max_review_comment_chars]
            sections.append(
                f"- **{comment.get('author', 'unknown')}**: {body}"
            )

    sections.append("\n---\nSynthesize the above into the structured analysis note.")
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
