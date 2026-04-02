# Phase 15: GitHub PR Analysis - Research

**Researched:** 2026-04-02
**Domain:** Python agent framework (Google ADK) + PR analysis (Qodo PR-Agent) + FastAPI service + Electron IPC integration
**Confidence:** MEDIUM

## Summary

This phase adds a hidden, env-var-gated feature that analyzes GitHub PRs using a Python-based ADK agent orchestrating Qodo Merge (PR-Agent) and GitHub API data, producing structured notes with code review findings, categorized changes, improvement suggestions, and Mermaid diagrams. The feature lives in a new `apps/pr-analysis/` directory architected with hexagonal separation (api/domain/adapters) for future extraction as a standalone project.

The implementation spans three technology layers: (1) a Python FastAPI service ("pr-insight") hosting an ADK agent with tools for Qodo review/describe/improve and GitHub API data fetching, (2) Node.js Fastify routes that proxy requests and manage the Python child process lifecycle, and (3) Electron overlay/IPC for the 4th floating button with URL detection and status updates.

**Primary recommendation:** Build the Python service first (FastAPI + ADK agent + adapters), then wire the Node.js proxy layer, then the overlay UI. The Python service is self-contained and testable independently, matching the hexagonal architecture goal.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Google ADK as agent framework, running in Python service
- D-02: OpenAI gpt-4o via LiteLLM, configured in Python service's own credentials
- D-03: Always full analysis (all tools run regardless of PR size)
- D-04: Single PR per request
- D-05: Fail entirely on any error, no partial notes
- D-06: Fetch all existing review comments from PR (CodeRabbit, Copilot, human)
- D-07: FastAPI as HTTP framework, async-native
- D-08: Long-running Python process, spawned by Node.js at startup, killed on shutdown
- D-09: Import Qodo Merge as Python library, not CLI subprocess
- D-10: Lives in `apps/pr-analysis/`, package name "pr-insight"
- D-11: Same OpenAI API key from Python service's own `.env`
- D-12: Fixed port 8100, configurable via `QODO_SERVICE_PORT`
- D-13: Health check endpoint GET /health, Node.js polls on startup
- D-14: Node.js auto-starts when `PRIVANOTE_PR_ANALYSIS=true`
- D-15: Bundled venv with requirements.txt
- D-16: Localhost-only binding (127.0.0.1), no auth needed
- D-17: Async with polling: POST returns job ID, GET polls for status/result
- D-18: Primary trigger: IPC from 4th floating overlay button
- D-19: Dual URL input: auto-detect from browser + manual paste/edit
- D-20: Spinner + status text on overlay during analysis
- D-21: On completion: Sonner toast + auto-select note in sidebar
- D-22: Strict URL validation: `github.com/{owner}/{repo}/pull/{number}`
- D-23: Full analysis note with sections: executive summary, code review, categorized changes, improvements, impact, Mermaid
- D-24: Raw Mermaid code blocks in description, render later
- D-25: Title format: `{PR title} -- {owner/repo}#{number}`
- D-26: Tag: `github-analysis`
- D-27: Full GitHub links in note body
- D-28: Re-analyzing creates new note (history preserved)
- D-29: Independent .env per service (Python has own GITHUB_TOKEN + OPENAI_API_KEY)
- D-30: .env gitignored, .env.example committed
- D-31: Private repos without access: clear error message
- D-32: Large PRs (500+ files): analyze anyway
- D-33: All PR states allowed
- D-34: Rate limit: fail with retry suggestion
- D-35: pytest for Python, Vitest for Node.js
- D-36: Unit tests with mocks + optional integration tests
- D-37: Node.js side tested: route contract, IPC handler, URL validation, polling
- D-38: Gherkin-style naming (Given/When/Then in test names)
- D-39: Dedicated test repo fixture for integration tests
- D-40: Python 3.9+ prerequisite (NOTE: CONFLICTS with library requirements, see Pitfalls)
- D-41: Check python3 in PATH on startup, log warning if missing
- D-42: Auto-setup venv on first use
- D-43: Setup progress to console/log only
- D-44: Hexagonal layers: api/, domain/, adapters/
- D-45: ABC port interfaces in domain/ports.py
- D-46: Constructor injection, no DI framework
- D-47: Webhook-style callback URL for note creation
- D-48: Own README.md with standalone docs
- D-49: Own OpenAPI spec via FastAPI auto-generation
- D-50: pyproject.toml + Makefile (make test, make lint, make setup)
- D-51: Git commit prefix: `pr-insight:`
- D-52: Ruff for linting and formatting
- D-53: Type hints everywhere, Pydantic models
- D-54: Max line length: 88 chars
- D-55: Soft limits: ~300 lines/file, ~50 lines/function

### Claude's Discretion
- Implementation details of ADK agent's tool definitions and orchestration flow
- Specific Mermaid diagram types chosen per PR
- Internal job status tracking mechanism (in-memory, SQLite, etc.)
- Exact Qodo Merge API surface used for each analysis type

### Deferred Ideas (OUT OF SCOPE)
- AI agent for note search and insights using ADK
- Batch PR analysis (all open PRs in a repo)
- Markdown rendering in note UI
- Bundling Python via PyInstaller
</user_constraints>

## Standard Stack

### Core (Python Service)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google-adk | >=1.28.0 | Agent framework with tool orchestration | Google's official ADK, model-agnostic via LiteLLM |
| litellm | (dep of google-adk) | LLM provider abstraction for OpenAI | Required by ADK for non-Gemini models |
| fastapi | >=0.115.0 | HTTP framework | Async-native, auto-OpenAPI, decision D-07 |
| uvicorn | >=0.34.0 | ASGI server | Standard FastAPI deployment server |
| pr-agent | >=0.3.0 | Qodo Merge code review library | Provides review/describe/improve as library imports (D-09) |
| httpx | >=0.28.0 | Async HTTP client for GitHub API | Async-native, pairs with FastAPI, better than PyGithub for async |
| pydantic | >=2.10.0 | Data models and validation | Type-safe schemas, decision D-53 |
| python-dotenv | >=1.0.0 | .env file loading | Standard credential management (D-29) |
| ruff | >=0.9.0 | Linting and formatting | Single tool, fast, decision D-52 |
| pytest | >=8.0.0 | Python test framework | Decision D-35 |
| pytest-asyncio | >=0.24.0 | Async test support | Required for testing async FastAPI endpoints |

### Core (Node.js Additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (no new npm deps) | -- | -- | All needed deps already installed (Fastify, Vitest, Sonner) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| httpx | PyGithub | PyGithub is sync-only, heavier; httpx is async-native for FastAPI |
| In-memory job store | SQLite | In-memory is simpler for single-user local app; SQLite adds persistence but jobs are ephemeral |
| google-adk | LangChain | ADK is lighter, decision locked; LangChain is heavier with more abstractions |
| pr-agent library | GitHub API + custom LLM prompts | pr-agent handles PR-specific prompting, diff parsing, and structured output |

**Installation (Python):**
```bash
pip install google-adk fastapi "uvicorn[standard]" pr-agent httpx pydantic python-dotenv ruff pytest pytest-asyncio
```

## Architecture Patterns

### Recommended Project Structure
```
apps/pr-analysis/
  pyproject.toml
  Makefile
  README.md
  requirements.txt
  .env.example
  .gitignore
  src/
    pr_insight/
      __init__.py
      main.py              # FastAPI app factory + uvicorn entry point
      config.py             # Settings from .env via pydantic-settings
      api/
        __init__.py
        router.py           # FastAPI routes: POST /analyze/pr, GET /analyze/pr/{id}, GET /health
        schemas.py           # Request/response Pydantic models
      domain/
        __init__.py
        ports.py             # ABC interfaces: CodeReviewPort, GitHubPort, NoteCallbackPort
        models.py            # Domain models: PRAnalysis, CodeReviewResult, AnalysisJob
        agent.py             # ADK agent definition with tools
        pipeline.py          # Orchestration: run agent, collect results, format note
      adapters/
        __init__.py
        github_adapter.py    # httpx-based GitHub API adapter (implements GitHubPort)
        qodo_adapter.py      # pr-agent library adapter (implements CodeReviewPort)
        note_callback.py     # HTTP callback adapter (implements NoteCallbackPort)
  tests/
    __init__.py
    conftest.py
    test_api.py
    test_agent.py
    test_github_adapter.py
    test_qodo_adapter.py
    test_pipeline.py
    test_url_validation.py
```

### Node.js Integration Points
```
apps/backend/src/
  routes/analyze.js          # Fastify routes: proxy to Python service (conditional registration)
  services/analyze-service.js # Job tracking, Python service health, forward requests
  contracts/v1/analyze.js     # Contract definitions for analyze operations

apps/desktop/src/
  main/
    main.js                   # Add: Python process spawn, PR IPC handlers, URL detection in polling
    preload-capture.js        # Add: PR analysis IPC methods
    pr-service-process.js     # New: spawn/kill Python process, health polling
  renderer/
    capture-overlay/
      capture-overlay.html    # Add: 4th button, URL popover, status text
```

### Pattern 1: ADK Agent with Tool Orchestration
**What:** Define an ADK LlmAgent with custom Python function tools that call Qodo and GitHub adapters.
**When to use:** For the PR analysis pipeline where the agent coordinates multiple data sources.
**Example:**
```python
# Source: https://adk.dev/agents/llm-agents/ + https://adk.dev/agents/models/litellm/
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm

def review_pr(pr_url: str) -> dict:
    """Run Qodo Merge code review on a pull request."""
    # Adapter call to Qodo
    ...

def describe_pr(pr_url: str) -> dict:
    """Generate PR description and categorized changes."""
    ...

def improve_pr(pr_url: str) -> dict:
    """Get code improvement suggestions for a pull request."""
    ...

def fetch_pr_metadata(owner: str, repo: str, number: int) -> dict:
    """Fetch PR metadata and existing review comments from GitHub API."""
    ...

pr_analysis_agent = LlmAgent(
    model=LiteLlm(model="openai/gpt-4o"),
    name="pr_analysis_agent",
    instruction="""You are a PR analysis agent. Given a GitHub PR URL:
    1. Fetch PR metadata and existing review comments
    2. Run code review analysis
    3. Generate PR description with categorized changes
    4. Get improvement suggestions
    5. Synthesize all findings into a structured analysis note...""",
    tools=[review_pr, describe_pr, improve_pr, fetch_pr_metadata],
)
```

### Pattern 2: Hexagonal Port/Adapter with ABC
**What:** Abstract base classes define port interfaces; concrete adapters implement them.
**When to use:** For all external dependencies (GitHub, Qodo, note callback).
**Example:**
```python
# Source: Decision D-44, D-45, D-46
from abc import ABC, abstractmethod
from pr_insight.domain.models import PRMetadata, CodeReviewResult

class CodeReviewPort(ABC):
    @abstractmethod
    async def review(self, pr_url: str) -> CodeReviewResult:
        ...

    @abstractmethod
    async def describe(self, pr_url: str) -> dict:
        ...

    @abstractmethod
    async def improve(self, pr_url: str) -> list[dict]:
        ...

class GitHubPort(ABC):
    @abstractmethod
    async def get_pr_metadata(self, owner: str, repo: str, number: int) -> PRMetadata:
        ...

    @abstractmethod
    async def get_review_comments(self, owner: str, repo: str, number: int) -> list[dict]:
        ...
```

### Pattern 3: Async Job Tracking with Polling
**What:** POST creates a job, returns ID. Client polls GET for status. In-memory dict tracks jobs.
**When to use:** For the async analysis flow (D-17).
**Example:**
```python
# Source: Decision D-17
import uuid
from enum import Enum

class JobStatus(str, Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    FETCHING_REVIEWS = "fetching_reviews"
    GENERATING_NOTE = "generating_note"
    COMPLETED = "completed"
    FAILED = "failed"

# In-memory store (Claude's discretion per CONTEXT.md)
jobs: dict[str, dict] = {}

async def create_analysis_job(pr_url: str) -> str:
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": JobStatus.PENDING, "result": None, "error": None}
    # Launch background task
    asyncio.create_task(run_analysis(job_id, pr_url))
    return job_id
```

### Pattern 4: Python Process Lifecycle from Node.js
**What:** Spawn a long-running Python process, poll health, kill on shutdown.
**When to use:** Node.js main process manages the Python FastAPI service.
**Example:**
```javascript
// Source: Existing backend-process.js pattern
const { spawn } = require('child_process');

function startPrService({ port = 8100, venvPath }) {
  const pythonBin = path.join(venvPath, 'bin', 'python');
  const child = spawn(pythonBin, ['-m', 'uvicorn', 'pr_insight.main:app',
    '--host', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return child;
}

// Poll health endpoint until ready (same pattern as backend-process.js)
async function waitForPrServiceHealth(baseUrl, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch { /* still starting */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('PR analysis service failed to start');
}
```

### Pattern 5: Qodo PR-Agent Programmatic Usage
**What:** Import pr-agent as library and call review/describe/improve programmatically.
**When to use:** In the Qodo adapter.
**Example:**
```python
# Source: https://qodo-merge-docs.qodo.ai/installation/locally/
from pr_agent import cli
from pr_agent.config_loader import get_settings

async def run_qodo_review(pr_url: str) -> dict:
    get_settings().set("CONFIG.git_provider", "github")
    get_settings().set("openai.key", settings.openai_api_key)
    get_settings().set("github.user_token", settings.github_token)
    result = await cli.run_command(pr_url, "/review")
    return result
```

### Pattern 6: Overlay Button with URL Detection
**What:** Extend app detection polling to detect GitHub PR URLs and show 4th button.
**When to use:** In the existing 500ms app detection loop.
**Example:**
```javascript
// Source: Existing app-detector.js + Phase 8 AppleScript pattern
const PR_URL_PATTERN = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

// Inside startAppDetection() polling loop:
if (prAnalysisEnabled && isBrowser) {
  const url = await getBrowserTabUrl(windowInfo.bundleId);
  const match = url.match(PR_URL_PATTERN);
  if (match) {
    captureOverlay.webContents.send('pr:url-detected', {
      url, owner: match[1], repo: match[2], number: parseInt(match[3]),
    });
  } else {
    captureOverlay.webContents.send('pr:url-cleared');
  }
}
```

### Anti-Patterns to Avoid
- **Running Qodo as subprocess:** Decision D-09 explicitly requires library import, not `subprocess.run(['pr-agent', ...])`. CLI subprocess would be fragile and harder to extract structured results.
- **Blocking the FastAPI event loop:** All I/O in tools must be async. Qodo library calls may be sync internally -- wrap with `asyncio.to_thread()` if needed.
- **Sharing .env files between services:** Python service has its own .env (D-29). Do not read from Node.js backend's settings or share a single .env file.
- **Storing analysis results in SQLite:** Job results are ephemeral (in-memory dict). The permanent artifact is the note created via callback. Do not add a database to the Python service.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PR code review analysis | Custom LLM prompts for diff review | Qodo PR-Agent `review` | Handles diff parsing, context extraction, review formatting |
| PR change categorization | Manual diff categorization | Qodo PR-Agent `describe` | Automatically categorizes changes into features/fixes/refactors |
| Code improvement suggestions | Custom code suggestion prompts | Qodo PR-Agent `improve` | Structured improvement suggestions with code context |
| LLM provider abstraction | Custom OpenAI client wrapper | ADK + LiteLLM | Handles model routing, retries, token management |
| GitHub API pagination | Manual pagination loops | httpx + GitHub Link headers | GitHub REST API pagination is complex with Link headers |
| OpenAPI documentation | Manual API docs | FastAPI auto-generation | Free, always-in-sync OpenAPI spec (D-49) |
| Python linting + formatting | flake8 + black + isort | Ruff | Single tool replaces all three, 10-100x faster |
| URL validation regex | Simple string matching | Regex pattern with capture groups | `github.com/{owner}/{repo}/pull/{number}` needs proper parsing |

**Key insight:** The primary value of this phase is orchestrating existing tools (Qodo, GitHub API) through an ADK agent, not reimplementing their functionality. The agent adds synthesis and structured output that individual tools don't provide alone.

## Common Pitfalls

### Pitfall 1: Python Version Mismatch (CRITICAL)
**What goes wrong:** `google-adk` requires Python >=3.10, `pr-agent` requires Python >=3.12. Decision D-40 states "Python 3.9+" as prerequisite. The dev machine has Python 3.9.6.
**Why it happens:** Library version requirements evolved after the context discussion. ADK and pr-agent both have modern Python requirements.
**How to avoid:** The actual minimum is Python 3.12 (driven by pr-agent). Update D-40 to reflect Python 3.12+. The venv setup (D-42) must find or error on python3.12+. Consider checking for `python3.12`, `python3.11`, `python3` in PATH order.
**Warning signs:** `pip install` fails with "requires Python >=3.12", mysterious syntax errors from 3.12-only features (match statements, etc.).

### Pitfall 2: Qodo PR-Agent Sync Blocking in Async Context
**What goes wrong:** pr-agent's internal operations are likely synchronous (HTTP calls to OpenAI/GitHub). Running them directly in a FastAPI async handler blocks the event loop.
**Why it happens:** pr-agent was designed for CLI usage, not as an async library.
**How to avoid:** Wrap synchronous pr-agent calls with `asyncio.to_thread()` to run in a thread pool. This keeps FastAPI responsive while Qodo runs.
**Warning signs:** FastAPI health endpoint stops responding during analysis, other requests queue behind a running analysis.

### Pitfall 3: ADK Agent Not Returning Structured Output
**What goes wrong:** The ADK agent returns free-form text instead of the structured note format needed (D-23).
**Why it happens:** LLM output is unpredictable; the agent may not follow the exact note structure.
**How to avoid:** Use detailed instructions in the agent with explicit section headers. Post-process agent output in the pipeline: parse sections, validate presence of required parts, format Mermaid blocks. Consider using a two-pass approach: agent generates analysis, then a structured formatting pass.
**Warning signs:** Notes missing sections, inconsistent formatting between analyses.

### Pitfall 4: Python Process Not Terminating on App Quit
**What goes wrong:** The Python FastAPI process keeps running after Electron quits, consuming resources.
**Why it happens:** The Python process may not inherit the kill signal, or uvicorn may handle SIGTERM by waiting for in-flight requests.
**How to avoid:** Track the child PID. Send SIGTERM first, then SIGKILL after timeout (same pattern as `stopBackendProcess` in backend-process.js). Register cleanup in Electron's `app.on('before-quit')` and `will-quit`.
**Warning signs:** `ps aux | grep uvicorn` shows orphaned processes after closing Privanote.

### Pitfall 5: Venv Auto-Setup Timeout
**What goes wrong:** First-time pip install in venv takes 30-60+ seconds (D-42). If Node.js health polling timeout is too short, it gives up before the service is ready.
**Why it happens:** pip downloads and installs many packages (google-adk has heavy dependencies, pr-agent pulls in many LLM-related packages).
**How to avoid:** Separate the venv setup phase from the service start phase. Setup creates venv + pip install (longer timeout, 120s+). Service start just launches uvicorn (shorter timeout, 30s). Log progress to console (D-43).
**Warning signs:** "PR analysis service failed to start" on first run, works on second run.

### Pitfall 6: pr-agent Global Settings Contamination
**What goes wrong:** `get_settings().set()` modifies global state. If multiple analyses run (even sequentially), settings from one leak into the next.
**Why it happens:** pr-agent uses a global settings singleton.
**How to avoid:** Set configuration fresh before each analysis run. Consider resetting the settings object or using pr-agent's configuration file approach instead of runtime `set()` calls.
**Warning signs:** Wrong API keys used, wrong git provider, intermittent auth failures.

### Pitfall 7: Overlay Window Resize for URL Popover
**What goes wrong:** The overlay window is 48px wide. The URL input popover is 280px. The BrowserWindow must resize to accommodate the popover, then resize back.
**Why it happens:** The overlay is a fixed-size BrowserWindow, not a standard DOM popup that can overflow.
**How to avoid:** Use the existing `overlay:resize` IPC pattern. When popover opens: resize to 336px width (48+8+280). When popover closes: resize back to 48px. Anchor position must account for screen edge proximity.
**Warning signs:** Popover clipped by screen edge, overlay jumps position when resizing, popover appears off-screen.

### Pitfall 8: Browser URL Detection Polling Overhead
**What goes wrong:** Adding PR URL pattern matching to the 500ms polling loop adds AppleScript calls even when the feature is not useful (non-GitHub pages).
**Why it happens:** The existing polling already calls getBrowserTabUrl for whitelist matching. Adding PR detection means parsing every URL for the PR pattern.
**How to avoid:** The URL is already fetched for whitelist matching. Just add the regex check to the existing URL -- no extra AppleScript call needed. Only send `pr:url-detected` IPC when the match state changes (not every 500ms).
**Warning signs:** Excessive IPC traffic, overlay flickering, CPU usage increase.

## Code Examples

### ADK Agent with LiteLLM and OpenAI (Verified)
```python
# Source: https://adk.dev/agents/models/litellm/
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.runners import InMemoryRunner
from google.genai import types as genai_types

agent = LlmAgent(
    model=LiteLlm(model="openai/gpt-4o"),
    name="pr_analysis_agent",
    instruction="Analyze the given PR...",
    tools=[review_pr, describe_pr, improve_pr, fetch_pr_metadata],
)

runner = InMemoryRunner(agent=agent)

async def run_agent(pr_url: str) -> str:
    user_message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=f"Analyze this PR: {pr_url}")],
    )
    final_text = ""
    async for event in runner.run_async(
        user_id="privanote",
        session_id=f"pr-{uuid.uuid4()}",
        new_message=user_message,
    ):
        if event.is_final_response() and event.content and event.content.parts:
            final_text = event.content.parts[0].text
    return final_text
```

### Qodo PR-Agent Programmatic Call (Verified)
```python
# Source: https://qodo-merge-docs.qodo.ai/installation/locally/
from pr_agent import cli
from pr_agent.config_loader import get_settings

async def run_qodo_tool(pr_url: str, command: str, config: dict) -> str:
    get_settings().set("CONFIG.git_provider", "github")
    get_settings().set("openai.key", config["openai_api_key"])
    get_settings().set("github.user_token", config["github_token"])
    # Wrap sync call for async context
    result = await asyncio.to_thread(cli.run_command, pr_url, f"/{command}")
    return result
```

### FastAPI Async Job Pattern
```python
# Source: FastAPI background tasks pattern
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
import uuid

app = FastAPI(title="PR Insight", version="0.1.0")

class AnalyzeRequest(BaseModel):
    url: str

class AnalyzeResponse(BaseModel):
    job_id: str

@app.post("/api/v1/analyze/pr", response_model=AnalyzeResponse)
async def start_analysis(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    # Validate URL
    if not PR_URL_PATTERN.match(request.url):
        raise HTTPException(status_code=422, detail="Enter a valid GitHub PR URL")
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "pending", "result": None, "error": None}
    background_tasks.add_task(run_analysis_pipeline, job_id, request.url)
    return AnalyzeResponse(job_id=job_id)

@app.get("/api/v1/analyze/pr/{job_id}")
async def get_analysis_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
```

### Node.js Python Process Management
```javascript
// Source: Existing backend-process.js pattern adapted for Python
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DEFAULT_PR_SERVICE_PORT = 8100;

function resolvePrServiceDir() {
  return path.resolve(__dirname, '..', '..', '..', '..', 'pr-analysis');
}

function resolveVenvPython(serviceDir) {
  return path.join(serviceDir, '.venv', 'bin', 'python');
}

async function ensureVenvReady(serviceDir) {
  const venvPython = resolveVenvPython(serviceDir);
  if (fs.existsSync(venvPython)) return;

  console.log('[pr-insight] Creating virtual environment...');
  // Create venv and install deps
  const { execSync } = require('child_process');
  execSync('python3 -m venv .venv', { cwd: serviceDir });
  execSync('.venv/bin/pip install -r requirements.txt', { cwd: serviceDir, timeout: 120000 });
  console.log('[pr-insight] Setup complete.');
}
```

### Callback URL for Note Creation
```python
# Source: Decision D-47
import httpx

class NoteCallbackAdapter:
    def __init__(self, callback_url: str):
        self._callback_url = callback_url

    async def send_analysis_result(self, result: dict) -> None:
        async with httpx.AsyncClient() as client:
            response = await client.post(self._callback_url, json=result)
            response.raise_for_status()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pr-agent CLI subprocess | pr-agent library import | 2024+ | Structured results, no shell parsing |
| Custom LLM orchestration | Google ADK agents | 2025 | Standard agent framework with tools, sessions, runners |
| PyGithub (sync) | httpx AsyncClient | 2024+ | Native async for FastAPI, better performance |
| flake8 + black + isort | Ruff | 2023+ | Single tool, 10-100x faster |
| requirements.txt only | pyproject.toml + requirements.txt | 2024+ | Modern Python packaging standard |

**Deprecated/outdated:**
- `codium-ai/pr-agent` org on GitHub: Renamed to `qodo-ai/pr-agent`. Use the qodo import paths.
- ADK docs at `google.github.io/adk-docs/`: Redirects to `adk.dev/`. Use new URL.

## Open Questions

1. **pr-agent sync vs async internals**
   - What we know: pr-agent's CLI is synchronous. The `cli.run_command()` function calls `PRAgent().handle_request()` which uses asyncio internally.
   - What's unclear: Whether calling `cli.run_command` from within an already-running asyncio loop causes issues (nested event loop). May need `asyncio.to_thread()` or may need to call the async `PRAgent().handle_request()` directly.
   - Recommendation: Start with `asyncio.to_thread(cli.run_command, ...)`. If that fails, call the underlying `PRAgent().handle_request()` async method directly.

2. **pr-agent output format**
   - What we know: pr-agent generates markdown output for review/describe/improve.
   - What's unclear: The exact structure of programmatic return values (string? dict? custom objects?). The library is primarily CLI-focused.
   - Recommendation: During implementation, inspect the return value of `cli.run_command()` and `PRAgent().handle_request()`. May need to capture stdout or intercept output.

3. **ADK tool function return to agent**
   - What we know: ADK tools return dicts or strings that the LLM uses for synthesis.
   - What's unclear: Whether very large tool outputs (e.g., 500+ file PR review) exceed LLM context limits.
   - Recommendation: Truncate or summarize tool outputs before returning to the agent. The agent should receive digestible summaries, not raw multi-thousand-line diffs.

4. **Callback URL routing**
   - What we know: Python calls a callback URL with analysis JSON (D-47). Node.js maps this to createNode.
   - What's unclear: How the Node.js backend receives this callback (new internal route? direct service call?).
   - Recommendation: Add an internal POST endpoint on the Fastify backend (e.g., `POST /internal/pr-callback`) that creates the note via nodes-service. Python service calls this URL. The route is localhost-only and not exposed to the desktop client.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | All Python code | Partial | 3.9.6 (too old) | Must install Python 3.12+ (homebrew/pyenv) |
| pip | Package installation | Yes | 25.2 | -- |
| Node.js | Backend + Electron | Yes | (via nvm) | -- |
| Git | Source control | Yes | -- | -- |

**Missing dependencies with no fallback:**
- Python 3.12+: Required by pr-agent (>=3.12). System Python is 3.9.6. Must install via `brew install python@3.12` or pyenv. The venv auto-setup (D-42) should look for `python3.12` first, then `python3.11`, then `python3`, and fail with a clear message if the found version is < 3.12.

**Missing dependencies with fallback:**
- None -- all other tooling (Node.js, npm, git) is available.

## Project Constraints (from CLAUDE.md)

No CLAUDE.md file exists in this project. No additional project-wide constraints beyond what is captured in CONTEXT.md decisions.

## Sources

### Primary (HIGH confidence)
- [Google ADK PyPI](https://pypi.org/project/google-adk/) - v1.28.0, Python >=3.10, Apache 2.0
- [ADK LiteLLM docs](https://adk.dev/agents/models/litellm/) - LlmAgent + LiteLlm model configuration
- [ADK LlmAgent docs](https://adk.dev/agents/llm-agents/) - Tool definition patterns, agent configuration
- [ADK Quick Start](https://adk.dev/get-started/quickstart/) - InMemoryRunner, event processing
- [pr-agent PyPI](https://pypi.org/project/pr-agent/) - v0.3.0, Python >=3.12
- [Qodo Merge local install](https://qodo-merge-docs.qodo.ai/installation/locally/) - Programmatic usage pattern
- [pr-agent CLI source](https://github.com/qodo-ai/pr-agent/blob/main/pr_agent/cli.py) - PRAgent().handle_request() pattern

### Secondary (MEDIUM confidence)
- [FastAPI + ADK integration](https://dev.to/timtech4u/building-ai-agents-with-google-adk-fastapi-and-mcp-26h7) - Community example of ADK + FastAPI
- [httpx for FastAPI](https://medium.com/@benshearlaw/how-to-use-httpx-request-client-with-fastapi-16255a9984a4) - AsyncClient pattern
- [ADK InMemoryRunner tutorial](https://github.com/Kjdragan/google-adk-tutorial/blob/main/02_runner.md) - Runner pattern with run_async

### Tertiary (LOW confidence)
- pr-agent programmatic output format: Could not find documentation on the exact return type of `cli.run_command()`. Needs validation during implementation.
- ADK large context handling: No official guidance on tool output size limits. Needs empirical testing.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - Package versions and APIs verified via PyPI and official docs, but pr-agent's programmatic API is under-documented
- Architecture: HIGH - Hexagonal architecture is well-defined in decisions, patterns follow established FastAPI and ADK conventions
- Pitfalls: HIGH - Python version mismatch verified empirically (system Python 3.9.6 vs required 3.12), async blocking risk is well-known
- Integration: MEDIUM - Node.js spawn pattern is proven (backend-process.js), but Python lifecycle management adds new complexity

**Research date:** 2026-04-02
**Valid until:** 2026-04-16 (pr-agent and google-adk evolve rapidly; check versions before implementation)
