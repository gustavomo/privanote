---
created: 2026-04-02T05:32:03.990Z
title: GitHub PR analysis — hidden feature gated by env var, ADK + Qodo Merge
area: general
files:
  - apps/backend/src/services/nodes-service.js
  - apps/backend/src/services/settings-service.js
  - apps/backend/src/server.js
  - apps/backend/src/contracts/v1/index.js
---

## Problem

Need the ability to analyze GitHub PRs (changelog, insights, change diagrams, improvement suggestions) and generate optimal notes. This should be a hidden feature, not exposed in the UI — activated only via an environment variable. Uses Qodo Merge (open-source PR-Agent) as a Python microservice for code review + an ADK agent to orchestrate and generate the optimal note.

## Solution

### Feature gating via environment variable

- Feature is **off by default**, enabled with `PRIVANOTE_PR_ANALYSIS=true`
- When enabled, registers the `/api/v1/analyze/pr` endpoint, starts Qodo service, and loads ADK agent
- When disabled, nothing is loaded
- `GITHUB_TOKEN` env var for GitHub API access (org repos where user is collaborator)

### Qodo Merge as Python microservice

Separate Python service that wraps Qodo Merge (PR-Agent) CLI:

1. **Python service** (`services/qodo-service/`):
   - Lightweight Flask/FastAPI server or simple subprocess wrapper
   - Exposes endpoints the Node.js backend can call:
     - `POST /review` — full code review of a PR
     - `POST /describe` — PR description/summary
     - `POST /improve` — code improvement suggestions
   - Runs Qodo Merge internally: `pr_agent.cli --pr_url=<url> review|describe|improve`
   - Requires: Python 3.9+, `qodo-merge` pip package

2. **Startup**: Node.js backend spawns the Python service as a child process when `PRIVANOTE_PR_ANALYSIS=true`

3. **Communication**: HTTP calls from Node.js → Python service (localhost)

### ADK agent for optimal note generation

The ADK agent orchestrates the full pipeline, combining Qodo analysis with GitHub API data:

1. **Tools available to the agent**:
   - `qodo_review` — calls Qodo service for code review
   - `qodo_describe` — calls Qodo service for PR description
   - `qodo_improve` — calls Qodo service for improvement suggestions
   - `fetch_pr_info` — PR metadata via GitHub API (title, body, state, author, labels)
   - `fetch_pr_diff` — files changed with patches
   - `fetch_pr_commits` — commit history
   - `fetch_pr_reviews` — existing review comments (including CodeRabbit if present)

2. **ADK agent flow**:
   - Agent receives the PR URL
   - Calls Qodo tools for professional code review and suggestions
   - Calls GitHub API tools for metadata and context
   - Synthesizes everything into the optimal note:
     - Executive summary (from Qodo describe + metadata)
     - Code review findings (from Qodo review)
     - Categorized changes (features, fixes, refactors, tests)
     - Improvement suggestions (from Qodo improve)
     - Impact analysis (files/modules affected, risk areas)
     - Mermaid diagram (architecture changes, dependency flow)
   - Creates the note via `nodes-service.createNode` with tag `github-analysis`

3. **Why ADK + Qodo**:
   - Qodo provides battle-tested code review analysis (not reinventing the wheel)
   - ADK agent adds intelligent orchestration and note structuring
   - Agent adapts depth to PR complexity (skip Qodo for trivial PRs)
   - Extensible: add more tools later (JIRA, related PRs, etc.)

### Architecture

```
[Node.js Backend] → POST /api/v1/analyze/pr
       ↓
[ADK Agent] orchestrates:
       ├── [Qodo Python Service] → review, describe, improve
       └── [GitHub API] → metadata, diff, commits, reviews
       ↓
[nodes-service.createNode] → note with tag github-analysis
```

### New files/directories
- `services/qodo-service/` — Python microservice
  - `requirements.txt` — qodo-merge, flask/fastapi
  - `server.py` — HTTP wrapper around pr_agent CLI
- `apps/backend/src/services/qodo-client.js` — Node.js HTTP client for Qodo service
- `apps/backend/src/services/github-service.js` — GitHub API via `@octokit/rest`
- `apps/backend/src/services/pr-analysis-agent.js` — ADK agent definition with tools
- `apps/backend/src/contracts/v1/analyze.js` — API contract
- `apps/backend/src/routes/analyze.js` — Route (conditionally registered)

### New dependencies
- `@octokit/rest` — GitHub API client (Node.js)
- ADK framework — agent orchestration (Node.js)
- `qodo-merge` — PR-Agent (Python, pip)
- `flask` or `fastapi` — Python HTTP server

### Relationship to ADK agent todo
This is a specialized agent that can later be composed into the broader search/insights agent as a sub-agent or tool.
