# Codebase Concerns

**Analysis Date:** 2026-03-28

## Tech Debt

**Database location is tied to the current working directory:**
- Issue: `src/main/database.js` stores SQLite data under `process.cwd()/data`, so the database location changes depending on how the app is launched.
- Why: Fast setup for a local-first prototype.
- Impact: Packaged launches, scripts, and ad hoc terminal runs can create or read different databases, which makes data feel "lost" or split across folders.
- Fix approach: Move storage to `app.getPath('userData')` and make the directory configurable in settings.

**Renderer owns too much state and I/O orchestration:**
- Issue: `src/renderer/App.jsx` mixes node loading, attachment loading, form state, and all CRUD flows in one component.
- Why: Simple MVP implementation.
- Impact: Small changes can break unrelated UI paths, and the async flows are harder to reason about.
- Fix approach: Split data access, selection state, and form components into smaller modules.

**Main-process bootstrap and dev-server wiring are brittle:**
- Issue: `src/main/main.js` combines startup, IPC registration, and environment-specific URL loading in one file.
- Why: Minimal Electron bootstrapping.
- Impact: Startup regressions are easy to introduce, and the app depends on exact path assumptions.
- Fix approach: Extract window creation and environment config into dedicated helpers.

## Known Bugs

**Electron main process does not currently parse:**
- Symptoms: The app fails to start with a syntax error before any window is created.
- Trigger: Running `electron .` or `npm run dev` against the current `src/main/main.js`.
- Workaround: None in the current tree.
- Root cause: `src/main/main.js:49` contains a stray trailing `\` after the string fallback for `VITE_DEV_SERVER_URL`.
- Blocked by: A code fix in `src/main/main.js`.

**SQLite cascade delete is defined but not enabled:**
- Symptoms: Deleting a node can leave attachment rows behind.
- Trigger: Create a node with attachments, then delete the node.
- Workaround: Manual cleanup of orphan attachment rows.
- Root cause: `src/main/database.js` defines `FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE`, but SQLite foreign keys are not enabled with `PRAGMA foreign_keys = ON`.

**Attachment details can show stale data after quick node switching:**
- Symptoms: The attachment panel may briefly show attachments from the previously selected node.
- Trigger: Switch between nodes quickly while attachment queries are still in flight.
- Workaround: Slow down selection changes.
- Root cause: `src/renderer/App.jsx` calls `loadAttachments(selectedNode.id)` without cancellation or request sequencing.

## Security Considerations

**Raw IPC bridge is exposed to the renderer:**
- Risk: Any renderer-side bug or XSS can call `window.api` methods exposed from `src/main/preload.js`.
- Current mitigation: The preload surface is limited to node, attachment, and file-picker actions.
- Recommendations: Add input schema validation at the IPC boundary and keep the bridge as narrow as possible.

**File paths and cloud URLs are accepted with no normalization:**
- Risk: `src/main/database.js` persists arbitrary `local_path` and `cloud_url` values from renderer input.
- Current mitigation: `addAttachment()` checks that `local_path` is non-empty and `kind` is one of the allowed values.
- Recommendations: Normalize paths, reject unexpected URL schemes, and validate any future open/preview/download actions.

**Electron hardening is not explicit:**
- Risk: The main window setup in `src/main/main.js` relies on defaults instead of setting `contextIsolation`, `nodeIntegration`, and `sandbox` explicitly.
- Current mitigation: The app uses a preload script and does not expose Node directly from the renderer code.
- Recommendations: Set Electron security flags explicitly in the `BrowserWindow` configuration.

## Performance Bottlenecks

**Synchronous SQLite work runs on the Electron main thread:**
- Problem: All list/create/update/delete operations in `src/main/database.js` use `better-sqlite3`, which is synchronous.
- Measurement: No profiling numbers are present in the repo.
- Cause: Every IPC request blocks the main process until the database call finishes.
- Improvement path: Keep payloads small, add pagination for large lists, and profile before adding heavier queries or previews.

## Fragile Areas

**Startup path is highly sensitive to syntax and path changes:**
- Why fragile: `src/main/main.js` is the app entry point, so any parse error or bad path prevents the entire desktop app from launching.
- Common failures: One-character syntax mistakes, incorrect dev-server URL fallback, or incorrect `dist/` path assumptions.
- Safe modification: Add a startup smoke test and keep dev/prod path logic isolated.
- Test coverage: No startup test exists.

**Schema behavior depends on SQLite defaults:**
- Why fragile: `src/main/database.js` assumes foreign-key cascade behavior without enabling the corresponding pragma.
- Common failures: Orphaned attachments, inconsistent cleanup after deletes, and false confidence from the schema definition.
- Safe modification: Enable `PRAGMA foreign_keys = ON` immediately after opening the database and add a regression test.
- Test coverage: No database integration tests exist.

**Renderer async state is easy to race:**
- Why fragile: `src/renderer/App.jsx` has multiple async effects and mutations that all update the same `error`, `attachments`, and selection state.
- Common failures: Stale attachment lists, overwritten error messages, and selection drift after deletions.
- Safe modification: Add request sequencing or cancellation and reduce shared state.
- Test coverage: No React tests cover these flows.

## Scaling Limits

**Local SQLite storage is the practical ceiling for now:**
- Current capacity: No explicit limit is documented or enforced.
- Limit: The app is single-user, local-first, and all persistence is synchronous in-process.
- Symptoms at limit: UI stalls during large reads/writes, and data access remains tied to one machine.
- Scaling path: Add pagination, background work for heavier operations, and a storage abstraction before cloud sync.

## Dependencies at Risk

**Native SQLite dependency is coupled to Electron upgrades:**
- Risk: `better-sqlite3` ships native bindings and can require rebuilds or version checks when Electron is upgraded.
- Impact: App startup or packaging can fail if the native module and Electron ABI drift.
- Migration plan: Rebuild and verify against each Electron upgrade; consider a non-native storage path only if the app needs broader portability.

**Electron runtime expectations can shift across major upgrades:**
- Risk: `electron` upgrades may change security defaults or packaging behavior.
- Impact: The window bootstrap in `src/main/main.js` and the preload boundary in `src/main/preload.js` may need re-validation.
- Migration plan: Lock the Electron version intentionally and run a startup smoke test before bumping.

## Missing Critical Features

**Attachment preview and playback are absent:**
- Problem: `src/renderer/App.jsx` only lists attachment paths; there is no in-app open, preview, or media playback path.
- Current workaround: Copy the path and inspect the file externally.
- Blocks: Usability for audio/video attachments and quick content verification.
- Implementation complexity: Medium.

**Storage and provider configuration are not implemented:**
- Problem: `README.md` mentions configurable storage directories and cloud connector work, but there is no settings surface or connector layer in `src/main/` yet.
- Current workaround: Manual local file paths only.
- Blocks: Cloud-backed attachments, account configuration, and portable installs.
- Implementation complexity: High.

## Test Coverage Gaps

**No automated tests are wired up:**
- What's not tested: Startup, IPC contracts, SQLite schema setup, delete behavior, attachment loading, and renderer state transitions.
- Risk: Regressions in `src/main/main.js`, `src/main/database.js`, and `src/renderer/App.jsx` will ship unnoticed.
- Priority: High.
- Difficulty to test: The repo currently has no test runner or fixtures; `package.json` maps `npm test` to a placeholder.

**Regression coverage for cascade and stale-state bugs is missing:**
- What's not tested: Node deletion cleanup and attachment-list race conditions.
- Risk: These are easy to reintroduce during refactors.
- Priority: High.
- Difficulty to test: Requires integration-style setup for Electron plus SQLite and a renderer interaction harness.

*Concerns audit: 2026-03-28*
*Update as issues are fixed or new ones discovered*
