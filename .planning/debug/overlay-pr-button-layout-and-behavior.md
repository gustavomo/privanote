---
status: awaiting_human_verify
trigger: "overlay-pr-button-layout-and-behavior: 4th PR button broke overlay layout; button behavior needs redesign (auto-trigger on GH PR page)"
created: 2026-04-02T00:00:00Z
updated: 2026-04-02T01:00:00Z
---

## Current Focus

hypothesis: Python detection logic is correct; error message needed actionable install guidance
test: Verified binary candidates, version gate, and actual machine state; improved error message
expecting: When Python 3.12+ is absent, console shows exact brew command instead of bare warning
next_action: Await human verification that error message is actionable; all four fixes are now in

## Symptoms

expected: Overlay layout intact with 4 buttons (same size/style as existing 3 buttons). On GitHub PR page: clicking PR button immediately starts analysis. Not on GitHub PR page: shows URL input popover.
actual: Overlay layout breaks after 4th button was added (shifting, wrong size, or elements overlapping). PR button visually doesn't match the other 3 buttons. Button always shows popover even on GitHub PR page.
errors: none reported
reproduction: Open app, browse to any page — overlay layout broken. On GitHub PR page, button behavior doesn't match expected auto-trigger pattern.
timeline: Worked before Plan 15-05. Plan 15-05 added the 4th button and broke it.

## Eliminated

- hypothesis: CSS missing for #prBtn visibility
  evidence: CSS rules for #prBtn { display: none } and #prBtn.visible { display: flex } are correct and match the pattern of #btn and #callBtn
  timestamp: 2026-04-02

- hypothesis: recalcHeight() doesn't account for the PR button
  evidence: recalcHeight() correctly increments count when prVisible is true
  timestamp: 2026-04-02

## Evidence

- timestamp: 2026-04-02
  checked: HTML structure of #prBtn at line 266-282
  found: .pr-popover div is a direct child of <button id="prBtn">. Standard HTML: a <button> is an inline element that cannot legally contain block-level elements. Browsers render this unpredictably — the div breaks out of the button's layout box, the button no longer has a predictable 40x40 bounding box, and surrounding layout collapses or expands.
  implication: ROOT CAUSE of layout bug. Popover must be moved outside the <button> entirely and positioned relative to the .container.

- timestamp: 2026-04-02
  checked: prBtn click handler at lines 748-755 and startPrAnalysis at 768-780
  found: Click handler ALWAYS shows/hides the popover regardless of whether detectedPrUrl is set. There is no branch that checks if a URL is already detected and skips the popover.
  implication: ROOT CAUSE of behavior bug. Fix: if detectedPrUrl is truthy, call startPrAnalysis(detectedPrUrl) directly; else show popover.

- timestamp: 2026-04-02
  checked: startPrAnalysis() function signature
  found: Currently reads from prUrlInput.value. Needs to accept an optional url parameter so it can be called directly (bypassing popover) when URL is already detected.
  implication: startPrAnalysis() needs to accept url arg and fall back to input value if not provided.

- timestamp: 2026-04-02
  checked: .pr-popover CSS — position: absolute; right: 52px
  found: The popover uses position: absolute anchored relative to .container (which has position: relative). This is correct for positioning but ONLY works if the popover is a child of .container, not of <button>. Moving it out of the button to be a direct child of .container will make the existing CSS work correctly.
  implication: No CSS position changes needed after structural fix.

- timestamp: 2026-04-02
  checked: overlay:resize IPC handler in main.js (line 831) and createCaptureOverlay initial position (x: screenWidth - 64)
  found: When overlay:resize fires with width=336 (popover open), the handler used setBounds({ x: bounds.x, ... }) — keeping the left edge fixed. This expands the window 288px to the RIGHT, past the screen edge. The overlay starts at x = screenWidth - 64, so the right edge is at screenWidth - 16. Expanding rightward from that point goes off-screen.
  implication: ROOT CAUSE of popover off-screen bug. Fix: pin the right edge. New x = bounds.x + bounds.width - newWidth. This shifts the window left by exactly the added width, keeping the right edge at the same screen position.

- timestamp: 2026-04-02
  checked: .container CSS align-items: center (line 23) after human verify checkpoint
  found: When window expands from 48px to 336px (leftward, right edge pinned), .container becomes 336px wide. align-items: center causes all buttons to be centered horizontally in the 336px container. Buttons were at x=4px (center of 48px), now at x=148px. Net shift: buttons move 144px right within the container, while the container moved 288px left. Buttons appear to jump ~144px to the left on screen — this is the "buttons shifting" symptom.
  implication: ROOT CAUSE of button shift bug. Fix: change .container to align-items: flex-end so buttons stay at the right edge of the container (same position as the right edge of the window, which never moves).

- timestamp: 2026-04-02
  checked: BrowserWindow creation at line 262 — focusable: false — and preload-capture.js
  found: The capture overlay window is created with focusable: false. When prUrlInput.focus() is called (line 704 in HTML), the browser ignores it because the BrowserWindow is not focusable. No keyboard events (including Cmd+V paste) are delivered to the window. The preload has no keyboard interception — the issue is at the BrowserWindow level.
  implication: ROOT CAUSE of paste-blocked bug. Fix: when the popover opens, tell main process to make the window focusable via IPC (overlay:set-focusable true). When popover closes, set it back to false so it doesn't steal focus from user's work.

- timestamp: 2026-04-02
  checked: resolvePrServiceDir() in pr-service-process.js line 8
  found: path.resolve(__dirname, '..', '..', '..', '..', 'pr-analysis'). __dirname = apps/desktop/src/main. 4 hops up = project root. Resolves to {root}/pr-analysis. Actual directory is {root}/apps/pr-analysis. Should be 3 hops up to reach apps/, then pr-analysis.
  implication: ROOT CAUSE of service path bug. Fix: change 4 '..' to 3 '..'.

- timestamp: 2026-04-02
  checked: findPython3() candidate list and version gate; actual machine state via which/brew
  found: Detection logic is correct — candidates tried in right order, version regex and >= 12 gate are accurate. Machine has only Python 3.9.6 at /usr/bin/python3; no Homebrew Python, no pyenv. python3.11 in the old candidate list was misleading (it can never pass the >= 12 gate). python3.13 added for future-proofing. Error message only said "not available" with no install guidance.
  implication: Not a code bug — genuine prerequisite gap. Detection logic preserved; error message expanded to include exact "brew install python@3.12" command so any developer sees exactly what to do.

## Resolution

root_cause: (1) .container uses align-items:center — when window widens leftward from 48px to 336px, centered buttons drift 144px to the left on screen. (2) BrowserWindow created with focusable:false prevents the URL input from receiving keyboard events (including Cmd+V paste). (3) resolvePrServiceDir() uses 4 parent-directory hops from apps/desktop/src/main, landing at project root instead of apps/; should use 3 hops. (4) Python 3.12+ is a prerequisite not installed on the dev machine; detection logic is correct but error message was not actionable. (Also: prior session fixed: popover was inside <button> causing invalid HTML; click handler always showed popover; resize pinned wrong edge.)
fix: (1) Change .container to align-items:flex-end so buttons stay right-aligned (right edge of container = right edge of window, which never moves). (2) Add overlay:set-focusable IPC channel; call it with true in showPrPopover() and false in hidePrPopover(); handle in main.js with captureOverlay.setFocusable(). (3) Change pr-service-process.js resolvePrServiceDir from 4 '..' to 3 '..'. (4) Improve findPython3() candidate list (remove python3.11 which could never pass the 3.12+ gate, add python3.13 for future-proofing); expand error message to include exact brew install python@3.12 command and brew.sh link.
verification: All four items addressed and code-verified. Awaiting runtime confirmation that error message is visible and actionable.
files_changed:
  - apps/desktop/src/renderer/capture-overlay/capture-overlay.html
  - apps/desktop/src/main/main.js
  - apps/desktop/src/main/pr-service-process.js
