# Technology Stack

**Analysis Date:** 2026-03-28

## Languages

**Primary:**
- JavaScript - application code in `src/main/main.js`, `src/main/database.js`, `src/main/preload.js`, `src/renderer/main.jsx`, and `src/renderer/App.jsx`.
- JSX - React UI components in `src/renderer/App.jsx` and `src/renderer/main.jsx`.

**Secondary:**
- HTML - renderer shell in `src/renderer/index.html`.
- JSON - package metadata in `package.json` and dependency lock data in `package-lock.json`.

## Runtime

**Environment:**
- Electron 28.x desktop runtime drives the app process model.
- Node.js is required through Electron and the npm scripts, but no explicit Node engine version is declared in `package.json`.
- The app runs as a local desktop client, not as a browser-hosted web app.

**Package Manager:**
- npm is used for installs and scripts.
- Lockfile: `package-lock.json` is present.

## Frameworks

**Core:**
- Electron 28.x - desktop shell, main process, BrowserWindow, IPC, and native dialog access from `src/main/main.js`.
- React 18.2.x - renderer UI in `src/renderer/App.jsx`.

**Testing:**
- None currently. `package.json` defines `npm test` as a placeholder that prints `No tests`.

**Build/Dev:**
- Vite 4.4.x - renderer development server and production bundling via `vite.config.js`.
- `@vitejs/plugin-react` 4.x - JSX/React transform for the Vite renderer build.
- `concurrently` 8.2.x - runs Electron and Vite together during development.

## Key Dependencies

**Critical:**
- `electron` - desktop runtime and native app container.
- `react` / `react-dom` - renderer view layer and DOM mounting.
- `better-sqlite3` - local persistence layer used by `src/main/database.js`.

**Infrastructure:**
- `vite` - renderer build pipeline with `root: 'src/renderer'` and `outDir: '../../dist'` in `vite.config.js`.
- `@vitejs/plugin-react` - JSX compilation for the renderer.
- `concurrently` - development orchestration for `npm run dev`.

## Configuration

**Environment:**
- No required environment variables are documented.
- `src/main/main.js` reads `VITE_DEV_SERVER_URL` in development and falls back to `http://localhost:5173`.
- Runtime data is stored under `data/`, which is gitignored in `.gitignore`.

**Build:**
- `vite.config.js` controls renderer bundling.
- `src/main/main.js` is the Electron entry point from `package.json`.
- `src/renderer/main.jsx` is the renderer bootstrap and `src/renderer/index.html` is the HTML entry.

## Platform Requirements

**Development:**
- Any desktop platform supported by Electron and Node.js.
- Local filesystem access is required because the app writes a SQLite file under `data/`.

**Production:**
- Electron packaged desktop app.
- Renderer production assets are emitted to `dist/` and loaded from `dist/index.html` in packaged mode.

## Not Present

- TypeScript is not used.
- No server framework is present.
- No test runner is configured.
- No mobile, browser-only, or web backend runtime is present.

*Stack analysis: 2026-03-28*
*Update after major dependency changes*
