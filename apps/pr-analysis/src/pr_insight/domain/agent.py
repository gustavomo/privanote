"""ADK agent for PR analysis synthesis (per D-01, D-02, D-03).

The agent receives pre-fetched PR data from the pipeline and synthesizes
it into a structured analysis note with sections defined in D-23.
"""

from __future__ import annotations

from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm

SYNTHESIS_INSTRUCTION = """\
You are a senior software engineer writing a structured PR analysis note.
Your goal is to help a developer quickly understand WHAT this PR achieves
and WHY the changes matter — not just list what files changed.

You will receive pre-fetched data about a GitHub pull request including:
- PR metadata (title, author, branches, files changed, diff)
- PR description/summary
- Changed files list
- Review comments from GitHub

Synthesize all this information into a structured analysis note with
these sections (in order):

## Executive Summary
**This is the most important section.** Write 3–5 sentences that answer:
1. What problem does this PR solve, or what feature does it add?
2. What was the approach / key change made?
3. What is the tangible outcome for users, developers, or the system?

BAD example: "This PR removes BulkDisburseBankAccountWarning import and JSX."
GOOD example: "Removes the bank account warning banner from the loans disbursement
flow. The warning was shown before bulk disbursal to flag accounts without a
registered bank account. This component has been superseded by the new inline
validation in the DisbursementsList, making the pre-flight warning redundant and
reducing visual noise in the confirmation modal."

Infer context from file names, component names, and diff content.
Never just restate the diff — explain the intent and outcome.

## Categorized Changes
Group changed files by type with a short description of WHAT each file's
change accomplishes (not just "modified"):
- **Features**: New functionality
- **Fixes**: Bug fixes
- **Refactors / Cleanup**: Removals, restructuring, dead code elimination
- **Tests**: Test additions or modifications
- **Config / Infra**: Build, CI, environment changes

For each file, one line: `path/to/file` — what this specific change does.
Include full GitHub PR file links where available.

## Code Review Findings
Findings from review comments (if any). Group by severity: critical, warning,
suggestion. If no review comments exist, write: "No review comments on this PR."
Do NOT invent findings — only include what is in the data.

## Impact Analysis
- **Risk**: low / medium / high — justify in one sentence
- **Areas affected**: which features, layers, or user flows are impacted
- **Side effects**: anything downstream that depends on the changed code

## Architecture Diagram
**Only include this section if the PR touches component relationships,
data flow, module boundaries, or architectural structure.**

Skip (omit entirely) for: simple text changes, single-file fixes, import
removals, typo corrections, config tweaks.

When applicable, draw an ELABORATE diagram that shows:
- Components involved and their relationships (before/after if something was removed)
- Data flow through the changed code path
- Module/layer boundaries crossed

Use triple-backtick fencing with the `mermaid` language tag. Prefer `graph TD`
for component hierarchies or `sequenceDiagram` for flow changes.

```mermaid
graph TD
    A[Component] --> B[Component]
```

---

RULES:
- Include full GitHub links for the PR, changed files, and review comments
  wherever available.
- Mermaid MUST use triple-backtick fencing with `mermaid` tag.
- OMIT any section that has no meaningful content (except Summary, Categorized
  Changes, and Impact Analysis — those are always required).
- Output ONLY the markdown. No title, no preamble.
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
