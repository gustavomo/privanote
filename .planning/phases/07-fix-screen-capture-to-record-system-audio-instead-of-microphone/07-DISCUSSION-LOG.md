# Phase 7: Fix screen capture to record system audio instead of microphone - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 07-fix-screen-capture-to-record-system-audio-instead-of-microphone
**Areas discussed:** Audio source scope, System audio method, Recording trigger, Fallback behavior

---

## Audio Source Scope

### Q1: Should system audio replace microphone capture entirely, or should both be available?

| Option | Description | Selected |
|--------|-------------|----------|
| System audio only | Replace microphone recording with system audio for screen capture sessions | |
| Both sources mixed | Capture system audio + microphone together into one stream | ✓ |
| User chooses per session | Add a toggle in the capture UI: system audio, microphone, or both | |

**User's choice:** Both sources mixed
**Notes:** User wants to capture both system audio and their own voice together

### Q2: Which recording flows should this change apply to?

| Option | Description | Selected |
|--------|-------------|----------|
| External capture only | Only the Phase 6 floating-button screen capture sessions get system audio | |
| Both capture flows | Both the sidebar capture panel and the external screen capture | |
| New capture mode | Add a new "Screen + Audio" capture mode alongside existing modes | |

**User's choice:** Other — "to the functionality to record audio or video inside the panel, not the floating button"
**Notes:** Applies to sidebar capture panel only, not the floating overlay from Phase 6

### Q3: Should the mixed audio apply to all capture modes or only specific ones?

| Option | Description | Selected |
|--------|-------------|----------|
| All modes | Audio-only, Video, and Video+Audio modes all capture system audio mixed with microphone | ✓ |
| Video modes only | Only Video and Video+Audio modes get system audio | |
| New mode only | Add a dedicated "Screen Recording" mode | |

**User's choice:** All modes

### Q4: Should users see any indication that system audio is being captured?

| Option | Description | Selected |
|--------|-------------|----------|
| No extra indicator | Just capture both sources silently — keep the UI as-is | ✓ |
| Small label/badge | Show a subtle indicator near the recording controls | |
| You decide | Let Claude decide the best UX approach | |

**User's choice:** No extra indicator

---

## System Audio Method

### Q1: How should system audio be captured on macOS?

| Option | Description | Selected |
|--------|-------------|----------|
| desktopCapturer + getDisplayMedia | Electron-native approach, no external dependencies, requires macOS 13+ | ✓ |
| Virtual audio driver (BlackHole/Loopback) | Route system audio through a virtual device, requires user to install third-party driver | |
| ScreenCaptureKit native addon | Apple's native API via Node addon, most capable but requires maintaining a native binary | |

**User's choice:** desktopCapturer + getDisplayMedia

### Q2: Are you okay requiring macOS 13+ for system audio capture?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, macOS 13+ is fine | Most users are on recent macOS versions | ✓ |
| Support older macOS too | Need a fallback path for macOS 12 and earlier | |

**User's choice:** Yes, macOS 13+ is fine

---

## Recording Trigger

### Q1: How should system audio recording be triggered?

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic with record | System audio starts automatically when user clicks Record | ✓ |
| Separate toggle | Add a toggle to enable/disable system audio before starting | |
| Auto-detect | Detect if system audio is playing and only capture if active | |

**User's choice:** Automatic with record

### Q2: When should the screen recording permission prompt appear?

| Option | Description | Selected |
|--------|-------------|----------|
| On first record | Prompt on first recording attempt, macOS remembers the grant | ✓ |
| At app launch | Request permission when the app starts | |
| You decide | Let Claude decide timing | |

**User's choice:** On first record

---

## Fallback Behavior

### Q1: What should happen if system audio capture fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Microphone-only fallback | Fall back silently to microphone-only recording | |
| Notify and fallback | Show notification, then proceed with microphone-only | |
| Block recording | Don't allow recording without system audio permission | ✓ |

**User's choice:** Block recording

### Q2: If permission is denied, should the app re-prompt on next attempt?

| Option | Description | Selected |
|--------|-------------|----------|
| No re-prompt | Use microphone-only going forward, user grants via System Settings | |
| Re-prompt once | Try asking one more time on next attempt, then give up | ✓ |
| You decide | Let Claude decide the re-prompting strategy | |

**User's choice:** Re-prompt once

---

## Claude's Discretion

- Audio stream merging strategy (Web Audio API vs MediaStream track combination)
- Error message wording when permission is blocked
- Whether to use `desktopCapturer.getSources` or direct `getDisplayMedia` constraints

## Deferred Ideas

None — discussion stayed within phase scope
