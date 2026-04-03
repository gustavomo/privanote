---
status: awaiting_human_verify
trigger: "overlay-pr-button-breaks-layout"
created: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:00:00Z
---

## Current Focus

hypothesis: Multiple layout/style/behavior issues with the PR button addition
test: Reading code and comparing PR button implementation to existing buttons
expecting: Identifying specific CSS/HTML/JS differences causing issues
next_action: Analyze and fix all identified issues

## Symptoms

expected: Overlay works with 3 buttons + 4th PR button matching style. PR button auto-triggers on PR pages, shows popover on non-PR pages.
actual: Layout breaks with 4th button. PR button style doesn't match others. Always shows popover instead of auto-triggering.
errors: No console errors - layout/visual/behavioral issue.
reproduction: Start app with PRIVANOTE_PR_ANALYSIS=true, observe overlay layout, click PR button on PR page.
started: After Plan 15-05 added 4th button.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-04-02T00:01:00Z
  checked: capture-overlay.html CSS and HTML structure
  found: |
    ISSUE 1 - LAYOUT: body has hardcoded `height: 72px` (line 16) which only fits ~1.5 buttons.
    The recalcHeight() JS function dynamically adjusts height, but CSS initial height is too small.
    
    ISSUE 2 - STYLE: PR button idle icon includes a diagonal strikethrough line 
    `<line x1="2" y1="2" x2="22" y2="22"/>` in its SVG (line 272, line 644).
    The other buttons only show strikethrough in their IDLE state but the PR button's 
    "idle" icon represents a git-merge with a strikethrough which is inconsistent.
    More importantly, the PR button icon is a custom git-merge icon while other buttons
    use standard lucide-style icons. The icon DOES have stroke styling from .btn svg rules.
    Actually checking more carefully - the screen capture idle icon ALSO has a strikethrough line.
    The call button idle also has a strikethrough. So the pattern is consistent.
    The button itself uses the same .btn class so sizing/shape should match.
    
    ISSUE 3 - POPOVER INSIDE BUTTON: The pr-popover div is INSIDE the prBtn button element
    (lines 274-281). This is semantically wrong and may cause click handling issues. 
    The popover click handler does stopPropagation (line 747) but being nested inside button
    could cause layout issues since the popover is position:absolute with right:56px and width:280px.
    
    ISSUE 4 - BEHAVIOR: prBtn click handler (lines 749-756) always toggles popover.
    It never checks detectedPrUrl to auto-trigger. When on a PR page, detectedPrUrl is set
    but clicking still shows the popover instead of immediately calling startPrAnalysis().
    
    ISSUE 5 - PR BUTTON VISIBILITY: The PR button uses the same show/hide pattern as other
    conditional buttons (#prBtn display:none, #prBtn.visible display:flex). But it's only 
    shown when onPrUrlDetected fires. There's no "always show when feature enabled" path.
    Actually that may be intentional - only show on PR pages. But the requirement says
    when NOT on a PR page, clicking should show URL input. So the button needs to always
    be visible when the feature is enabled.
  implication: Need to fix layout, behavior, visibility, and popover placement

## Resolution

root_cause: |
  Multiple issues in capture-overlay.html:
  1. body CSS hardcodes height:72px - too small for 4 buttons, causes initial layout break before JS recalcHeight runs
  2. PR popover div nested inside button element - semantically wrong, causes layout/click issues
  3. PR button click handler always toggles popover, never checks detectedPrUrl to auto-trigger on PR pages
  4. PR button only shown when onPrUrlDetected fires, but should always be visible when feature is enabled
  5. PR idle icon had a strikethrough line unlike pattern (other idle states use strikethrough for "off" but PR should show ready state)
fix: |
  1. Changed body height from 72px to auto - lets content size naturally, recalcHeight() still manages via JS
  2. Moved pr-popover out of button to be a sibling in the container div
  3. Updated prBtn click handler: if detectedPrUrl exists and is valid, immediately call startPrAnalysis(); otherwise show popover
  4. Changed init logic: showPrButton() called immediately when feature is enabled; onPrUrlDetected/Cleared only update detectedPrUrl variable
  5. Removed strikethrough line from PR idle icon SVG (both HTML and JS constant)
  6. Added -webkit-app-region:no-drag to popover CSS and updated outside-click handler to also check prPopover.contains()
verification: Manual visual inspection needed - start app with PRIVANOTE_PR_ANALYSIS=true
files_changed:
  - apps/desktop/src/renderer/capture-overlay/capture-overlay.html
