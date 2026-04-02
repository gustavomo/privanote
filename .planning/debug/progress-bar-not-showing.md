---
status: investigating
trigger: "Investigate why the indeterminate progress bar is not showing during active recording in Privanote"
created: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:00Z
---

## Current Focus

hypothesis: Two bugs in progress.jsx prevent the indeterminate animation from working — inline transform style + flex-1 width override
test: Trace the computed styles through CSS cascade and flex layout algorithm
expecting: The inline transform locks the indicator at translateX(-100%) and flex-1 overrides the width:40% rule
next_action: Report root cause

## Symptoms

expected: An indeterminate progress bar (animated sliding bar) should appear when captureState === 'recording'
actual: The progress bar does not appear at all during recording
errors: None reported (visual bug, no console errors expected)
reproduction: Start a recording in Privanote — the progress bar should appear but doesn't
started: Phase 14 — first implementation of the shadcn Progress + indeterminate animation

## Eliminated

- hypothesis: The conditional rendering is wrong (isRecording is never true)
  evidence: captureState is set to 'recording' at App.jsx line 1016 after recorder.start(). isRecording = captureState === 'recording' (line 1176). The ternary at line 1220 renders the recorder card (not review card) when recording. The Progress component at line 1274 IS rendered.
  timestamp: 2026-04-01T00:01:00Z

- hypothesis: The CSS animation rule is missing from the build output
  evidence: Built CSS at dist/assets/index-c78be179.css contains both `.progress-indeterminate [data-slot=progress-indicator]{width:40%;animation:indeterminate 1.5s ease-in-out infinite}` and `@keyframes indeterminate{0%{transform:translate(-100%)}to{transform:translate(250%)}}`
  timestamp: 2026-04-01T00:05:00Z

- hypothesis: The CSS selector doesn't match the indicator element
  evidence: Root gets class `progress-indeterminate` via className prop merged with cn(). Indicator has `data-slot="progress-indicator"` (progress.jsx line 20). CSS selector `.progress-indeterminate [data-slot="progress-indicator"]` matches correctly.
  timestamp: 2026-04-01T00:06:00Z

- hypothesis: oklch() colors not supported in Electron 28
  evidence: Electron 28 uses Chromium 120. oklch() is supported since Chrome 111.
  timestamp: 2026-04-01T00:07:00Z

- hypothesis: Content Security Policy blocks inline styles or animations
  evidence: No CSP meta tags or headers found in the codebase.
  timestamp: 2026-04-01T00:07:30Z

- hypothesis: Tailwind purge removes the custom CSS rule
  evidence: Custom CSS outside @tailwind directives is not subject to purge. Confirmed present in build output.
  timestamp: 2026-04-01T00:08:00Z

## Evidence

- timestamp: 2026-04-01T00:01:00Z
  checked: App.jsx line 1274 — conditional rendering of Progress
  found: `{isRecording && <Progress className="progress-indeterminate h-1" />}` — condition is correct. No value prop is passed.
  implication: The component IS rendered when recording. No value prop means the indicator defaults to hidden position.

- timestamp: 2026-04-01T00:02:00Z
  checked: progress.jsx lines 19-22 — the Indicator implementation
  found: Indicator has className `"size-full flex-1 bg-primary transition-all"` and inline style `{{ transform: translateX(-${100 - (value || 0)}%) }}`. With value=undefined, this produces `transform: translateX(-100%)`.
  implication: The inline style pushes the indicator 100% off-screen to the left.

- timestamp: 2026-04-01T00:03:00Z
  checked: Radix Progress source (node_modules/@radix-ui/react-progress/dist/index.mjs)
  found: The Radix ProgressIndicator component does NOT set any inline styles itself. Our wrapper in progress.jsx adds the inline transform. When no value is passed, Radix defaults to null internally (line 16: `value: valueProp = null`), but the value prop is destructured out by our wrapper and never forwarded to Radix Root.
  implication: The inline transform is solely from our wrapper component, not from Radix.

- timestamp: 2026-04-01T00:04:00Z
  checked: CSS animation vs inline style interaction
  found: Per CSS spec, @keyframes animations occupy the "animation origin" which CAN override inline styles. However, the indicator also has `transition-all` (transition: all 150ms). When animation and transition target the same property (transform), the animation should win per spec. BUT: the inline style sets the initial transform, the transition monitors all property changes, and the animation tries to override — this triple interaction on the transform property creates a compositor race condition, especially on first render.
  implication: The animation MAY work in theory but the interaction with transition-all + inline style creates unreliable behavior.

- timestamp: 2026-04-01T00:05:00Z
  checked: flex-1 vs width:40% interaction on the indicator
  found: The indicator has `flex-1` (flex: 1 1 0%) from Tailwind. The CSS rule sets `width: 40%`. In the flex algorithm, `flex-basis: 0%` (explicit, from flex shorthand) is used instead of `width`. With `flex-grow: 1` and a single child, the indicator grows to fill 100% of the parent, regardless of `width: 40%`.
  implication: The indeterminate animation was designed for a 40% wide segment, but the indicator is actually 100% wide, making the visual effect entirely wrong.

- timestamp: 2026-04-01T00:06:00Z
  checked: Built CSS output (dist/assets/index-c78be179.css)
  found: Both the animation keyframes and the progress-indeterminate rule are present. The indeterminate class rule has specificity (0,2,0) which beats size-full (0,1,0) for width. But flex-1 (0,1,0) sets flex-basis which is independent of width in the flex algorithm.
  implication: The CSS is correctly built and included. The issue is in the component's class composition, not in CSS processing.

## Resolution

root_cause: Two bugs in `apps/desktop/src/renderer/components/ui/progress.jsx` prevent the indeterminate animation from working:

**Bug 1 (Primary) — Inline transform blocks animation:** The Indicator element (line 22) has an inline style `transform: translateX(-100%)` when no `value` prop is passed. This positions the indicator completely off-screen. While CSS animations can theoretically override inline styles, the same element also has `transition-all` (line 21), which creates a conflict: the transition monitors all property changes including transform, the animation tries to take over transform, and the inline style sets the initial transform — this triple interaction causes the indicator to remain stuck at translateX(-100%) (invisible) rather than animating.

**Bug 2 (Secondary) — flex-1 overrides width:40%:** The Indicator has class `flex-1` (line 21), which sets `flex: 1 1 0%`. The CSS rule `.progress-indeterminate [data-slot="progress-indicator"]` sets `width: 40%` for the sliding segment effect. But in the flex algorithm, `flex-basis: 0%` takes precedence over `width`, and `flex-grow: 1` makes the indicator fill 100% of the parent. So even if the animation worked, the visual would be a 100% wide bar sliding, not a 40% segment — completely wrong.

fix: Modify progress.jsx to (1) not set the inline transform style when value is null/undefined (indeterminate mode), and (2) remove `flex-1` from the indicator className so the CSS width:40% rule takes effect. Alternatively, conditionally remove `flex-1` and `size-full` when indeterminate.
verification: (not yet verified)
files_changed: []
