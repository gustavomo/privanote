---
created: 2026-04-01T05:36:10.455Z
title: Limit floating capture button to specific apps
area: ui
files: []
---

## Problem

The floating capture button (always-on-top overlay) currently appears over all apps indiscriminately. This creates noise and distraction when working in apps where capture isn't needed. The button should only be visible when the user is in apps where they'd actually want to capture context.

## Solution

Detect the currently focused/foreground app using macOS APIs (e.g., `NSWorkspace.activeApplication` via native bindings or accessibility APIs) and only show the floating button when the active app matches a whitelist:

- **Slack** — capture threads, channels, huddle context
- **Gmail** (Chrome/browser) — capture email conversations
- **Notion** — capture pages, databases
- **Jira** (Chrome/browser) — capture tickets, boards
- **GitHub** (Chrome/browser) — capture PRs, issues, code reviews

For browser-based apps (Gmail, Jira, GitHub), detect via URL pattern matching on the active browser tab. Provide a settings UI where users can add/remove apps from the whitelist.
