---
created: 2026-04-01T05:36:10.455Z
title: Toggle button for clipboard text capture
area: ui
files: []
---

## Problem

Users frequently copy text from external apps (Slack messages, email snippets, code from GitHub, Jira ticket descriptions) that would be valuable to capture in Privanote. Currently there's no way to passively collect clipboard text as context without manually pasting it into the app.

## Solution

Add a toggle button in the Privanote app (tray menu or main UI) that enables/disables clipboard monitoring:

- **On:** Monitor the system clipboard for text changes. When the user copies text (Cmd+C), automatically capture it with metadata (timestamp, source app if detectable, text content).
- **Off:** No clipboard monitoring — normal behavior.

Captured clipboard entries are buffered and grouped into a note/session when the user ends the capture or after a configurable idle timeout. Each entry should show the source app and timestamp. This pairs with the floating capture button — the button captures screenshots/audio, while this captures copied text for a richer context picture.
