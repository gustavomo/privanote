---
created: 2026-04-02T05:32:03.990Z
title: GitHub PR analysis — hidden feature gated by env var, powered by ADK
area: general
files:
  - apps/backend/src/services/nodes-service.js
  - apps/backend/src/services/settings-service.js
  - apps/backend/src/server.js
  - apps/backend/src/contracts/v1/index.js
---

## Problem

Need the ability to analyze GitHub PRs (changelog, insights, change diagrams, improvement suggestions) and generate optimal notes. This should be a hidden feature, not exposed in the UI — activated only via an environment variable (e.g., `PRIVANOTE_PR_ANALYSIS=true`). The analysis itself should use an ADK (Agent Development Kit) agent to orchestrate the data gathering and note generation for optimal quality.

## Solution

### Feature gating via environment variable

- Feature is **off by default**, enabled with `PRIVANOTE_PR_ANALYSIS=true`
- When enabled, registers the `/api/v1/analyze/pr` endpoint and the ADK agent
- When disabled, endpoint does not exist and no ADK dependencies are loaded
- GitHub PAT provided via env var `GITHUB_TOKEN` (no UI settings needed for a hidden feature)

### ADK agent for optimal note generation

The ADK agent orchestrates the full pipeline — it's not just a single API call, the agent decides how to best structure the note based on the PR content:

1. **GitHub data gathering tools** (agent calls as needed):
   - `fetch_pr_info` — PR metadata (title, body, state, author, labels)
   - `fetch_pr_diff` — Files changed with patches
   - `fetch_pr_commits` — Commit history and messages
   - `fetch_pr_reviews` — Review comments and approvals
   - `fetch_pr_comments` — Discussion thread

2. **ADK agent flow**:
   - Agent receives the PR URL
   - Decides which tools to call based on PR size/complexity
   - For small PRs: may only need diff + metadata
   - For large PRs: fetches everything, summarizes in chunks
   - Generates the optimal note structure:
     - Executive summary
     - Categorized changes (features, fixes, refactors, tests)
     - Impact analysis (files/modules affected, risk areas)
     - Mermaid diagram (architecture changes, dependency flow)
     - Improvement suggestions
   - Creates the note via `nodes-service.createNode`

3. **Why ADK over a simple script**:
   - Agent adapts analysis depth to PR complexity
   - Can handle large diffs by chunking intelligently
   - Generates better structured notes by reasoning about content
   - Extensible: add more tools later (JIRA links, related PRs, etc.)

### Backend integration

- `POST /api/v1/analyze/pr` — receives `{ url }` or `{ owner, repo, pullNumber }`
- Only registered when `PRIVANOTE_PR_ANALYSIS=true`
- Internally spins up ADK agent with GitHub tools
- Returns created note with tag `github-analysis`

### New files
- `apps/backend/src/services/github-service.js` — GitHub API via `@octokit/rest`
- `apps/backend/src/services/pr-analysis-agent.js` — ADK agent definition with tools
- `apps/backend/src/contracts/v1/analyze.js` — API contract
- `apps/backend/src/routes/analyze.js` — Route (conditionally registered)

### New dependencies
- `@octokit/rest` — GitHub API client
- ADK framework (e.g., `@anthropic-ai/agent-sdk` or `@google/adk`) — agent orchestration

### Relationship to ADK agent todo
This is a specialized agent that can later be composed into the broader search/insights agent as a sub-agent or tool.
