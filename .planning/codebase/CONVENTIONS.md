# Coding Conventions

**Analysis Date:** 2026-03-28

## Naming Patterns

**Files:**
- Main-process files use lowercase names in `src/main/` such as `src/main/main.js`, `src/main/database.js`, and `src/main/preload.js`.
- Renderer files use React-oriented names in `src/renderer/` such as `src/renderer/App.jsx` and `src/renderer/main.jsx`.
- The HTML entry point is `src/renderer/index.html`, and the Vite config is `vite.config.js`.
- There is no test file naming pattern in the repo because there are no committed tests.

**Functions:**
- Functions use `camelCase` throughout, including IPC registration helpers like `registerIpcHandlers()` and DB helpers like `sanitizeNodePayload()`.
- Event handlers and UI actions in `src/renderer/App.jsx` follow `handle*` naming, for example `handleCreateNode()` and `handleDeleteAttachment()`.
- Async functions do not use a special prefix; they are named by behavior only.

**Variables:**
- Variables use `camelCase` consistently, including React state variables such as `selectedNodeId` and `attachmentPath`.
- Constants are `const` bindings, but not written in `UPPER_SNAKE_CASE` unless they are module-level lookup data like `attachmentKinds`.
- Private/internal helpers are not prefixed with `_`.

**Types:**
- The codebase is JavaScript-first, so there are no TypeScript interfaces, aliases, or enums in the current repo state.

## Code Style

**Formatting:**
- The code follows a Prettier-like style even though there is no config file in the repo.
- Single quotes are used in the inspected source files.
- Semicolons are used.
- Indentation is 2 spaces.

**Linting:**
- There is no ESLint config in the repository root or under `src/`.
- There is no committed `npm run lint` script in `package.json`.
- Style is enforced by convention rather than a tool in this repo snapshot.

## Import Organization

**Order:**
1. Built-in Node/Electron modules first, as seen in `src/main/main.js` and `src/main/database.js`.
2. Third-party packages next, such as `react` and `react-dom` in `src/renderer/App.jsx` and `src/renderer/main.jsx`.
3. Relative imports follow, such as `require('./database')` in `src/main/main.js` and `import App from './App.jsx'` in `src/renderer/main.jsx`.

**Grouping:**
- Imports are grouped with blank lines where helpful, but the repo does not show a strict multi-group import sorting convention.
- There are no type-only imports because the project does not use TypeScript.

**Path Aliases:**
- No path aliases are defined in `vite.config.js` or elsewhere in the repo.
- All imports are relative or package-based.

## Error Handling

**Patterns:**
- The main-process database layer throws plain `Error` instances for validation failures in `src/main/database.js`.
- Input is sanitized before writes, for example `sanitizeNodePayload()` trims strings and rejects empty titles.
- The renderer catches async failures around IPC calls and stores the message in local React state.

**Error Types:**
- Validation failures are thrown for invalid IDs, missing titles, and unsupported attachment kinds in `src/main/database.js`.
- Expected missing-record conditions also throw plain errors, such as `Node not found`.
- There is no custom error class hierarchy in the current codebase.

## Logging

**Framework:**
- There is no logging framework configured in the repo.
- The inspected files do not use `pino`, `winston`, or a shared logger module.

**Patterns:**
- Operational state is surfaced through the UI rather than structured logs.
- The main process does not emit application logs in the inspected code.
- `console.log` is not part of the observed conventions, but there is also no lint rule enforcing that.

## Comments

**When to Comment:**
- Comments are minimal in the current codebase.
- The repo relies on readable function names and straightforward control flow instead of explanatory comments.
- There is no strong comment-style pattern established in the inspected files.

**JSDoc/TSDoc:**
- JSDoc/TSDoc is not used in the current repo state.
- There are no documented public APIs or annotated function contracts in the inspected source files.

**TODO Comments:**
- No established `TODO(username): ...` pattern was found.
- No tracked TODO comment convention is visible in the current files.

## Function Design

**Size:**
- Functions are generally small and single-purpose, especially in `src/main/database.js` and `src/main/preload.js`.
- The renderer component in `src/renderer/App.jsx` is larger, but it is still organized into focused handlers and helper functions.

**Parameters:**
- Functions typically take one payload object or a single ID argument.
- IPC payloads are passed as objects for create/update flows, such as `createNode(payload)` and `addAttachment(payload)`.

**Return Values:**
- Functions return concrete data or booleans, not Result wrappers.
- Database helpers return rows from SQLite queries when possible.
- Early returns are used for guard cases, especially in the renderer.

## Module Design

**Exports:**
- CommonJS exports are used in the Electron main side, for example `module.exports` in `src/main/database.js`.
- ES module syntax is used in the renderer, for example `export default function App()` in `src/renderer/App.jsx`.
- Default exports are used for the React component, while utility helpers remain local to the module.

**Barrel Files:**
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

*Convention analysis: 2026-03-28*
*Update when patterns change*
