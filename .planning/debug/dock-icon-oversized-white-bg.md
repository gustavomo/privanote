---
status: investigating
trigger: "Investigate why the custom macOS dock icon for Privanote appears oversized with a white background"
created: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:00Z
---

## Current Focus

hypothesis: Two root causes - (1) qlmanage renders SVG with white background instead of preserving transparency, (2) icon art fills 100% of canvas instead of ~80% as macOS expects
test: Visual inspection of icon.png and SVG source analysis
expecting: White background visible in PNG, no transparency; rounded rect fills full 1024x1024
next_action: Document root cause findings

## Symptoms

expected: Dock icon should match other macOS dock icons in size/proportion and have no visible background
actual: Icon appears noticeably larger than adjacent dock icons, has visible white/light background square behind the charcoal rounded-square shape
errors: N/A (visual defect, not runtime error)
reproduction: Launch app, observe dock icon
started: After Phase 14 icon generation

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-04-01T00:01:00Z
  checked: apps/desktop/resources/icon.png (visual inspection)
  found: The PNG shows a dark charcoal rounded-square with white "P" lettermark. The rounded-square shape fills the ENTIRE 1024x1024 canvas edge-to-edge. The corners outside the rounded rect appear to be white/opaque, NOT transparent.
  implication: qlmanage rendered the SVG onto a white background, destroying transparency.

- timestamp: 2026-04-01T00:02:00Z
  checked: apps/desktop/scripts/generate-icon.mjs lines 17-20 (SVG source)
  found: SVG defines viewBox="0 0 1024 1024" with rect width="1024" height="1024" rx="228". The rounded rect fills the entire canvas. There is NO explicit transparent background declaration. The SVG itself has no background element, which means the area outside the rounded rect SHOULD be transparent in a proper SVG renderer. However, qlmanage (line 29) converts it and adds a white background.
  implication: Two problems - (a) qlmanage doesn't preserve SVG transparency, (b) icon art fills 100% of canvas.

- timestamp: 2026-04-01T00:03:00Z
  checked: apps/desktop/scripts/generate-icon.mjs line 29
  found: Uses `qlmanage -t -s 1024` for SVG-to-PNG conversion. qlmanage is macOS QuickLook thumbnail generator - it renders previews, NOT production-quality image conversions. qlmanage always composites onto an opaque white background because it's designed for Finder thumbnails, not icon generation.
  implication: This is the direct cause of the white background. qlmanage is the wrong tool for this job.

- timestamp: 2026-04-01T00:04:00Z
  checked: apps/desktop/src/main/main.js lines 956, 967-973
  found: BrowserWindow uses `icon: path.join(__dirname, '..', '..', 'resources', 'icon.png')` at line 956. Then at lines 969-973, `app.dock.setIcon(nativeImage.createFromPath(iconPath))` loads the same icon.png. The code itself is correct - the problem is the image file it loads has a white background and wrong proportions.
  implication: main.js is not the problem. The image asset itself is defective.

- timestamp: 2026-04-01T00:05:00Z
  checked: macOS icon sizing conventions
  found: macOS Human Interface Guidelines specify that app icons should have their artwork occupy roughly 80% of the icon canvas, with ~10% padding on each side. The Privanote icon has the rounded rect filling 100% of the 1024x1024 canvas (width="1024" height="1024"). When macOS displays this alongside properly-sized icons, it appears larger because other apps leave the expected padding.
  implication: This is the direct cause of the oversized appearance.

## Resolution

root_cause: Two distinct issues in `apps/desktop/scripts/generate-icon.mjs`:

**Issue 1 - White background (line 29):** `qlmanage -t -s 1024` is used for SVG-to-PNG conversion. qlmanage is macOS's QuickLook thumbnail generator -- it always composites onto an opaque white background. It is not an SVG renderer that preserves alpha transparency. The corners outside the rounded-rect that should be transparent are instead white, creating the visible white background square in the dock.

**Issue 2 - Oversized appearance (line 18):** The SVG defines the rounded rect at `width="1024" height="1024"` filling the entire 1024x1024 viewBox. macOS expects icon artwork to occupy approximately 80% of the canvas (~819px centered in 1024px) with transparent padding around it. Since the charcoal shape extends edge-to-edge, macOS renders it larger than neighboring icons which follow the padding convention.

fix: (not yet applied)
verification: (not yet verified)
files_changed: []
