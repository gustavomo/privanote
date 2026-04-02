# Phase 14: Apply shadcn/ui to All Remaining Components and Add Custom Dock Bar Icon - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the shadcn/ui migration across the entire main window by replacing all remaining raw HTML containers and structural elements with shadcn components, adding lucide-react icons to action buttons, introducing toast notifications and loading skeletons, confirmation dialogs for destructive actions, styled scroll areas, and shadcn Tabs for the view switcher. Rework the dark mode palette to match VS Code 2026's cool blue-gray aesthetic. Create and wire a custom macOS dock icon (rounded square, dark charcoal background, white "P" lettermark).

This phase does NOT include:
- Changes to the floating capture overlay (capture-overlay.html) — stays excluded
- New features or capabilities
- Changes to capture logic, session handling, or note creation
- Light mode color changes (keep current Phase 12 palette)
- Modifications to the 3 intentionally custom-styled buttons (capture mode selector, note list items, tab switcher raw buttons stay as-is per Phase 12 decision)

</domain>

<decisions>
## Implementation Decisions

### Remaining Buttons
- **D-01:** The 3 raw `<button>` elements in App.jsx (capture mode selector L1174, note list items L1331, tab switcher L1470) stay as-is. They already use shadcn CSS variables and were intentionally kept raw after Phase 12's ToggleGroup conflicts. No migration needed.

### Full shadcn Component Migration
- **D-02:** Migrate ALL structural containers to shadcn components for full consistency. Card-like divs (recorder panel, recording review, saved media section, empty states, settings sections) become shadcn Card. Error banners become shadcn Alert with destructive variant.
- **D-03:** Add shadcn ScrollArea to both the note list sidebar and the editor content area for themed scrollbars.
- **D-04:** Add shadcn AlertDialog for destructive actions (Delete Note, Remove Media). Other actions (Save Settings, Discard Recording) do not need confirmation.
- **D-05:** Add shadcn Tooltip for icon-only buttons. Text+icon buttons do not need tooltips.
- **D-06:** Add shadcn Skeleton for loading states (note list loading, editor content loading). Replace text-only "Loading notes..." with animated skeleton shapes.
- **D-07:** Add shadcn Tabs for the Workspace/Settings view switcher only. Capture mode selector stays as custom buttons (it controls a value, not a content panel).
- **D-08:** Add Sonner (shadcn toast) for non-blocking success/error feedback ("Note saved", "Media removed", "Sync failed") instead of only inline error messages.
- **D-09:** Add shadcn Progress for recording duration and sync status indicators.

### Icon Library
- **D-10:** Add lucide-react and use text+icon format on all action buttons (e.g., Trash2 + "Remove", Play + "Start Recording", Save + "Save Changes", Upload + "Import Files"). Icon-only buttons get Tooltip for accessibility.

### Dark Mode Palette
- **D-11:** Rework the `.dark` CSS variables in index.css to match VS Code 2026's cool blue-gray aesthetic. Deep blue-gray backgrounds, muted blue-gray borders, soft white text. Replace the current warm stone/brown oklch values.
- **D-12:** Light mode colors remain unchanged (keep current Phase 12 oklch palette).

### Dock Icon
- **D-13:** Create a custom macOS dock icon: rounded square shape with dark charcoal solid background and white bold "P" lettermark centered. Professional, pairs with the monochrome tray icon.
- **D-14:** Generate icon in required sizes for Electron/macOS (icon.icns for macOS, icon.ico for Windows, icon.png fallback). Wire into electron-builder or BrowserWindow config.

### Overlay
- **D-15:** The floating capture overlay (capture-overlay.html) is excluded from this phase. It's a standalone HTML file without React/Tailwind — migrating would require significant rearchitecture for little visual gain.

### Claude's Discretion
- Exact VS Code 2026-inspired oklch values for the dark palette
- Which specific lucide-react icons to use for each button
- Skeleton layout shapes and animation timing
- Toast positioning and duration
- Progress bar styling and placement
- Card border-radius values (maintain current rounded-2xl/rounded-[28px] aesthetic or adopt shadcn defaults)
- AlertDialog copy for confirmation messages
- How to generate the dock icon asset (programmatic SVG-to-PNG, external tool, or hand-crafted)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Main Window UI
- `apps/desktop/src/renderer/App.jsx` — Main application component (1532 lines), all UI state, containers to migrate
- `apps/desktop/src/renderer/index.css` — Global styles with dark mode CSS variables (lines 49-81 = `.dark` block to rework)
- `apps/desktop/src/renderer/index.html` — HTML shell with theme init script
- `apps/desktop/src/renderer/main.jsx` — React DOM entry point

### Components
- `apps/desktop/src/renderer/components/settings-view.jsx` — Settings panel (348 lines), already uses shadcn form controls
- `apps/desktop/src/renderer/components/media-card.jsx` — Media display cards (193 lines), already uses shadcn Button/Badge
- `apps/desktop/src/renderer/components/transcript-section.jsx` — Transcript display (86 lines), already uses shadcn Button
- `apps/desktop/src/renderer/components/theme-toggle.jsx` — Theme toggle (52 lines)

### Existing shadcn Components
- `apps/desktop/src/renderer/components/ui/` — 11 components: button, checkbox, radio-group, input, textarea, card, badge, label, separator, toggle, toggle-group

### Configuration
- `apps/desktop/components.json` — shadcn/ui configuration
- `apps/desktop/tailwind.config.js` — Tailwind CSS configuration with darkMode: 'class'
- `apps/desktop/package.json` — Dependencies

### Icon Resources
- `apps/desktop/resources/trayTemplate.png` — Existing tray icon (monochrome P lettermark)
- `apps/desktop/resources/trayTemplate@2x.png` — Retina tray icon
- `apps/desktop/src/main/main.js` — BrowserWindow creation (L951), dock badge (L377), tray setup (L330)

### Prior Phase Context
- `.planning/phases/12-ui-audit-and-fix-pass-identify-and-resolve-visual-bugs-layout-inconsistencies-accessibility-issues-and-interaction-edge-cases-across-the-app/12-CONTEXT.md` — Phase 12 shadcn setup, preset bIkfWsK, ToggleGroup conflicts
- `.planning/phases/11-ui-polish-button-icon-states-active-colors-and-persistent-custom-menu-bar-icon/11-CONTEXT.md` — Phase 11 tray icon and overlay polish decisions

### Overlay (DO NOT MODIFY)
- `apps/desktop/src/renderer/capture-overlay/capture-overlay.html` — Excluded from this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 11 shadcn components already scaffolded in `ui/` — extend with new ones via `npx shadcn add`
- `cn()` utility in `lib/utils.js` for Tailwind class merging
- `components.json` configured for component generation
- Dark mode infrastructure (class-based switching, localStorage persistence, FOUC prevention script)
- Tray icon template PNGs in `resources/` — dock icon follows same directory pattern

### Established Patterns
- shadcn components scaffolded via CLI into `components/ui/`
- oklch color space for CSS variables (both light and dark)
- Button variants: default, outline, destructive-outline, ghost, link
- Phase 12 proven: ToggleGroup conflicts with custom className — avoid for custom-styled toggles
- Phase 12 proven: Radix API patterns — `onCheckedChange` for Checkbox, `onValueChange` for RadioGroup

### Integration Points
- `App.jsx` containers (recorder, review, saved media, empty states) — wrap with Card
- `App.jsx` error divs (L1194, L1492) — replace with Alert
- `App.jsx` scrollable areas (L1312 note list, L1359 editor section) — wrap with ScrollArea
- `App.jsx` view switcher (L1464-L1487) — replace with Tabs
- Delete Note button (L1372) and Remove Media in media-card.jsx — wrap with AlertDialog
- All Button components across all files — add lucide-react icons
- `index.css` `.dark` block (L49-L81) — rework all oklch values for VS Code 2026 palette
- `main.js` BrowserWindow config — add icon path for dock icon

</code_context>

<specifics>
## Specific Ideas

- User wants "simple elegant" styling — full shadcn consistency across all elements
- Dark mode should look like VS Code 2026 dark theme — cool blue-gray, not warm brown/stone
- Dock icon: dark charcoal rounded square with white P — professional, matches tray icon identity
- Text+icon format for buttons (not icon-only) for clarity
- Toast notifications for non-blocking feedback instead of only inline errors
- Skeleton loading states instead of plain text "Loading..."
- AlertDialog only for destructive actions (delete/remove), not for saves or settings changes

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-apply-shadcn-ui-to-all-remaining-components-and-add-custom-dock-bar-icon*
*Context gathered: 2026-04-02*
