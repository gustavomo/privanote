# Phase 10: Detect Active Media and Show Floating Recording Button - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 10-detect-active-media-microphone-camera-usage-via-system-apis-and-show-a-floating-recording-button-that-integrates-with-the-existing-note-capture-flow
**Areas discussed:** Detection method, Trigger behavior, Overlay integration, Call app awareness

---

## Detection Method

| Option | Description | Selected |
|--------|-------------|----------|
| macOS audio tap polling | Poll CoreAudio via native Node addon or shell command | |
| Process list heuristic | Check running processes for known call apps | |
| macOS mic/camera indicator | Detect the orange/green dot via accessibility or ScreenCaptureKit APIs | ✓ |

**User's choice:** macOS mic/camera indicator
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Both mic and camera | Show when either is active | ✓ |
| Microphone only | Only trigger on mic activity | |

**User's choice:** Both mic and camera

| Option | Description | Selected |
|--------|-------------|----------|
| Every 2-3 seconds | Piggyback on existing polling | ✓ |
| Every 5-10 seconds | Less frequent, lower overhead | |
| You decide | Claude picks | |

**User's choice:** Every 2-3 seconds

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, ignore self | Only trigger for other apps | ✓ |
| No, show always | Include Privanote's own usage | |

**User's choice:** Yes, ignore self

---

## Trigger Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-show recording button | Overlay gains a recording button automatically | ✓ |
| Show notification first | Ask user before showing button | |
| Always visible, highlight on detect | Button always there but grayed out | |

**User's choice:** Auto-show recording button (user's own words: "show floating button to start recording")

| Option | Description | Selected |
|--------|-------------|----------|
| Start immediately | One tap = recording starts | ✓ |
| Show brief confirmation | Confirmation dialog first | |

**User's choice:** Start immediately

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-stop and save | Stop when call ends | |
| Notify and let user stop | Prompt when call ends | |
| Keep recording | Continue until manual stop | ✓ (with notification) |

**User's choice:** Keep recording but notify user that call ended

---

## Overlay Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Third button, shown conditionally | Overlay goes from 2 to 3 buttons during calls | ✓ |
| Replace capture button | Transform existing button during calls | |
| Separate floating indicator | Small dot near overlay | |

**User's choice:** Third button, shown conditionally

| Option | Description | Selected |
|--------|-------------|----------|
| Headphone/call icon | Headphones or phone icon | ✓ |
| Mic with waves icon | Microphone with sound waves | |
| You decide | Claude picks | |

**User's choice:** Headphone/call icon

---

## Call App Awareness

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, show app name | Detect and display which app is on a call | ✓ |
| No, just detect activity | Don't identify specific app | |
| Detect but don't show | Identify internally for metadata only | |

**User's choice:** Yes, show app name

| Option | Description | Selected |
|--------|-------------|----------|
| Same behavior for all | No per-app customization | ✓ |
| Per-app customization | Whitelist-style configuration | |

**User's choice:** Same behavior for all

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-title with app name | "Zoom call — Apr 1, 2:30 PM" | ✓ |
| Same as regular recording | Use existing title pattern | |
| You decide | Claude picks | |

**User's choice:** Auto-title with app name

---

## Claude's Discretion

- Exact API approach for reading macOS mic/camera indicator state
- Animation/transition for third button appear/disappear
- Process identification technique for source app detection
- Notification style when call ends during recording

## Deferred Ideas

None
