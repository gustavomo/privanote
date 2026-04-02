# Phase 15: GitHub PR analysis — hidden feature gated by env var, ADK + Qodo Merge - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 15-github-pr-analysis-hidden-feature-gated-by-env-var-adk-qodo-merge
**Areas discussed:** ADK framework choice, Qodo service architecture, API flow & invocation, Note output structure, Security & credentials, Error states & edge cases, Testing strategy, Packaging & distribution, Hexagonal architecture & project separation, Code rules

---

## ADK Framework Choice

| Option | Description | Selected |
|--------|-------------|----------|
| Google ADK | Python-native, tool-use focused, lightweight | ✓ |
| LangGraph | LangChain's graph-based agent framework, heavier | |
| Custom orchestration | No framework, sequence of tool calls | |

**User's choice:** Google ADK
**Notes:** None

### LLM Provider

| Option | Description | Selected |
|--------|-------------|----------|
| Gemini | ADK's native provider | |
| OpenAI | Already configured in project | ✓ |
| Anthropic Claude | High-quality analysis | |

**User's choice:** OpenAI
**Notes:** None

### Agent Host

| Option | Description | Selected |
|--------|-------------|----------|
| Python side | ADK agent in Python service, Node.js calls one endpoint | ✓ |
| Node.js side | ADK agent in Node.js, orchestrates calls to Python and GitHub | |

**User's choice:** Python side

### Adaptive Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Always full analysis | All tools regardless of PR size | ✓ |
| Adaptive | Agent decides based on PR size | |
| You decide | Claude determines heuristic | |

**User's choice:** Always full analysis

### PR Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Single PR only | One PR URL per request | ✓ |
| Batch support | Repo URL + filters | |

**User's choice:** Single PR only

### OpenAI Model

| Option | Description | Selected |
|--------|-------------|----------|
| gpt-4o-mini | Matches project's mini cost pattern | |
| gpt-4o | Higher quality, more expensive | ✓ |
| gpt-4.1-mini | Latest mini model | |

**User's choice:** gpt-4o

### Failure Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Skip Qodo, continue with GitHub data | Degraded but useful | |
| Fail the entire request | No partial notes | |
| Retry once then skip | Single retry with backoff | |

**User's choice:** (Other) Mark as failed, allow retry to generate the note correctly
**Notes:** No partial notes, no silent fallback. User retries for correct full result.

### External Reviews

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, fetch all reviews | Include CodeRabbit, Copilot, human reviewers | ✓ |
| Ignore external reviews | Only Qodo's analysis | |
| You decide | Claude determines | |

**User's choice:** Yes, fetch all reviews

---

## Qodo Service Architecture

### HTTP Framework

| Option | Description | Selected |
|--------|-------------|----------|
| FastAPI | Async-native, auto OpenAPI docs | ✓ |
| Flask | Simpler, synchronous | |

**User's choice:** FastAPI

### Service Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Long-running child process | Spawned at startup, stays running | ✓ |
| Subprocess per request | New process per analysis | |
| Docker container | Isolated container | |

**User's choice:** Long-running (Python runs, Node.js makes requests)

### Qodo Invocation

| Option | Description | Selected |
|--------|-------------|----------|
| Python API import | Direct function calls | ✓ |
| CLI subprocess | Shell out to pr_agent CLI | |

**User's choice:** Python API import

### Monorepo Location

| Option | Description | Selected |
|--------|-------------|----------|
| services/qodo-service/ | Top-level services directory | |
| apps/pr-analysis/ | Under apps/ alongside desktop and backend | ✓ |

**User's choice:** apps/pr-analysis/

### Qodo LLM Config

| Option | Description | Selected |
|--------|-------------|----------|
| Use OpenAI (same key) | One key for everything | ✓ |
| Separate Qodo config | Own LLM config | |

**User's choice:** Use OpenAI (same key)

### Port

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed port | Default 8100, env var configurable | ✓ |
| Dynamic port | Random available port | |

**User's choice:** Fixed port

### Health Check

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, /health endpoint | Node.js polls until ready | ✓ |
| No health check | Just try and fail | |

**User's choice:** Yes

### Virtual Environment

| Option | Description | Selected |
|--------|-------------|----------|
| Bundled venv | Setup script creates venv and installs | ✓ |
| System pip | Global/user pip install | |
| Poetry/uv | Modern Python package manager | |

**User's choice:** Bundled venv

### Auto-start

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-start via Node.js | Spawn on backend startup when env var set | ✓ |
| Manual start | User starts separately | |
| npm script orchestration | Both start together from one command | |

**User's choice:** Auto-start via Node.js

---

## API Flow & Invocation

### Sync vs Async

| Option | Description | Selected |
|--------|-------------|----------|
| Async with polling | Job ID + polling for status | ✓ |
| Synchronous | Block until complete | |
| Async with SSE/WebSocket | Stream progress | |

**User's choice:** Async with polling

### Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| API endpoint only | curl/Postman | |
| IPC from floating button | New overlay button on GitHub pages | ✓ |
| Both API and IPC | Both paths | |

**User's choice:** IPC from floating button

### URL Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Browser URL matching | Auto-detect via AppleScript | |
| Manual URL input | Paste a PR URL | |

**User's choice:** (Other) Both — auto-detect from browser AND allow manual paste/edit

### Button Design

| Option | Description | Selected |
|--------|-------------|----------|
| New 4th button | GitHub icon, conditional appearance | ✓ |
| Context menu on existing button | Long-press option | |

**User's choice:** New 4th button

### Progress Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Spinner + status text | Loading with phase messages | ✓ |
| Just a spinner | Simple indicator | |
| Toast in main app | Confirmation + toast | |

**User's choice:** Spinner + status text

### Completion UX

| Option | Description | Selected |
|--------|-------------|----------|
| Toast + auto-select | Toast + navigate to new note | ✓ |
| Toast only | No navigation | |
| Silent | Note appears silently | |

**User's choice:** Toast + auto-select

---

## Note Output Structure

### Sections

| Option | Description | Selected |
|--------|-------------|----------|
| Full analysis | Summary, review, changes, suggestions, impact, diagram | ✓ |
| Summary + review only | Brief analysis | |
| You decide | Claude determines | |

**User's choice:** Full analysis

### Mermaid Diagrams

| Option | Description | Selected |
|--------|-------------|----------|
| Raw Mermaid in description | Code blocks, renders later | ✓ |
| Render to SVG/PNG | Server-side conversion | |
| Skip diagrams | Text only | |

**User's choice:** Raw Mermaid in description

### Note Title

| Option | Description | Selected |
|--------|-------------|----------|
| PR title + repo | "Fix auth — owner/repo#123" | ✓ |
| Generic prefix | "PR Analysis: owner/repo#123" | |
| Custom by agent | Agent-generated title | |

**User's choice:** PR title + repo

### Tag

| Option | Description | Selected |
|--------|-------------|----------|
| github-analysis | Consistent, filterable | ✓ |
| pr-review | More specific | |
| ai-analysis | Broader category | |

**User's choice:** github-analysis

### Links

| Option | Description | Selected |
|--------|-------------|----------|
| Full links | PR, files, comments | ✓ |
| PR link only | Main URL only | |
| No links | Pure text | |

**User's choice:** Full links

### Re-analysis

| Option | Description | Selected |
|--------|-------------|----------|
| Create new note | Keep history | ✓ |
| Update existing | One note per PR | |

**User's choice:** Create new note

---

## Security & Credentials

### Credential Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Env vars at spawn | Pass via process environment | |
| Per-request headers | Send in HTTP headers | |
| Shared config file | Both read from same file | |

**User's choice:** (Other) Each project manages its own secrets independently. Python has its own .env.

### Access Control

| Option | Description | Selected |
|--------|-------------|----------|
| Localhost-only binding | 127.0.0.1 only | ✓ |
| API key auth | Require key in headers | |

**User's choice:** Localhost-only binding

### Env File Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Both .env + .env.example | Gitignored .env, committed template | ✓ |
| .env only | No template | |

**User's choice:** Both

---

## Error States & Edge Cases

### Private Repos

| Option | Description | Selected |
|--------|-------------|----------|
| Fail with clear message | Check permissions message | ✓ |
| Partial analysis | Try Qodo directly | |

**User's choice:** Fail with clear message

### Large PRs

| Option | Description | Selected |
|--------|-------------|----------|
| Analyze anyway | Full analysis regardless | ✓ |
| Warn and proceed | Show warning first | |
| Truncate | Analyze first N files | |

**User's choice:** Analyze anyway

### PR State

| Option | Description | Selected |
|--------|-------------|----------|
| All states allowed | Draft, open, closed, merged | ✓ |
| Open and draft only | Skip closed/merged | |

**User's choice:** All states allowed

### Rate Limits

| Option | Description | Selected |
|--------|-------------|----------|
| Fail with retry suggestion | Message with wait time | ✓ |
| Auto-retry with backoff | Wait and continue | |

**User's choice:** Fail with retry suggestion

### URL Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Strict validation | Regex match before starting | ✓ |
| Let it fail naturally | Pass through, GitHub API errors | |

**User's choice:** Strict validation

---

## Testing Strategy

### Python Framework

| Option | Description | Selected |
|--------|-------------|----------|
| pytest | Standard, async support | ✓ |
| unittest | Built-in, more verbose | |

**User's choice:** pytest

### Mocking Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Mock everything | Fast, offline | |
| Integration tests with real APIs | Real calls | |
| Both layers | Unit + optional integration | ✓ |

**User's choice:** Both layers

### Node.js Tests

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, unit tests | Route, IPC, validation | ✓ |
| Python tests only | Focus on core logic | |
| E2E only | End-to-end | |

**User's choice:** Yes, unit tests

### Gherkin Implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Gherkin-style naming | Given/When/Then in test names | ✓ |
| Full Gherkin framework | behave/cucumber with .feature files | |
| pytest-bdd / jest-cucumber | Lightweight BDD plugins | |

**User's choice:** Gherkin-style naming

### Test Fixture

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, use a test repo | Known, stable PR | ✓ |
| Use any public PR | Flexible but variable | |

**User's choice:** Yes, use a test repo

**Notes:** Tests should follow Gherkin framework style (Given/When/Then)

---

## Packaging & Distribution

### Python Bundling

| Option | Description | Selected |
|--------|-------------|----------|
| User prerequisite | Python 3.9+ required on machine | ✓ |
| Bundled Python (PyInstaller) | Standalone binary | |
| Dev-only for now | Don't package yet | |

**User's choice:** User prerequisite

### Python Check

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, check on startup | Log warning if missing | ✓ |
| Fail silently | No error unless used | |

**User's choice:** Yes, check on startup

### Auto-setup

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-setup on first use | Create venv + pip install automatically | ✓ |
| Manual setup command | User runs setup script | |
| npm postinstall hook | Setup during npm install | |

**User's choice:** Auto-setup on first use

### Setup Progress

| Option | Description | Selected |
|--------|-------------|----------|
| Console/log only | No UI notification | ✓ |
| Toast notification | UI feedback | |

**User's choice:** Console/log only

---

## Hexagonal Architecture & Project Separation

### Directory Structure

| Option | Description | Selected |
|--------|-------------|----------|
| api/domain/adapters | Layer-based hexagonal | ✓ |
| Flat structure | All files in one directory | |

**User's choice:** api/domain/adapters

### Port Interfaces

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, use ABCs | Abstract base classes in domain/ports.py | ✓ |
| Duck typing only | No formal interfaces | |
| Protocol classes | Structural subtyping | |

**User's choice:** Yes, use ABCs

### Dependency Injection

| Option | Description | Selected |
|--------|-------------|----------|
| Constructor injection | No DI framework, testable | ✓ |
| DI framework | Container-based | |
| Module-level singletons | Simpler, harder to test | |

**User's choice:** Constructor injection

### Note Creation Coupling

| Option | Description | Selected |
|--------|-------------|----------|
| Webhook-style callback | Configurable URL, zero Privanote knowledge | ✓ |
| Generic output adapter | Swappable adapters | |

**User's choice:** Webhook-style callback

### Standalone Docs

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, self-contained | Own README with setup and API docs | ✓ |
| Minimal, project-level | Docs in monorepo root | |

**User's choice:** Yes, self-contained

### Package Name

| Option | Description | Selected |
|--------|-------------|----------|
| pr-insight | Clean, generic | ✓ |
| code-review-agent | Broader scope | |
| pr-analyzer | Simple, direct | |

**User's choice:** pr-insight

### Git History

| Option | Description | Selected |
|--------|-------------|----------|
| Prefix commits | pr-insight: prefix for subtree split | ✓ |
| Standard commits | Normal messages | |

**User's choice:** Prefix commits

### API Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, own OpenAPI spec | FastAPI auto-generated, independent | ✓ |
| Shared contract with Node.js | Tighter coupling | |

**User's choice:** Own OpenAPI spec

### CI Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| pyproject.toml + Makefile | Independent CI, make test/lint/setup | ✓ |
| npm scripts only | Managed from monorepo root | |

**User's choice:** pyproject.toml + Makefile

---

## Code Rules (Python)

### Linter/Formatter

| Option | Description | Selected |
|--------|-------------|----------|
| Ruff | Ultra-fast, all-in-one | ✓ |
| Black + flake8 | Classic combo | |
| Ruff + mypy | Maximum strictness | |

**User's choice:** Ruff

### Type Hints

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, everywhere | All signatures, Pydantic models | ✓ |
| Public interfaces only | Ports and schemas | |
| No type hints | Plain Python | |

**User's choice:** Yes, everywhere

### Line Length

| Option | Description | Selected |
|--------|-------------|----------|
| 88 chars | Ruff/Black default | ✓ |
| 120 chars | More relaxed | |
| 79 chars | PEP 8 strict | |

**User's choice:** 88 chars

### File Size Limits

| Option | Description | Selected |
|--------|-------------|----------|
| Soft limits | ~300 lines/file, ~50 lines/function | ✓ |
| Hard limits via Ruff | Enforced in CI | |
| No limits | Natural grouping | |

**User's choice:** Soft limits

---

## Claude's Discretion

- ADK agent tool definitions and orchestration flow details
- Mermaid diagram types per PR
- Internal job status tracking mechanism
- Exact Qodo Merge API surface

## Deferred Ideas

- AI agent for note search and insights using ADK — separate todo, different scope
- Batch PR analysis — keep single-PR for now
- Markdown rendering in note UI — separate feature
- Bundled Python via PyInstaller — user prerequisite for now
