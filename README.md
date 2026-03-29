# Privanote

Privanote is an Electron + React desktop application for managing local content nodes with SQLite persistence.

## Current status

This iteration now includes:
- Local SQLite schema for nodes and attachments.
- Main-process IPC handlers for node CRUD and attachment CRUD.
- Secure preload API surface for renderer access.
- React UI for:
  - creating, selecting, editing, and deleting nodes
  - adding/removing attachments per node
  - opening a native file picker to populate attachment paths

## Scripts

- `npm run dev` starts Vite + Electron for local development.
- `npm run build` builds the renderer to `dist/`.
- `npm start` launches Electron.

## Next implementation milestones

1. Google Drive / OneDrive connector adapters for cloud-backed attachments.
2. Attachment preview and media playback inside the app.
3. Configurable storage directories and provider credentials in Settings.
