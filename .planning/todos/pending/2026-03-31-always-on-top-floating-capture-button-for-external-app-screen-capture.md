---
created: 2026-03-31T18:40:13.773Z
title: Always-on-top floating capture button for external app screen capture
area: ui
files: []
---

## Problem

Privanote only captures media that the user explicitly records within the app. There is no way to capture context from external apps (Slack threads, Gmail conversations, Notion pages, GitHub PRs) without manually copying content or switching apps. This creates friction and means valuable context never enters the knowledge base.

Screenpipe solves this with continuous passive capture but introduces noise (captures everything). Privanote needs an intentional, user-triggered alternative.

## Solution

Build an always-on-top floating button (Electron `BrowserWindow` with `alwaysOnTop: true`, `frame: false`, `transparent: true`) that lives over all other apps. When clicked:

1. Starts a capture session — takes periodic screenshots of the active window using Electron's `desktopCapturer` API
2. Detects which app is in focus (Slack, Gmail, Notion, Chrome, etc.) and tags the session accordingly
3. Extracts text via macOS Accessibility API first (clean structured text), falls back to OCR (Tesseract.js or Apple Vision) for apps that don't expose accessibility tree
4. Optionally captures system audio + microphone if a call is detected (audio from system speakers indicates a Huddle, Meet, Zoom, etc.)
5. On session end (second click or keyboard shortcut): transcribes audio if any, groups content by app, creates a structured note with timestamp and source app

**Key differentiator vs Screenpipe:** opt-in per session (no noise), intentional metadata (user chose to capture this), clean signal for downstream AI context.

**Technical references from conversation:**
- Electron `desktopCapturer` API — screenshots of any screen/window
- Electron `BrowserWindow` `alwaysOnTop` option — OS-level overlay
- macOS Accessibility API via `node-accessibility` or native binding — structured text extraction
- Tesseract.js — OCR fallback
- Cluely (app) — prior art for floating overlay capture
- Screenpipe (open source) — prior art for accessibility tree capture approach
