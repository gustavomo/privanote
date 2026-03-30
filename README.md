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
- `npm start` launches the desktop workspace.
- `npm run dev --workspace @privanote/desktop` runs the desktop package directly.
- `npm run dev --workspace @privanote/backend` runs the backend package directly.
- `npm run test --workspace @privanote/desktop` runs desktop checks.
- `npm run test --workspace @privanote/backend` runs backend checks.

## Workspace notes

- `apps/desktop` owns Electron, preload, renderer, and local UI design-system files.
- `apps/backend` owns versioned contracts and the local backend runtime foundation.
- Cross-package sharing is limited to backend-owned contracts. Business logic stays out of shared packages.
