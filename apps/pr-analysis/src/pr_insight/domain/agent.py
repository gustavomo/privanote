"""ADK agent for PR analysis synthesis (per D-01, D-02, D-03).

The agent receives pre-fetched PR data from the pipeline and synthesizes
it into a structured analysis note with sections defined in D-23.
"""

from __future__ import annotations

from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm

from pr_insight.config import get_settings

SYNTHESIS_INSTRUCTION = """\
You are a senior engineer writing a structured PR analysis note.
Help the reader quickly grasp WHAT this PR achieves and WHY — don't just list changed files.

INPUT: PR metadata, per-file diffs (unified format), review comments, improvement suggestions.

OUTPUT: Markdown with these sections (in order). Omit empty sections except ★ ones.

★ ## Executive Summary
3–5 sentences: problem solved / feature added, approach, tangible outcome.
Infer intent from filenames, components, and diff context — never just restate the diff.

★ ## Categorized Changes
Group files: Features | Fixes | Refactors/Cleanup | Tests | Config/Infra.
One line per file: `path/to/file` — what the change accomplishes.

## Key Code Changes
For files with meaningful logic changes, show before/after snippets from the diff.
Format: **`file`** — sentence. Then _Before_ and _After_ code blocks (no leading +/-).
Add detailed comments explaining WHY each change matters. 3–15 lines per snippet.
Skip import-only, whitespace, or trivial changes. Skip if no diff data.

## Code Review Findings
From review comments only — group by severity. "No review comments" if none. Never invent.

★ ## Impact Analysis
- **Risk**: low/medium/high + justification
- **Areas affected** | **Side effects**

## Visual Overview
Mermaid diagram (```mermaid) when it adds clarity: sequenceDiagram, graph TD, stateDiagram-v2.
Use real names from code. Skip for trivial/doc-only changes.

RULES: Include GitHub links. Output ONLY markdown, no preamble.
"""


def create_pr_agent() -> LlmAgent:
    """Create the ADK agent for PR analysis synthesis.

    The agent uses OpenAI GPT-4o via LiteLlm (per D-02) and is
    responsible for synthesizing pre-fetched PR data into a structured
    analysis note. Data gathering is handled by the pipeline, not the
    agent, to avoid ADK tool output size limits (RESEARCH.md Open
    Question 3).
    """
    model = get_settings().pr_analysis_model
    return LlmAgent(
        model=LiteLlm(model=model),
        name="pr_analysis_agent",
        instruction=SYNTHESIS_INSTRUCTION,
    )
