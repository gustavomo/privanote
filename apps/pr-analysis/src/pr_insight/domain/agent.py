"""ADK agent for PR analysis synthesis (per D-01, D-02, D-03).

The agent receives pre-fetched PR data from the pipeline and synthesizes
it into a structured analysis note with sections defined in D-23.
"""

from __future__ import annotations

from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm

SYNTHESIS_INSTRUCTION = """\
You are a senior software engineer writing a structured PR analysis note.

You will receive pre-fetched data about a GitHub pull request including:
- PR metadata (title, author, branches, files changed)
- Code review findings (issues, suggestions)
- PR description/summary
- Improvement suggestions
- Review comments from GitHub

Synthesize all this information into a well-structured analysis note with
these exact sections (in order):

## Executive Summary
A concise 2-3 sentence overview of the PR: what it does, why, and key impact.

## Code Review Findings
List each finding with severity, file, and description. Group by severity
(critical, warning, suggestion). Include full GitHub links for files where
available.

## Categorized Changes
Organize changed files into these categories:
- **Features**: New functionality added
- **Fixes**: Bug fixes
- **Refactors**: Code restructuring without behavior change
- **Tests**: Test additions or modifications

For each file, include the full GitHub link to the file in the PR.

## Improvement Suggestions
List actionable improvement suggestions with code snippets where available.

## Impact Analysis
Analyze the impact of the PR:
- Lines added/deleted and files changed
- Risk assessment (low/medium/high)
- Areas of the codebase affected
- Potential side effects

## Architecture Diagram
Create a Mermaid diagram showing the key components/modules affected by
this PR and their relationships. Use triple-backtick fencing with the
`mermaid` language tag:

```mermaid
graph TD
    A[Component] --> B[Component]
```

IMPORTANT:
- Include full GitHub links for the PR, changed files, and review comments
  wherever possible (per D-27).
- Mermaid code blocks MUST use triple-backtick fencing with `mermaid`
  language tag (per D-24).
- Be concise but thorough. Prefer bullet points over paragraphs.
- If any section has no relevant data, include the heading with "No data
  available for this section."

Output ONLY the markdown content for the note description. Do not include
a title or any preamble.
"""


def create_pr_agent() -> LlmAgent:
    """Create the ADK agent for PR analysis synthesis.

    The agent uses OpenAI GPT-4o via LiteLlm (per D-02) and is
    responsible for synthesizing pre-fetched PR data into a structured
    analysis note. Data gathering is handled by the pipeline, not the
    agent, to avoid ADK tool output size limits (RESEARCH.md Open
    Question 3).
    """
    return LlmAgent(
        model=LiteLlm(model="openai/gpt-4o"),
        name="pr_analysis_agent",
        instruction=SYNTHESIS_INSTRUCTION,
    )
