# Phase 15: GitHub PR analysis — hidden feature gated by env var, ADK + Qodo Merge - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a hidden backend feature (off by default, enabled via `PRIVANOTE_PR_ANALYSIS=true`) that analyzes GitHub PRs using a Python-based ADK agent orchestrating Qodo Merge code review and GitHub API data, generating structured notes with full analysis, code review findings, categorized changes, improvement suggestions, and Mermaid diagrams. The Python service ("pr-insight") is architected with hexagonal/layer-based separation for future extraction as a standalone project. A new 4th floating overlay button triggers analysis when the user is on a GitHub PR page in a browser.

</domain>

<decisions>
## Implementation Decisions

### ADK Agent
- **D-01:** Use Google Agent Development Kit (ADK) as the agent framework. Agent runs in the Python service (not Node.js).
- **D-02:** Use OpenAI (gpt-4o) as the LLM provider for agent synthesis and note generation. Configured via the Python service's own credentials.
- **D-03:** Always full analysis — run all tools (Qodo review + describe + improve, GitHub metadata) regardless of PR size. No adaptive depth.
- **D-04:** Single PR per request. One PR URL in, one note out.
- **D-05:** On any failure (Qodo down, API error, rate limit), mark the request as failed. No partial notes, no silent fallback. User can retry to get the correct full note.
- **D-06:** Fetch all existing review comments from the PR (including CodeRabbit, Copilot, human reviewers) via GitHub API. Agent can incorporate or compare findings.

### Qodo Service Architecture
- **D-07:** FastAPI as the Python HTTP framework. Async-native.
- **D-08:** Long-running Python process. Node.js spawns it at backend startup (when env var is set), stays running, handles requests over HTTP. Killed on shutdown.
- **D-09:** Import Qodo Merge as a Python library (not CLI subprocess). Direct function calls for review, describe, improve.
- **D-10:** Lives in `apps/pr-analysis/` in the monorepo. Generic package name: "pr-insight".
- **D-11:** Qodo uses the same OpenAI API key from the Python service's own `.env`.
- **D-12:** Fixed port (default 8100). Configurable via `QODO_SERVICE_PORT` env var.
- **D-13:** Health check endpoint: GET /health. Node.js polls on startup until ready.
- **D-14:** Node.js auto-starts the Python service when `PRIVANOTE_PR_ANALYSIS=true`. No manual start needed.
- **D-15:** Bundled venv. `apps/pr-analysis/` includes setup that creates a venv and installs requirements.txt. Isolates Python deps.
- **D-16:** Localhost-only binding (127.0.0.1). No external access. No API key auth needed.

### API Flow & Invocation
- **D-17:** Async with polling. POST /api/v1/analyze/pr returns a job ID. Client polls GET /api/v1/analyze/pr/:id for status and result.
- **D-18:** Primary trigger: IPC from floating overlay button. New 4th button on the overlay that appears when active app is a supported browser and GitHub PR page is detected.
- **D-19:** Dual URL input: auto-detect PR URL from browser via AppleScript (existing Phase 8 pattern), AND allow manual paste/edit. Both paths available when button is clicked.
- **D-20:** Spinner + status text on overlay during analysis ("Analyzing...", "Fetching reviews...", "Generating note..."). Follows teal active-state pattern.
- **D-21:** On completion: Sonner toast in main app ("PR analysis complete") + auto-select the new note in sidebar.
- **D-22:** Strict URL validation. Reject URLs not matching `github.com/{owner}/{repo}/pull/{number}` before starting.

### Note Output Structure
- **D-23:** Full analysis note with sections: executive summary, code review findings, categorized changes (features/fixes/refactors/tests), improvement suggestions, impact analysis, Mermaid diagram.
- **D-24:** Raw Mermaid code blocks stored in note description. Will render when markdown rendering is added later.
- **D-25:** Note title format: `{PR title} — {owner/repo}#{number}` (e.g., "Fix auth middleware — owner/repo#123").
- **D-26:** Tag: `github-analysis`. Filterable in sidebar.
- **D-27:** Full GitHub links in note body — link to PR, individual changed files, referenced review comments.
- **D-28:** Re-analyzing the same PR creates a new note. User keeps history of how the PR evolved between analyses.

### Security & Credentials
- **D-29:** Each project manages its own secrets independently. Python service has its own `.env` for `GITHUB_TOKEN` and `OPENAI_API_KEY`, separate from Node.js backend settings.
- **D-30:** `.env` gitignored. `.env.example` committed with placeholder values. Standard open-source pattern.

### Error States & Edge Cases
- **D-31:** Private repos without access: fail with clear message "Cannot access repo — check GITHUB_TOKEN permissions".
- **D-32:** Very large PRs (500+ files): analyze anyway. No truncation or warnings.
- **D-33:** All PR states allowed (draft, open, closed, merged). All analyzable.
- **D-34:** GitHub API rate limits: fail with retry suggestion "GitHub API rate limit reached. Try again in X minutes."

### Testing Strategy
- **D-35:** pytest for Python tests. Vitest for Node.js tests (existing pattern).
- **D-36:** Both layers: unit tests with mocks for fast CI + optional integration tests against real APIs when credentials are present.
- **D-37:** Node.js side tested too: Fastify route contract, IPC handler, URL validation, job status polling. Mock Python service.
- **D-38:** Gherkin-style naming in standard test frameworks (Given/When/Then in test names). No BDD framework, just naming convention.
- **D-39:** Dedicated test repo with a known, stable PR as fixture for integration tests.

### Packaging & Distribution
- **D-40:** Python 3.9+ is a user prerequisite. Not bundled with the Electron app.
- **D-41:** Check for python3 in PATH on startup when env var is set. Log warning if missing, don't block app startup.
- **D-42:** Auto-setup on first use: if no venv exists when Node.js tries to start the Python service, automatically create venv and pip install. 30-60s first time.
- **D-43:** Setup progress goes to console/log only. No UI notification (hidden dev feature).

### Hexagonal Architecture & Project Separation
- **D-44:** Layer-based separation: `api/` (FastAPI routes/schemas), `domain/` (agent logic, models, pipeline), `adapters/` (github, qodo, note creation).
- **D-45:** Abstract base classes (Python ABCs) define port interfaces in `domain/ports.py`. Adapters implement them.
- **D-46:** Constructor injection for dependency wiring. No DI framework. Easy to swap adapters in tests.
- **D-47:** Webhook-style note callback. Python calls a configurable callback URL with analysis result JSON. Privanote's Node.js maps it to createNode. When extracted, any consumer hooks up their own callback.
- **D-48:** Self-contained docs: own README.md with setup, usage, and API docs. Works standalone.
- **D-49:** Own OpenAPI spec via FastAPI auto-generation. Independent of Privanote's Fastify contracts.
- **D-50:** pyproject.toml + Makefile for independent CI. Targets: make test, make lint, make setup.
- **D-51:** Git commit prefix: `pr-insight:` for all commits touching this service. Enables future git subtree split.

### Code Rules (Python)
- **D-52:** Ruff for linting and formatting. Single tool, fast.
- **D-53:** Type hints everywhere. All function signatures, return types, class attributes. Pydantic models for data structures.
- **D-54:** Max line length: 88 chars (Ruff/Black default).
- **D-55:** Soft limits: ~300 lines per file, ~50 lines per function. Convention, not enforced.

### Claude's Discretion
- Implementation details of the ADK agent's tool definitions and orchestration flow
- Specific Mermaid diagram types (flowchart, sequence, etc.) chosen per PR
- Internal job status tracking mechanism (in-memory, SQLite, etc.)
- Exact Qodo Merge API surface used for each analysis type

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend Architecture
- `apps/backend/src/server.js` — Fastify server setup, route registration pattern, child process lifecycle hooks
- `apps/backend/src/services/nodes-service.js` — Node CRUD including createNode with title/description/tags
- `apps/backend/src/routes/nodes.js` — Route registration pattern for Fastify

### Overlay & IPC Infrastructure
- `apps/desktop/src/main/main.js` — Main process IPC handlers, overlay lifecycle, child process management
- `apps/desktop/src/main/capture-session.js` — Session lifecycle pattern (start/stop/finalize) for overlay features
- Phase 8 context: AppleScript for browser URL extraction, app whitelist detection pattern
- Phase 10 context: Conditional overlay button pattern (3rd button appears based on media detection)

### AI Infrastructure
- `apps/backend/src/services/openai-transcription.js` — Existing OpenAI API integration pattern
- `apps/backend/src/services/settings-service.js` — Settings persistence

### Existing Test Patterns
- `apps/backend/test/` — Existing Vitest test patterns for backend services

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `nodes-service.createNode(payload)` — Creates notes with title, description, tags. Used by the Node.js side to persist analysis results.
- AppleScript URL extraction (Phase 8) — Extracts current browser URL for auto-detection of GitHub PR pages.
- App whitelist detection polling (Phase 8) — 500ms polling that detects active app. Extend to detect browser + GitHub URL.
- Conditional overlay button (Phase 10) — Pattern for showing/hiding a button based on system state.

### Established Patterns
- Fastify route registration: each domain has routes/X.js + contracts/v1/X.js + services/X-service.js
- Child process management: main.js spawns and kills child processes on app lifecycle
- Overlay buttons: teal active state, icon pairs for idle/active, 40px buttons

### Integration Points
- `server.js` — Register new analyze routes conditionally when env var is set
- `main.js` — Spawn Python process, add IPC handlers for overlay PR button
- Overlay React component — Add 4th conditional button for PR analysis

</code_context>

<specifics>
## Specific Ideas

- Package name "pr-insight" chosen for future extraction as standalone project
- Hexagonal architecture with api/domain/adapters layers and ABC-based ports
- Webhook-style callback for note creation — Python doesn't know about Privanote internals
- Each project manages its own credentials independently via separate .env files
- Git commit prefix `pr-insight:` for future git subtree split
- Gherkin-style test naming (Given/When/Then) in test function names

</specifics>

<deferred>
## Deferred Ideas

- AI agent for note search and insights using ADK — Separate todo, not part of this phase. PR analysis agent could later be composed into that system.
- Batch PR analysis (analyze all open PRs in a repo) — Keep it single-PR for now.
- Markdown rendering in note UI — Would make Mermaid diagrams render. Separate UI feature.
- Bundling Python via PyInstaller for packaged app — User prerequisite for now.

### Reviewed Todos (not folded)
- **AI agent for note search and insights using ADK** (score: 0.2) — Different scope; PR analysis is standalone per user decision. The ADK todo is a broader search/RAG system.

</deferred>

---

*Phase: 15-github-pr-analysis-hidden-feature-gated-by-env-var-adk-qodo-merge*
*Context gathered: 2026-04-02*
