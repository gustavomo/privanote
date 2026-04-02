# PR Insight

PR Insight is a Python service that analyzes GitHub pull requests using ADK agents and Qodo Merge. It produces structured notes with code review findings, categorized changes, improvement suggestions, and Mermaid diagrams.

## Setup

1. Create a virtual environment and install dependencies:

```bash
make setup
```

2. Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required credentials:
- `GITHUB_TOKEN` -- GitHub personal access token with repo read access
- `OPENAI_API_KEY` -- OpenAI API key for gpt-4o
- `QODO_SERVICE_PORT` -- Port for the service (default: 8100)
- `NOTE_CALLBACK_URL` -- URL for note creation callback

## Usage

Run the development server:

```bash
.venv/bin/uvicorn pr_insight.main:app --host 127.0.0.1 --port 8100
```

Run tests:

```bash
make test
```

Lint the codebase:

```bash
make lint
```

Format the codebase:

```bash
make format
```

## API

| Method | Endpoint                       | Description                    |
|--------|--------------------------------|--------------------------------|
| POST   | `/api/v1/analyze/pr`           | Start a PR analysis job        |
| GET    | `/api/v1/analyze/pr/{job_id}`  | Get analysis job status/result |
| GET    | `/health`                      | Health check                   |

### POST /api/v1/analyze/pr

Request body:

```json
{
  "url": "https://github.com/owner/repo/pull/123"
}
```

Response:

```json
{
  "job_id": "uuid-string"
}
```

### GET /api/v1/analyze/pr/{job_id}

Response:

```json
{
  "id": "uuid-string",
  "status": "pending|analyzing|fetching_reviews|generating_note|completed|failed",
  "result": { ... },
  "error": null
}
```

## Architecture

PR Insight uses hexagonal (ports and adapters) architecture:

```
src/pr_insight/
  main.py          -- FastAPI app factory and uvicorn entry point
  config.py        -- Settings from .env via pydantic-settings
  api/             -- Routes and request/response schemas
    router.py      -- FastAPI route definitions
    schemas.py     -- Pydantic request/response models
  domain/          -- Core business logic
    agent.py       -- ADK agent definition with tools
    models.py      -- Domain models (PRInfo, AnalysisJob, etc.)
    ports.py       -- Abstract port interfaces (ABCs)
    pipeline.py    -- Orchestration: run agent, collect results, format note
  adapters/        -- External service implementations
    github_adapter.py   -- httpx-based GitHub API (implements GitHubPort)
    qodo_adapter.py     -- Qodo Merge library (implements CodeReviewPort)
    note_callback.py    -- HTTP callback (implements NoteCallbackPort)
```

## Development

- Python >= 3.12 required
- Ruff for linting and formatting (line length: 88)
- Type hints on all function signatures and return types
- Pydantic models for all data structures

## Testing

- `pytest` for all Python tests
- Gherkin-style test naming (Given/When/Then in test names)
- Integration tests use a dedicated test repo fixture (configured in `tests/conftest.py` as `TEST_PR_URL`)
- Use a known, stable PR (e.g., a small merged PR in an org-owned public repo) that will not change
- Override via `TEST_PR_URL` env var for your own test fixture
