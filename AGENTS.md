<!-- GSD:project-start source:PROJECT.md -->
## Project

**Privanote**

Privanote is a local-first Electron desktop app for managing content nodes with attached files, audio, and video. It stores note and attachment metadata in SQLite on the user's machine and uses a React renderer with a preload-backed IPC boundary for native desktop actions. The current brownfield scope extends the existing local attachment workflow toward in-app media handling and optional cloud-backed attachment providers.

**Core Value:** A user can capture and revisit media-backed notes locally, quickly, and without losing control of where their data lives.

### Constraints

- **Tech stack**: Electron 28, React 18, Vite, and `better-sqlite3` — the current application architecture is already built around these choices
- **Brownfield architecture**: Preserve the Electron main/preload/renderer split — the existing IPC boundary is the core structural pattern in the repo
- **Local-first behavior**: User data must remain understandable and controllable on disk — this is central to the product's value proposition
- **Reliability**: Current startup and data-integrity issues must be corrected early — existing code has blocking defects that would undermine new features
- **Desktop focus**: New work should optimize the Electron desktop experience first — there is no server or alternate client platform in the repo today
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- JavaScript - application code in `src/main/main.js`, `src/main/database.js`, `src/main/preload.js`, `src/renderer/main.jsx`, and `src/renderer/App.jsx`.
- JSX - React UI components in `src/renderer/App.jsx` and `src/renderer/main.jsx`.
- HTML - renderer shell in `src/renderer/index.html`.
- JSON - package metadata in `package.json` and dependency lock data in `package-lock.json`.
## Runtime
- Electron 28.x desktop runtime drives the app process model.
- Node.js is required through Electron and the npm scripts, but no explicit Node engine version is declared in `package.json`.
- The app runs as a local desktop client, not as a browser-hosted web app.
- npm is used for installs and scripts.
- Lockfile: `package-lock.json` is present.
## Frameworks
- Electron 28.x - desktop shell, main process, BrowserWindow, IPC, and native dialog access from `src/main/main.js`.
- React 18.2.x - renderer UI in `src/renderer/App.jsx`.
- None currently. `package.json` defines `npm test` as a placeholder that prints `No tests`.
- Vite 4.4.x - renderer development server and production bundling via `vite.config.js`.
- `@vitejs/plugin-react` 4.x - JSX/React transform for the Vite renderer build.
- `concurrently` 8.2.x - runs Electron and Vite together during development.
## Key Dependencies
- `electron` - desktop runtime and native app container.
- `react` / `react-dom` - renderer view layer and DOM mounting.
- `better-sqlite3` - local persistence layer used by `src/main/database.js`.
- `vite` - renderer build pipeline with `root: 'src/renderer'` and `outDir: '../../dist'` in `vite.config.js`.
- `@vitejs/plugin-react` - JSX compilation for the renderer.
- `concurrently` - development orchestration for `npm run dev`.
## Configuration
- No required environment variables are documented.
- `src/main/main.js` reads `VITE_DEV_SERVER_URL` in development and falls back to `http://localhost:5173`.
- Runtime data is stored under `data/`, which is gitignored in `.gitignore`.
- `vite.config.js` controls renderer bundling.
- `src/main/main.js` is the Electron entry point from `package.json`.
- `src/renderer/main.jsx` is the renderer bootstrap and `src/renderer/index.html` is the HTML entry.
## Platform Requirements
- Any desktop platform supported by Electron and Node.js.
- Local filesystem access is required because the app writes a SQLite file under `data/`.
- Electron packaged desktop app.
- Renderer production assets are emitted to `dist/` and loaded from `dist/index.html` in packaged mode.
## Not Present
- TypeScript is not used.
- No server framework is present.
- No test runner is configured.
- No mobile, browser-only, or web backend runtime is present.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Main-process files use lowercase names in `src/main/` such as `src/main/main.js`, `src/main/database.js`, and `src/main/preload.js`.
- Renderer files use React-oriented names in `src/renderer/` such as `src/renderer/App.jsx` and `src/renderer/main.jsx`.
- The HTML entry point is `src/renderer/index.html`, and the Vite config is `vite.config.js`.
- There is no test file naming pattern in the repo because there are no committed tests.
- Functions use `camelCase` throughout, including IPC registration helpers like `registerIpcHandlers()` and DB helpers like `sanitizeNodePayload()`.
- Event handlers and UI actions in `src/renderer/App.jsx` follow `handle*` naming, for example `handleCreateNode()` and `handleDeleteAttachment()`.
- Async functions do not use a special prefix; they are named by behavior only.
- Variables use `camelCase` consistently, including React state variables such as `selectedNodeId` and `attachmentPath`.
- Constants are `const` bindings, but not written in `UPPER_SNAKE_CASE` unless they are module-level lookup data like `attachmentKinds`.
- Private/internal helpers are not prefixed with `_`.
- The codebase is JavaScript-first, so there are no TypeScript interfaces, aliases, or enums in the current repo state.
## Code Style
- The code follows a Prettier-like style even though there is no config file in the repo.
- Single quotes are used in the inspected source files.
- Semicolons are used.
- Indentation is 2 spaces.
- There is no ESLint config in the repository root or under `src/`.
- There is no committed `npm run lint` script in `package.json`.
- Style is enforced by convention rather than a tool in this repo snapshot.
## Import Organization
- Imports are grouped with blank lines where helpful, but the repo does not show a strict multi-group import sorting convention.
- There are no type-only imports because the project does not use TypeScript.
- No path aliases are defined in `vite.config.js` or elsewhere in the repo.
- All imports are relative or package-based.
## Error Handling
- The main-process database layer throws plain `Error` instances for validation failures in `src/main/database.js`.
- Input is sanitized before writes, for example `sanitizeNodePayload()` trims strings and rejects empty titles.
- The renderer catches async failures around IPC calls and stores the message in local React state.
- Validation failures are thrown for invalid IDs, missing titles, and unsupported attachment kinds in `src/main/database.js`.
- Expected missing-record conditions also throw plain errors, such as `Node not found`.
- There is no custom error class hierarchy in the current codebase.
## Logging
- There is no logging framework configured in the repo.
- The inspected files do not use `pino`, `winston`, or a shared logger module.
- Operational state is surfaced through the UI rather than structured logs.
- The main process does not emit application logs in the inspected code.
- `console.log` is not part of the observed conventions, but there is also no lint rule enforcing that.
## Comments
- Comments are minimal in the current codebase.
- The repo relies on readable function names and straightforward control flow instead of explanatory comments.
- There is no strong comment-style pattern established in the inspected files.
- JSDoc/TSDoc is not used in the current repo state.
- There are no documented public APIs or annotated function contracts in the inspected source files.
- No established `TODO(username): ...` pattern was found.
- No tracked TODO comment convention is visible in the current files.
## Function Design
- Functions are generally small and single-purpose, especially in `src/main/database.js` and `src/main/preload.js`.
- The renderer component in `src/renderer/App.jsx` is larger, but it is still organized into focused handlers and helper functions.
- Functions typically take one payload object or a single ID argument.
- IPC payloads are passed as objects for create/update flows, such as `createNode(payload)` and `addAttachment(payload)`.
- Functions return concrete data or booleans, not Result wrappers.
- Database helpers return rows from SQLite queries when possible.
- Early returns are used for guard cases, especially in the renderer.
## Module Design
- CommonJS exports are used in the Electron main side, for example `module.exports` in `src/main/database.js`.
- ES module syntax is used in the renderer, for example `export default function App()` in `src/renderer/App.jsx`.
- Default exports are used for the React component, while utility helpers remain local to the module.
- There are no barrel files in the current repo state.
- Public APIs are exposed directly from the module where they are implemented.
## Application Architecture Notes
- `src/main/main.js` owns Electron window creation, IPC registration, and the file picker dialog.
- `src/main/database.js` owns SQLite initialization, schema creation, prepared statements, and CRUD logic.
- `src/main/preload.js` exposes a narrow `window.api` surface via `contextBridge`.
- `src/renderer/App.jsx` owns all current UI state, form handling, and IPC calls from the renderer.
- `vite.config.js` builds the renderer from `src/renderer` into `dist/`.
- `.gitignore` excludes `data/` so the local SQLite database stays out of version control.
## Current Gaps
- There is no lint configuration file in the repo.
- There is no formatter configuration file in the repo.
- There is no TypeScript layer, so type-level conventions are absent.
- There is no test framework or test file pattern to mirror yet.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Single desktop application split into `main` and `renderer` runtime contexts.
- Native capabilities stay in the Electron main process, not in the React UI.
- Renderer state is local and transient; durable app data lives in SQLite on disk.
- IPC is the primary boundary between UI and persistence.
## Layers
- Purpose: Own the desktop app lifecycle, window creation, native dialogs, and database access.
- Contains: Electron bootstrapping, IPC handlers, SQLite schema setup, CRUD operations.
- Depends on: `electron`, `path`, `fs`, `better-sqlite3`.
- Used by: Renderer through IPC channel calls exposed via preload.
- Purpose: Expose a narrow, safe API surface to the renderer.
- Contains: `contextBridge.exposeInMainWorld` API wiring for nodes, attachments, and file picking.
- Depends on: `ipcRenderer` and `contextBridge` from Electron.
- Used by: React code in the renderer through `window.api`.
- Purpose: Present the note management UI and coordinate user interactions.
- Contains: React entry point, app component, form state, selection state, and UI rendering.
- Depends on: `react`, `react-dom`, and the preload-exposed `window.api`.
- Used by: End users interacting with the desktop window.
- Purpose: Store nodes and attachments locally in a SQLite database.
- Contains: Schema creation, prepared statements, payload sanitization, and row mapping.
- Depends on: `better-sqlite3` and the filesystem for `data/privanote.db`.
- Used by: IPC handlers in the main process.
## Data Flow
- Persistent state lives in `data/privanote.db`.
- Renderer state is React component state only.
- No global in-memory domain store exists outside the database connection.
## Key Abstractions
- Purpose: Primary content record in the app.
- Examples: `nodes` table rows returned by `listNodes()`, `createNode()`, and `updateNode()`.
- Pattern: Relational record with timestamps and user-editable text fields.
- Purpose: File or media item associated with a node.
- Examples: `attachments` table rows, `kind` values of `audio`, `video`, or `file`.
- Pattern: Child record with a foreign key to `nodes.id`.
- Purpose: Named command boundary between renderer and main process.
- Examples: `nodes:list`, `nodes:create`, `attachments:add`, `files:pick`.
- Pattern: Request/response over `ipcRenderer.invoke` and `ipcMain.handle`.
- Purpose: Stable renderer-facing facade over IPC.
- Examples: `window.api.listNodes()`, `window.api.addAttachment()`, `window.api.pickFile()`.
- Pattern: Bridge object exposed with `contextBridge`.
## Entry Points
- Location: `src/main/main.js`
- Triggers: `npm start`, `npm run dev:main`, or packaged Electron launch.
- Responsibilities: Register handlers, create the browser window, choose dev vs packaged loading.
- Location: `src/renderer/main.jsx`
- Triggers: The HTML document at `src/renderer/index.html`.
- Responsibilities: Mount the React app into `#root`.
- Location: `vite.config.js`
- Triggers: `npm run build`.
- Responsibilities: Compile the renderer from `src/renderer` into `dist/`.
## Error Handling
- Database functions validate input before running SQL and throw descriptive `Error` objects on bad input.
- Main-process handlers return promise rejections back through `ipcRenderer.invoke(...)`.
- The React app catches async failures in each action handler and stores the message in component state.
- There is no centralized error middleware or structured logging layer.
## Cross-Cutting Concerns
- Input validation happens in `src/main/database.js` before inserts and updates.
- Required fields are enforced manually, such as node title and attachment path.
- The renderer does not access Node.js APIs directly.
- `src/main/preload.js` exposes only the methods the UI needs.
- File selection uses Electron's `dialog` API in the main process.
- Window lifecycle is controlled through Electron app events in `src/main/main.js`.
- Development serves the renderer through Vite.
- Production loads the built renderer from `dist/index.html`.
- No dedicated logger is present.
- Operational feedback is surfaced through renderer state and native dialogs only.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
