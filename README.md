# Privanote

Privanote is a local-first monorepo with separate desktop and backend workspaces.

## Current status

Phase 1 is rebuilding the original Electron prototype into:
- `apps/desktop` for the Electron shell and React workspace UI
- `apps/backend` for the backend-owned contracts and upcoming local service runtime
- root workspace scripts that orchestrate both packages without hiding their boundaries

## Scripts

- `npm run dev` runs the desktop workspace from the repo root.
- `npm run build` orchestrates backend then desktop builds.
- `npm run dist --workspace @privanote/desktop` builds a packaged desktop directory with the local backend included.
- `npm run rebuild:native` rebuilds `better-sqlite3` for the current local Node version after a Node upgrade or ABI mismatch.
- `npm start` launches the desktop workspace.
- `npm run dev --workspace @privanote/desktop` runs the desktop package directly.
- `npm run dev --workspace @privanote/backend` runs the backend package directly.
- `npm run test --workspace @privanote/backend` runs backend regression checks.
- `npm run test --workspace @privanote/desktop` runs desktop regression checks.
- `node apps/desktop/scripts/smoke/startup.mjs` verifies the dev desktop shell starts the backend without auth.
- `node apps/desktop/scripts/smoke/package-launch.mjs` verifies the packaged desktop shell starts the bundled backend without auth.

## Phase 1 workflow

Phase 1 stays single-user and `no auth`. The desktop app starts a local backend on `127.0.0.1`, stores data under an app-owned directory, and does not require accounts, credentials, or sign-in flows.

Typical verification flow:

1. `npm install`
2. `npm run test --workspace @privanote/backend`
3. `npm run test --workspace @privanote/desktop`
4. `npm run dist --workspace @privanote/desktop`
5. `node apps/desktop/scripts/smoke/startup.mjs`
6. `node apps/desktop/scripts/smoke/package-launch.mjs`

## Workspace notes

- `apps/desktop` owns Electron, preload, renderer, and local UI design-system files.
- `apps/backend` owns versioned contracts and the local backend runtime foundation.
- Cross-package sharing is limited to backend-owned contracts. Business logic stays out of shared packages.
