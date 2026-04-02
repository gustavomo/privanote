---
created: 2026-04-02T05:32:03.990Z
title: GitHub PR analysis as ADK agent tool
area: general
files:
  - apps/backend/src/services/openai-transcription.js
  - apps/backend/src/services/nodes-service.js
  - apps/backend/src/services/settings-service.js
  - apps/backend/src/server.js
  - apps/backend/src/contracts/v1/index.js
---

## Problem

Need the ability to analyze GitHub PRs (changelog, insights, change diagrams, improvement suggestions) from within Privanote. Instead of a visible UI button, this should be a hidden/internal function exposed as an ADK agent tool — the user asks the agent via chat (e.g., "analyze this PR: github.com/org/repo/pull/123") and the agent calls the tool to fetch PR data, analyze it, and create a note.

Currently Privanote captures screenshots, clipboard, and recordings but has no way to extract and analyze structured data from GitHub PRs. This ties into the existing ADK agent todo for note search and insights.

## Solution

### ADK Agent Tool approach (hidden function, no UI button)

1. **GitHub PAT in Settings**: Add field in settings for GitHub Personal Access Token (same pattern as OpenAI key). Supports org repos where user is a collaborator.

2. **GitHub Service** (`apps/backend/src/services/github-service.js`): Use `@octokit/rest` to fetch PR data (diff, commits, reviews, files changed). Parse GitHub URLs to extract owner/repo/pull_number.

3. **PR Analysis Tool for ADK Agent**: Register as an ADK tool/function that the agent can invoke:
   - Tool name: `analyze_github_pr`
   - Input: GitHub PR URL or `{owner, repo, pull_number}`
   - Processing: Fetch PR data via GitHub API → send to LLM for analysis
   - Output: Structured analysis (summary, changes, Mermaid diagram, risks, suggestions)
   - Side effect: Creates a note with tag `github-analysis`

4. **Backend Endpoint** (internal): `POST /api/v1/analyze/pr` — called by the ADK agent, not directly by UI.

5. **Agent Integration**: The ADK agent (from the "AI agent for note search and insights" todo) orchestrates this tool alongside search/RAG tools. User interacts via chat interface:
   - "Analyze PR github.com/org/repo/pull/123"
   - "What changed in the last 3 PRs of repo X?"
   - "Compare PR 45 and PR 50"

### Relationship to ADK agent todo
This is a **tool/function** within the broader ADK agent system. The agent orchestrates when to call it based on user intent. No floating button or separate UI needed — the agent's chat interface is the entry point.

### New dependencies
- `@octokit/rest` (backend - GitHub API client)
- ADK framework (shared with the agent todo)
