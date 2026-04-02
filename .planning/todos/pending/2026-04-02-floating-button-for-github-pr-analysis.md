---
created: 2026-04-02T05:32:03.990Z
title: Floating button for GitHub PR analysis
area: ui
files:
  - apps/desktop/src/renderer/capture-overlay/capture-overlay.html
  - apps/desktop/src/main/app-detector.js
  - apps/desktop/src/main/main.js
  - apps/desktop/src/main/preload-capture.js
  - apps/backend/src/services/openai-transcription.js
  - apps/backend/src/services/nodes-service.js
  - apps/backend/src/services/settings-service.js
  - apps/desktop/src/renderer/App.jsx
  - apps/desktop/src/renderer/components/settings-view.jsx
  - apps/backend/src/server.js
  - apps/backend/src/contracts/v1/index.js
---

## Problem

Need a floating button in the capture overlay that detects when the user is on a GitHub PR page, captures the URL from Chrome (or allows manual URL input), and analyzes the PR using the GitHub API to generate a structured note with changelog, insights, change diagrams, and improvement suggestions.

Currently Privanote captures screenshots, clipboard, and recordings but has no way to extract and analyze structured data from web pages like GitHub PRs.

## Solution

1. **GitHub PAT in Settings**: Add field in settings-view.jsx for GitHub Personal Access Token (same pattern as OpenAI key). Supports org repos where user is a collaborator.

2. **GitHub Service** (`apps/backend/src/services/github-service.js`): Use `@octokit/rest` to fetch PR data (diff, commits, reviews, files changed). Parse GitHub URLs to extract owner/repo/pull_number.

3. **PR Analysis Service** (`apps/backend/src/services/pr-analysis-service.js`): Reuse OpenAI API pattern with chat completions (gpt-4o-mini) to generate:
   - Executive summary of PR changes
   - Per-file/module change list
   - Mermaid diagram of change flow/dependencies
   - Risk/complexity insights
   - Improvement suggestions

4. **Backend Endpoint**: `POST /api/v1/analyze/pr` - receives URL, calls GitHub API, runs AI analysis, creates note.

5. **Overlay Button**: Add 4th circular button in capture-overlay.html, visible only when app-detector detects GitHub. Click triggers IPC to main process which gets active browser URL and sends to backend.

6. **Manual URL Input**: Add input field in App.jsx for pasting PR URLs when not in browser.

7. **Note Output**: Creates note with tag `github-analysis` containing formatted analysis with Mermaid diagrams.

### New dependencies
- `@octokit/rest` (backend)
- `mermaid` (frontend, for diagram rendering - future enhancement)
