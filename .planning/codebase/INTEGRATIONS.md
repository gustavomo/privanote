# External Integrations

**Analysis Date:** 2026-03-28

## APIs & External Services

**Payment Processing:**
- None currently.

**Email/SMS:**
- None currently.

**External APIs:**
- None currently.
- The code does not call remote HTTP APIs, GraphQL services, or OAuth providers in the current repo state.
- `README.md` mentions future Google Drive / OneDrive connector adapters, but those are not implemented yet.

## Data Storage

**Databases:**
- SQLite - local on-disk database created by `src/main/database.js`.
  - Connection: file path `data/privanote.db` under the repo working directory.
  - Client: `better-sqlite3` from `package.json`.
  - Schema: `nodes` and `attachments` tables are created on startup.
  - Journaling: `journal_mode = WAL`.

**File Storage:**
- Local filesystem - attachment paths are stored as local file references, not uploaded to a cloud store.
  - Attachment selection uses Electron's native file picker in `src/main/main.js`.
  - Runtime data directory `data/` is ignored in `.gitignore`.

**Caching:**
- None currently.

## Authentication & Identity

**Auth Provider:**
- None currently.
- No login flow, session store, or token handling exists in the current code.

**OAuth Integrations:**
- None currently.

## Monitoring & Observability

**Error Tracking:**
- None currently.

**Analytics:**
- None currently.

**Logs:**
- No external logging provider.
- Any diagnostics would be local process output from Electron/Node.

## CI/CD & Deployment

**Hosting:**
- None currently.
- The repo does not define a deployment platform or cloud host.

**CI Pipeline:**
- None currently.
- No GitHub Actions or other CI workflow files were found in the inspected paths.

## Environment Configuration

**Development:**
- Required env vars: none documented.
- Optional dev override: `VITE_DEV_SERVER_URL` in `src/main/main.js`.
- Secrets location: none currently.
- Mock/stub services: none currently because there are no live integrations.

**Production:**
- Packaged Electron app loads renderer assets from `dist/index.html`.
- No external credentials or API keys are required in the current implementation.

## Webhooks & Callbacks

**Incoming:**
- None currently.

**Outgoing:**
- None currently.

## OS / Native Integrations

**Native Dialogs:**
- Electron file-open dialog in `src/main/main.js` via `dialog.showOpenDialog`.
  - Use: lets the user choose a local media or file attachment path.
  - Filters: `mp3`, `wav`, `m4a`, `mp4`, `mov`, `mkv`, `webm`, `txt`, `json`.

**Process Boundary:**
- Renderer-to-main IPC via `src/main/preload.js`.
  - Exposed API: `nodes:*`, `attachments:*`, and `files:pick`.
  - This is an internal Electron bridge, not a third-party integration.

*Integration audit: 2026-03-28*
*Update when adding/removing external services*
