# Phase 8: Limit floating capture button to specific apps — Discussion Log

**Date:** 2026-04-01
**Phase:** 08-limit-floating-capture-button-to-specific-apps

## Gray Areas Discussed

### 1. Whitelist Scope
**Question:** Should the whitelist start with all 5 preset apps enabled, or empty?
**Discussion:** User wants whitelist empty by default. The 5 preset apps (Slack, Gmail, Notion, Jira, GitHub) are the only options — no custom app addition in this phase. User confirmed custom app support is deferred to a future phase.
**Decision:** D-01 (empty by default), D-02 (5 presets only), D-03 (no custom addition)

### 2. Browser App Detection
**Question:** How to detect browser-based apps (Gmail, Notion, Jira, GitHub) when the active window is Chrome/Safari?
**Discussion:** User chose dual approach — AX tree URL extraction as primary method (walk accessibility tree for URL bar value), with window title parsing as fallback. Both Chrome and Safari supported as browser hosts.
**Decision:** D-04 (AX tree URL extraction primary), D-05 (window title fallback), D-06 (Chrome + Safari)

### 3. Show/Hide Behavior
**Question:** Should overlay fade in/out or instantly appear/disappear on app switch?
**Discussion:** User chose instant hide/show with no fade or delay. Polling reuses active-win from Phase 6.
**Decision:** D-07 (instant hide/show), D-08 (polling with active-win)

### 4. Settings Surface
**Question:** Where should the whitelist management UI live?
**Discussion:** User chose settings view only — add a "Capture Apps" section in the existing Settings view with toggle switches for each preset app. No right-click menu or tray menu.
**Decision:** D-09 (settings view), D-10 (toggle switches), D-11 (no menu management)

## Claude's Discretion Items
- Polling interval for active app check
- Overlay behavior during active capture session
- URL patterns for browser app matching
- When to check app (overlay visibility vs capture session start)

## Session Notes
- All 4 gray areas discussed and resolved in single session
- User engaged with each area and made clear choices
- No scope creep — custom app addition explicitly deferred
