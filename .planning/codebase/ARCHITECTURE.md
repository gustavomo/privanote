# Architecture

**Analysis Date:** 2026-03-28

## Pattern Overview

**Overall:** Electron desktop app with a thin IPC bridge and local SQLite persistence.

**Key Characteristics:**
- Single desktop application split into `main` and `renderer` runtime contexts.
- Native capabilities stay in the Electron main process, not in the React UI.
- Renderer state is local and transient; durable app data lives in SQLite on disk.
- IPC is the primary boundary between UI and persistence.

## Layers

**Main Process Layer:**
- Purpose: Own the desktop app lifecycle, window creation, native dialogs, and database access.
- Contains: Electron bootstrapping, IPC handlers, SQLite schema setup, CRUD operations.
- Depends on: `electron`, `path`, `fs`, `better-sqlite3`.
- Used by: Renderer through IPC channel calls exposed via preload.

**Preload Bridge Layer:**
- Purpose: Expose a narrow, safe API surface to the renderer.
- Contains: `contextBridge.exposeInMainWorld` API wiring for nodes, attachments, and file picking.
- Depends on: `ipcRenderer` and `contextBridge` from Electron.
- Used by: React code in the renderer through `window.api`.

**Renderer UI Layer:**
- Purpose: Present the note management UI and coordinate user interactions.
- Contains: React entry point, app component, form state, selection state, and UI rendering.
- Depends on: `react`, `react-dom`, and the preload-exposed `window.api`.
- Used by: End users interacting with the desktop window.

**Persistence Layer:**
- Purpose: Store nodes and attachments locally in a SQLite database.
- Contains: Schema creation, prepared statements, payload sanitization, and row mapping.
- Depends on: `better-sqlite3` and the filesystem for `data/privanote.db`.
- Used by: IPC handlers in the main process.

## Data Flow

**App Startup:**

1. Electron launches `src/main/main.js` as the process entry point.
2. The main process registers IPC handlers and creates a `BrowserWindow`.
3. In development, the window loads the Vite dev server URL.
4. In packaged mode, the window loads `dist/index.html`.
5. The renderer bootstraps React from `src/renderer/main.jsx`.

**Node CRUD Flow:**

1. The user creates, edits, or deletes a node in `src/renderer/App.jsx`.
2. The UI calls `window.api.*`, which is defined in `src/main/preload.js`.
3. Preload forwards the request through `ipcRenderer.invoke(...)`.
4. `ipcMain.handle(...)` in `src/main/main.js` dispatches to `src/main/database.js`.
5. Database functions validate payloads, run SQL, and return row data or booleans.
6. The renderer refreshes its local state by reloading nodes and reselecting the active node.

**Attachment Flow:**

1. The user selects a node and chooses an attachment kind in the renderer.
2. The UI may request a native file picker through `window.api.pickFile()`.
3. The main process opens `dialog.showOpenDialog(...)` and returns a file path or `null`.
4. The renderer submits the attachment payload through IPC.
5. The database layer verifies the node exists and stores `node_id`, `kind`, `local_path`, and `cloud_url`.

**State Management:**
- Persistent state lives in `data/privanote.db`.
- Renderer state is React component state only.
- No global in-memory domain store exists outside the database connection.

## Key Abstractions

**Node:**
- Purpose: Primary content record in the app.
- Examples: `nodes` table rows returned by `listNodes()`, `createNode()`, and `updateNode()`.
- Pattern: Relational record with timestamps and user-editable text fields.

**Attachment:**
- Purpose: File or media item associated with a node.
- Examples: `attachments` table rows, `kind` values of `audio`, `video`, or `file`.
- Pattern: Child record with a foreign key to `nodes.id`.

**IPC Channel:**
- Purpose: Named command boundary between renderer and main process.
- Examples: `nodes:list`, `nodes:create`, `attachments:add`, `files:pick`.
- Pattern: Request/response over `ipcRenderer.invoke` and `ipcMain.handle`.

**Preload API:**
- Purpose: Stable renderer-facing facade over IPC.
- Examples: `window.api.listNodes()`, `window.api.addAttachment()`, `window.api.pickFile()`.
- Pattern: Bridge object exposed with `contextBridge`.

## Entry Points

**Electron Main Entry:**
- Location: `src/main/main.js`
- Triggers: `npm start`, `npm run dev:main`, or packaged Electron launch.
- Responsibilities: Register handlers, create the browser window, choose dev vs packaged loading.

**Renderer Entry:**
- Location: `src/renderer/main.jsx`
- Triggers: The HTML document at `src/renderer/index.html`.
- Responsibilities: Mount the React app into `#root`.

**Build Entry:**
- Location: `vite.config.js`
- Triggers: `npm run build`.
- Responsibilities: Compile the renderer from `src/renderer` into `dist/`.

## Error Handling

**Strategy:** Errors are thrown at the data boundary, propagated through IPC promises, and rendered as UI error text.

**Patterns:**
- Database functions validate input before running SQL and throw descriptive `Error` objects on bad input.
- Main-process handlers return promise rejections back through `ipcRenderer.invoke(...)`.
- The React app catches async failures in each action handler and stores the message in component state.
- There is no centralized error middleware or structured logging layer.

## Cross-Cutting Concerns

**Validation:**
- Input validation happens in `src/main/database.js` before inserts and updates.
- Required fields are enforced manually, such as node title and attachment path.

**Security Boundary:**
- The renderer does not access Node.js APIs directly.
- `src/main/preload.js` exposes only the methods the UI needs.

**Native Integration:**
- File selection uses Electron's `dialog` API in the main process.
- Window lifecycle is controlled through Electron app events in `src/main/main.js`.

**Build and Packaging:**
- Development serves the renderer through Vite.
- Production loads the built renderer from `dist/index.html`.

**Logging:**
- No dedicated logger is present.
- Operational feedback is surfaced through renderer state and native dialogs only.

*Architecture analysis: 2026-03-28*
*Update when major patterns change*
