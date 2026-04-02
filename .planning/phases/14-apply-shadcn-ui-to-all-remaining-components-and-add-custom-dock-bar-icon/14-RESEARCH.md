# Phase 14: Apply shadcn/ui to All Remaining Components and Add Custom Dock Bar Icon - Research

**Researched:** 2026-04-02
**Domain:** shadcn/ui component migration, lucide-react icons, dark mode palette, macOS dock icon generation
**Confidence:** HIGH

## Summary

Phase 14 completes the shadcn/ui migration across the Privanote main window by installing 8 new shadcn components (ScrollArea, AlertDialog, Tooltip, Skeleton, Tabs, Alert, Progress, Sonner), adding lucide-react icons to all action buttons, reworking the `.dark` CSS variable block to a VS Code 2026 cool blue-gray palette, and generating a custom macOS dock icon.

The project already has 11 shadcn components installed, lucide-react in package.json (^1.7.0), and a working class-based dark mode system. The key technical challenges are: (1) the `npx shadcn add alert-dialog` command attempts to overwrite the customized button.jsx, removing the `destructive-outline` variant and changing size values -- this overwrite must be blocked; (2) the sonner component's scaffolded wrapper imports `next-themes` which is not available in this Electron/Vite app -- the wrapper must be rewritten to use the existing `useTheme` hook from `theme-toggle.jsx`; (3) the Progress component from shadcn only supports determinate mode via `value` prop -- indeterminate animation requires a CSS addition; (4) macOS dock icon generation requires `.icns` format, achievable via native `iconutil` (available on this machine) without external dependencies.

**Primary recommendation:** Install all 8 shadcn components in a single CLI batch (declining the button.jsx overwrite), customize sonner wrapper to drop `next-themes`, add an indeterminate CSS animation class for Progress, then execute the migration in file-by-file sweeps: dark palette first (CSS-only, zero risk), then component scaffolding, then App.jsx container migration, then sub-component migrations, then icon additions across all files, then toast integration, and finally dock icon generation.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The 3 raw `<button>` elements in App.jsx (capture mode selector L1174, note list items L1331, tab switcher L1470) stay as-is. They already use shadcn CSS variables and were intentionally kept raw after Phase 12's ToggleGroup conflicts. No migration needed.
- **D-02:** Migrate ALL structural containers to shadcn components for full consistency. Card-like divs (recorder panel, recording review, saved media section, empty states, settings sections) become shadcn Card. Error banners become shadcn Alert with destructive variant.
- **D-03:** Add shadcn ScrollArea to both the note list sidebar and the editor content area for themed scrollbars.
- **D-04:** Add shadcn AlertDialog for destructive actions (Delete Note, Remove Media). Other actions (Save Settings, Discard Recording) do not need confirmation.
- **D-05:** Add shadcn Tooltip for icon-only buttons. Text+icon buttons do not need tooltips.
- **D-06:** Add shadcn Skeleton for loading states (note list loading, editor content loading). Replace text-only "Loading notes..." with animated skeleton shapes.
- **D-07:** Add shadcn Tabs for the Workspace/Settings view switcher only. Capture mode selector stays as custom buttons (it controls a value, not a content panel).
- **D-08:** Add Sonner (shadcn toast) for non-blocking success/error feedback ("Note saved", "Media removed", "Sync failed") instead of only inline error messages.
- **D-09:** Add shadcn Progress for recording duration and sync status indicators.
- **D-10:** Add lucide-react and use text+icon format on all action buttons (e.g., Trash2 + "Remove", Play + "Start Recording", Save + "Save Changes", Upload + "Import Files"). Icon-only buttons get Tooltip for accessibility.
- **D-11:** Rework the `.dark` CSS variables in index.css to match VS Code 2026's cool blue-gray aesthetic. Deep blue-gray backgrounds, muted blue-gray borders, soft white text. Replace the current warm stone/brown oklch values.
- **D-12:** Light mode colors remain unchanged (keep current Phase 12 oklch palette).
- **D-13:** Create a custom macOS dock icon: rounded square shape with dark charcoal solid background and white bold "P" lettermark centered. Professional, pairs with the monochrome tray icon.
- **D-14:** Generate icon in required sizes for Electron/macOS (icon.icns for macOS, icon.ico for Windows, icon.png fallback). Wire into electron-builder or BrowserWindow config.
- **D-15:** The floating capture overlay (capture-overlay.html) is excluded from this phase. It's a standalone HTML file without React/Tailwind.

### Claude's Discretion
- Exact VS Code 2026-inspired oklch values for the dark palette
- Which specific lucide-react icons to use for each button
- Skeleton layout shapes and animation timing
- Toast positioning and duration
- Progress bar styling and placement
- Card border-radius values (maintain current rounded-2xl/rounded-[28px] aesthetic or adopt shadcn defaults)
- AlertDialog copy for confirmation messages
- How to generate the dock icon asset (programmatic SVG-to-PNG, external tool, or hand-crafted)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn (CLI) | ^4.1.1 | Component scaffolding via `npx shadcn add` | Already installed, configured in components.json |
| radix-ui | ^1.4.3 | Primitive library powering all shadcn components | Already installed, underpins existing 11 components |
| lucide-react | ^1.7.0 | Icon library for all action button icons | Already installed in package.json |
| sonner | 2.0.7 (latest) | Toast notification library (shadcn wraps it) | Official shadcn toast integration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sharp | 0.34.5 (latest) | PNG generation from SVG for dock icon | Icon generation script only (devDependency) |
| png2icons | 2.0.1 (latest) | Convert PNG to .icns and .ico formats | Icon generation script only (devDependency) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sharp + png2icons | macOS native `sips` + `iconutil` | Zero npm deps needed; `sips` and `iconutil` are both available on this machine. Avoids adding sharp (has native bindings, may conflict with Electron's better-sqlite3 rebuild pattern). **Recommended: use native tools.** |
| sonner | react-hot-toast | sonner is the shadcn-blessed toast; consistency with the rest of the design system |
| next-themes (sonner dep) | Custom wrapper | next-themes is a Next.js package, not compatible with Electron/Vite. Must write custom sonner wrapper using existing `useTheme` from theme-toggle.jsx |

### Do NOT install
- `next-themes` -- shadcn's sonner scaffolding imports it, but this is an Electron/Vite app. The sonner wrapper must be customized to read theme from the existing localStorage-based system.

**Installation:**
```bash
# Install new shadcn components (run from apps/desktop/)
npx shadcn add scroll-area tooltip skeleton tabs alert progress -y

# Install alert-dialog separately, declining the button.jsx overwrite
npx shadcn add alert-dialog
# When prompted about overwriting button.jsx: answer NO / use the file without --overwrite

# Install sonner component, then customize wrapper
npx shadcn add sonner -y
# Then remove next-themes import and replace with local useTheme

# Install sonner runtime dependency
npm install sonner
# Do NOT install next-themes
```

**Version verification:** lucide-react ^1.7.0 is current (npm registry: 1.7.0). sonner latest is 2.0.7. radix-ui ^1.4.3 is current.

## Architecture Patterns

### Recommended Project Structure
```
apps/desktop/src/renderer/
  components/
    ui/
      alert.jsx          # NEW - error/warning banners
      alert-dialog.jsx   # NEW - destructive action confirmation
      button.jsx         # EXISTING - DO NOT OVERWRITE (has destructive-outline)
      card.jsx           # EXISTING - used for container migration
      progress.jsx       # NEW - recording/sync progress bars
      scroll-area.jsx    # NEW - themed scrollbars
      skeleton.jsx       # NEW - loading state shapes
      sonner.jsx         # NEW - toast provider (CUSTOMIZED, no next-themes)
      tabs.jsx           # NEW - view switcher
      tooltip.jsx        # NEW - icon-only button labels
      ... (existing)
  index.css              # MODIFIED - .dark block replaced with VS Code 2026 palette
apps/desktop/resources/
  icon.icns              # NEW - macOS dock icon
  icon.ico               # NEW - Windows icon
  icon.png               # NEW - 1024x1024 PNG fallback
apps/desktop/scripts/
  generate-icon.mjs      # NEW - icon generation script
```

### Pattern 1: Card Container Migration
**What:** Replace raw `<div>` containers with shadcn Card/CardHeader/CardContent
**When to use:** All structural containers (recorder panel, review, saved media, settings sections, media cards)
**Example:**
```jsx
// BEFORE (current)
<div className="grid gap-4 rounded-[28px] bg-secondary/70 p-6">
  <div className="space-y-1">
    <h3 className="text-xl font-semibold leading-[1.2]">Capture</h3>
    <p className="text-sm leading-6 text-muted-foreground">...</p>
  </div>
  {/* content */}
</div>

// AFTER (migrated)
<Card className="rounded-[28px] bg-secondary/70 border-0 ring-0 shadow-none">
  <CardHeader>
    <CardTitle className="text-xl font-semibold leading-[1.2]">Capture</CardTitle>
    <CardDescription>...</CardDescription>
  </CardHeader>
  <CardContent>
    {/* content */}
  </CardContent>
</Card>
```

**Important note on Card customization:** The default Card component has `ring-1 ring-foreground/10` and `rounded-xl`. Many of the existing containers use `rounded-[28px]`, `rounded-[24px]`, or `rounded-[32px]` with no ring. The className override must neutralize the defaults: `className="rounded-[28px] bg-secondary/70 border-0 ring-0 shadow-none"`. The Card also has default `py-4` padding via its base class, and `px-4` in CardContent/CardHeader -- these need adjustment via className to match existing `p-6` / `p-5` patterns.

### Pattern 2: AlertDialog Wrapping Existing Buttons
**What:** Wrap destructive Button triggers with AlertDialog
**When to use:** Delete Note and Remove Media buttons only (per D-04)
**Example:**
```jsx
// Source: shadcn AlertDialog pattern
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive-outline" size="lg">
      <Trash2 className="size-4" />
      Delete Note
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete note?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete this note and all its attachments. This cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        className={cn(buttonVariants({ variant: "destructive" }))}
        onClick={() => handleDeleteNode(selectedNode.id)}
      >
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Pattern 3: Sonner Toast (Custom Wrapper, No next-themes)
**What:** Custom sonner wrapper that reads theme from existing localStorage system
**When to use:** Root App component for Toaster provider, action handlers for toast calls
**Example:**
```jsx
// Custom sonner.jsx (replacing scaffolded version)
import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react";

function useResolvedTheme() {
  const [theme, setTheme] = useState(() => {
    const pref = localStorage.getItem('privanote-theme') || 'system';
    if (pref === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return pref;
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

const Toaster = ({ ...props }) => {
  const theme = useResolvedTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="bottom-right"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={{
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius)",
      }}
      {...props}
    />
  );
};

export { Toaster };
```

Usage in action handlers:
```jsx
import { toast } from 'sonner';

// In handleSaveNode success path:
toast.success('Note saved');

// In handleDeleteNode error path:
toast.error('Could not delete note. Try again.');
```

### Pattern 4: Indeterminate Progress Bar
**What:** shadcn Progress only supports determinate mode. Indeterminate needs a CSS animation.
**When to use:** Recording duration progress and sync status (per D-09)
**Example:**
```css
/* Add to index.css */
@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
}

.progress-indeterminate [data-slot="progress-indicator"] {
  width: 40%;
  animation: indeterminate 1.5s ease-in-out infinite;
}
```

```jsx
<Progress className="progress-indeterminate h-1" />
```

### Pattern 5: Icon Button Format
**What:** Add lucide-react icons before button text labels
**When to use:** All action buttons across App.jsx, media-card.jsx, transcript-section.jsx, settings-view.jsx
**Example:**
```jsx
import { Save, Trash2, Upload, Square, RefreshCw, Circle } from 'lucide-react';

<Button size="lg" onClick={handleSaveRecording}>
  <Save className="size-4" />
  Save Recording
</Button>

<Button variant="destructive-outline" size="lg" onClick={handleDiscardRecording}>
  <X className="size-4" />
  Discard Recording
</Button>
```

Note: The existing Button component already has `[&_svg:not([class*='size-'])]:size-4` in its base styles, so icons placed as children auto-size to 16px. The `gap-2` in button sizes provides the spacing between icon and text.

### Anti-Patterns to Avoid
- **Overwriting button.jsx:** The `npx shadcn add alert-dialog` command tries to overwrite button.jsx with a version that removes `destructive-outline` variant and changes h-10/h-11 sizing to h-8/h-9. This would break every button in the app. Block the overwrite.
- **Using next-themes:** The scaffolded sonner wrapper imports `useTheme` from `next-themes`. This package is for Next.js apps and will fail in Electron/Vite. Write a custom theme hook instead.
- **Card defaults without override:** The shadcn Card has `ring-1 ring-foreground/10`, `rounded-xl`, and `py-4` defaults. Migrated containers need className overrides to maintain the existing `rounded-[28px]`, no-ring, and `p-6` styles.
- **Tabs replacing D-01 buttons:** Only the Workspace/Settings switcher becomes Tabs (D-07). The capture mode selector stays as raw buttons (D-01).
- **AlertDialog on non-destructive actions:** Only Delete Note and Remove Media get confirmation (D-04). Save Settings, Discard Recording, Save Changes, Clear Credential, and Disconnect Provider do NOT.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast div with timeouts | sonner via shadcn | Animation, stacking, auto-dismiss, accessibility (aria-live), theme integration |
| Confirmation dialogs | Custom modal with portal | shadcn AlertDialog | Focus trap, keyboard escape, overlay click handling, screen reader role="alertdialog" |
| Themed scrollbars | Custom CSS scrollbar styles | shadcn ScrollArea | Cross-browser consistency, auto-hide behavior, Radix handles pointer events on thumb |
| Loading skeletons | Custom shimmer div | shadcn Skeleton | Consistent pulse animation, proper bg-muted coloring |
| Accessible tooltips | title attribute or custom hover div | shadcn Tooltip | Delay timing, portal positioning, keyboard focus trigger, screen reader compatibility |
| Icon library | Custom SVG components | lucide-react | 1400+ icons, tree-shakeable, consistent stroke/size, already installed |
| macOS .icns generation | Manual asset creation | `iconutil` (native macOS CLI) | Already available at `/usr/bin/iconutil`, no npm dependency needed |

**Key insight:** Every component in this phase has a shadcn equivalent that handles accessibility, animation, and theming edge cases that would take significant effort to hand-roll correctly. The only custom code needed is the sonner theme wrapper (because next-themes doesn't work in Electron) and the indeterminate progress CSS animation (because shadcn Progress only supports determinate mode).

## Common Pitfalls

### Pitfall 1: button.jsx Overwrite Destroys Custom Variants
**What goes wrong:** Running `npx shadcn add alert-dialog` with `--overwrite` or `-y` replaces the customized button.jsx, removing `destructive-outline` variant and changing size tokens (h-10/h-11 become h-8/h-9).
**Why it happens:** AlertDialog's scaffolded code imports Button, so shadcn tries to update the dependency.
**How to avoid:** Run `npx shadcn add alert-dialog` without `-y`, decline the button.jsx overwrite. Or install the other components first (which don't touch button.jsx), then copy alert-dialog.jsx manually from the CLI's `--view` output.
**Warning signs:** All buttons shrink, destructive outline buttons lose their variant styling.

### Pitfall 2: Sonner next-themes Import Fails at Runtime
**What goes wrong:** The scaffolded `sonner.jsx` wrapper does `import { useTheme } from "next-themes"` which crashes because next-themes is not installed and wouldn't work in Electron anyway.
**Why it happens:** shadcn's sonner template assumes a Next.js environment.
**How to avoid:** After running `npx shadcn add sonner`, immediately rewrite the generated `sonner.jsx` to use a custom theme detection hook (MutationObserver on `document.documentElement.classList`). Do NOT install next-themes.
**Warning signs:** Module not found error on app startup.

### Pitfall 3: Card Default Styles Clash with Existing Layout
**What goes wrong:** Migrated containers get unwanted visual changes (extra ring/border, wrong padding, smaller radius).
**Why it happens:** shadcn Card defaults to `ring-1 ring-foreground/10 rounded-xl py-4` with `px-4` in CardContent. Existing containers use `rounded-[28px] p-6` with no ring.
**How to avoid:** Always override Card className: `className="rounded-[28px] bg-secondary/70 border-0 ring-0 shadow-none"`. Override CardHeader/CardContent padding: `className="px-6 pt-6"` / `className="px-6 pb-6"`.
**Warning signs:** Containers look smaller, have visible thin rings, or have inconsistent padding.

### Pitfall 4: ScrollArea Height Collapse
**What goes wrong:** ScrollArea renders with 0 height because it needs an explicit height constraint from its parent.
**Why it happens:** ScrollArea uses `overflow: hidden` on the root and needs a bounded height to enable scrolling.
**How to avoid:** The note list sidebar uses `flex-1 overflow-y-auto` -- when replacing with ScrollArea, keep `flex-1` on the ScrollArea wrapper and ensure the parent aside has a bounded height (it does via the grid layout). The editor section needs the same treatment.
**Warning signs:** Scroll content disappears or entire page scrolls instead of just the area.

### Pitfall 5: Tab Switcher State Mismatch
**What goes wrong:** Replacing the custom button pair with shadcn Tabs changes the value binding semantics.
**Why it happens:** Current code uses `onClick={() => setActiveView(value)}` with `aria-pressed`. Tabs uses `onValueChange` and `value` props on `TabsPrimitive.Root`.
**How to avoid:** Map the existing `activeView` state directly to Tabs: `<Tabs value={activeView} onValueChange={setActiveView}>`. Do not use `defaultValue` since state is already controlled.
**Warning signs:** View switching stops working or shows wrong active tab.

### Pitfall 6: Progress Indeterminate Mode Not Built-In
**What goes wrong:** Using `<Progress />` without a `value` prop renders an empty track (indicator at 0%).
**Why it happens:** shadcn Progress uses `translateX(-${100 - (value || 0)}%)` -- with no value, the indicator is fully translated left (invisible). There is no built-in indeterminate animation.
**How to avoid:** Add a CSS `@keyframes indeterminate` animation and apply it via a wrapper class. Set the indicator width to 40% and animate `translateX` from -100% to 250%.
**Warning signs:** Progress bars appear as empty gray tracks with no animation.

### Pitfall 7: Toast Action Handler Timing
**What goes wrong:** Toast shows success before the async operation actually completes, or toast shows even when the operation fails.
**Why it happens:** Calling `toast.success()` before awaiting the async operation.
**How to avoid:** Place `toast.success()` in the `.then()` / after `await` succeeds, and `toast.error()` in the `.catch()` / catch block. Verify each handler path.
**Warning signs:** Success toasts followed by error states, or missing error toasts on failure.

### Pitfall 8: Dock Icon Not Showing in Dev Mode
**What goes wrong:** The dock icon appears as default Electron icon during development.
**Why it happens:** BrowserWindow `icon` option is primarily for Windows/Linux. On macOS, the dock icon comes from the .app bundle's Info.plist / .icns file, which is only used in production builds. In development, Electron uses its own icon.
**How to avoid:** For development, use `app.dock.setIcon()` in main.js to explicitly set the dock icon. For production, configure electron-builder with `mac.icon: "resources/icon.icns"`.
**Warning signs:** Icon looks correct in production build but not during `npm run dev`.

## Code Examples

### Dark Mode CSS Variable Block (from UI-SPEC)
```css
/* Replace .dark block in index.css (lines 49-81) with: */
.dark {
  --background: oklch(0.235 0.006 260);
  --foreground: oklch(0.93 0.003 260);
  --card: oklch(0.265 0.006 260);
  --card-foreground: oklch(0.93 0.003 260);
  --popover: oklch(0.265 0.006 260);
  --popover-foreground: oklch(0.93 0.003 260);
  --primary: oklch(0.87 0.000 260);
  --primary-foreground: oklch(0.235 0.006 260);
  --secondary: oklch(0.297 0.006 260);
  --secondary-foreground: oklch(0.93 0.003 260);
  --muted: oklch(0.297 0.006 260);
  --muted-foreground: oklch(0.62 0.010 260);
  --accent: oklch(0.297 0.006 260);
  --accent-foreground: oklch(0.93 0.003 260);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.371 0.008 260);
  --input: oklch(0.356 0.008 260);
  --ring: oklch(0.567 0.155 248.5);
  --chart-1: oklch(0.567 0.155 248.5);
  --chart-2: oklch(0.62 0.010 260);
  --chart-3: oklch(0.483 0.117 245.5);
  --chart-4: oklch(0.792 0.003 260);
  --chart-5: oklch(0.87 0.000 260);
  --sidebar: oklch(0.265 0.006 260);
  --sidebar-foreground: oklch(0.93 0.003 260);
  --sidebar-primary: oklch(0.87 0.000 260);
  --sidebar-primary-foreground: oklch(0.235 0.006 260);
  --sidebar-accent: oklch(0.321 0.006 260);
  --sidebar-accent-foreground: oklch(0.93 0.003 260);
  --sidebar-border: oklch(0.371 0.008 260);
  --sidebar-ring: oklch(0.567 0.155 248.5);
}
```

### Alert Error Banner Migration
```jsx
// BEFORE
<div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
  {captureError}
</div>

// AFTER
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

<Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/10">
  <AlertCircle className="size-4" />
  <AlertDescription>{captureError}</AlertDescription>
</Alert>
```

### Skeleton Loading State for Note List
```jsx
import { Skeleton } from '@/components/ui/skeleton';

// Replace "Loading notes..." text div
<div className="grid gap-3">
  {[1, 2, 3].map((i) => (
    <div key={i} className="rounded-2xl border bg-background p-4 space-y-2">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  ))}
</div>
```

### Tabs View Switcher Migration
```jsx
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Replace the custom button pair at L1464-L1487
<Tabs value={activeView} onValueChange={setActiveView}>
  <TabsList className="rounded-2xl bg-secondary p-2 h-auto">
    <TabsTrigger
      value="workspace"
      className="h-11 rounded-xl px-4 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_18px_42px_-22px_rgba(15,23,42,0.95)] data-[state=active]:ring-2 data-[state=active]:ring-primary/20 data-[state=active]:-translate-y-px"
    >
      Workspace
    </TabsTrigger>
    <TabsTrigger
      value="settings"
      className="h-11 rounded-xl px-4 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_18px_42px_-22px_rgba(15,23,42,0.95)] data-[state=active]:ring-2 data-[state=active]:ring-primary/20 data-[state=active]:-translate-y-px"
    >
      Settings
    </TabsTrigger>
  </TabsList>
</Tabs>
```

### Dock Icon Generation Script (Native macOS Tools)
```javascript
// scripts/generate-icon.mjs
// Uses Node.js canvas-like approach or SVG-to-PNG via sharp,
// then native iconutil for .icns

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resourcesDir = path.join(__dirname, '..', 'resources');

// Step 1: Create SVG
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="228" fill="#1e2028"/>
  <text x="512" y="512" text-anchor="middle" dominant-baseline="central"
        font-family="Inter, -apple-system, sans-serif" font-weight="700"
        font-size="620" fill="white">P</text>
</svg>`;

// Step 2: Convert SVG to 1024px PNG using sharp (or sips)
// Step 3: Generate iconset with sips for each required size
// Step 4: Run iconutil --convert icns
```

### BrowserWindow and electron-builder Icon Wiring
```javascript
// In main.js createWindow():
const win = new BrowserWindow({
  // ... existing config
  icon: path.join(__dirname, '..', '..', 'resources', 'icon.png'),
});

// For macOS dev mode dock icon:
if (process.platform === 'darwin' && app.dock) {
  app.dock.setIcon(path.join(__dirname, '..', '..', 'resources', 'icon.png'));
}
```

```yaml
# In electron-builder.yml, add:
mac:
  icon: resources/icon.icns
  # ... existing mac config
win:
  icon: resources/icon.ico
linux:
  icon: resources/icon.png
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn v2 slot-based | shadcn v4 data-slot pattern | 2025 | Components use `data-slot="X"` attributes for CSS targeting instead of classes. All scaffolded components follow this pattern. |
| react-toastify / react-hot-toast | sonner (via shadcn) | 2024 | sonner is the official shadcn toast. Lightweight, no provider wrapping needed, `toast()` function API. |
| Custom theme providers | next-themes (Next.js) / class-based (Vite) | N/A | shadcn assumes next-themes for SSR apps. Electron/Vite apps use class-based toggle with localStorage -- must customize sonner wrapper. |
| Electron default icon | Custom .icns via electron-builder | N/A | electron-builder reads `mac.icon` from config. BrowserWindow `icon` option is only for Windows/Linux. macOS uses .app bundle icon. |

**Deprecated/outdated:**
- shadcn `cn()` helper still works the same (clsx + tailwind-merge). No API changes.
- Radix UI primitives now ship under the umbrella `radix-ui` package (already installed at ^1.4.3) instead of individual `@radix-ui/react-*` packages.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Icon generation script | Yes | v20.19.1 | -- |
| npx (shadcn CLI) | Component scaffolding | Yes | -- | -- |
| sips | PNG resizing for iconset | Yes | macOS native | sharp |
| iconutil | .icns generation | Yes | macOS native | png2icons npm package |
| sharp | SVG-to-PNG rendering | Not installed | 0.34.5 (npm) | Use inline SVG with sips, or install as devDep |
| png2icons | .ico generation | Not installed | 2.0.1 (npm) | Manual creation or skip .ico (Windows not priority) |

**Missing dependencies with no fallback:**
- None -- all critical tools are available natively on macOS.

**Missing dependencies with fallback:**
- `sharp` -- can be avoided by creating the 1024px PNG manually or using a Node canvas library. Alternatively, use `sips` to resize from a source PNG.
- `png2icons` -- for .ico generation only. Can skip .ico for now (Windows support is not the current target) or install as a devDependency.

**Recommendation:** Use native macOS tools (`sips` + `iconutil`) for .icns generation. For .ico, either install `png2icons` as a devDep or defer to electron-builder which can auto-convert from PNG.

## Open Questions

1. **Alert component customization for existing error banner styling**
   - What we know: The scaffolded Alert has `bg-card` background and `rounded-lg`. Existing error banners use `rounded-2xl border-destructive/20 bg-destructive/10`. The destructive variant only changes text color, not background.
   - What's unclear: Whether to keep the existing bg-destructive/10 styling (more visible) or adopt the shadcn default (subtler).
   - Recommendation: Override Alert's className to preserve the existing `rounded-2xl bg-destructive/10 border-destructive/20` styling, which is more consistent with the established error visual pattern.

2. **Card padding reconciliation**
   - What we know: shadcn Card uses `py-4` on the root and `px-4` on header/content. Existing containers use `p-5` or `p-6`.
   - What's unclear: Whether the visual difference matters enough to override every instance.
   - Recommendation: Override padding via className on each Card usage to match the existing `p-6` or `p-5` pattern. Consistency with the existing design is more important than shadcn defaults.

3. **Dock icon font rendering in SVG**
   - What we know: The icon needs Inter Bold "P" lettermark. SVG text rendering via `sips` may not have Inter font available.
   - What's unclear: Whether sips/system rendering will pick up the correct font.
   - Recommendation: If programmatic font rendering is unreliable, create the P lettermark as an SVG path (vector outline) rather than an SVG text element. This guarantees consistent rendering regardless of font availability.

## Sources

### Primary (HIGH confidence)
- shadcn CLI dry-run output -- verified component file contents, dependencies, and button.jsx overwrite behavior
- Existing codebase: App.jsx (1532 lines), media-card.jsx (193 lines), transcript-section.jsx (86 lines), settings-view.jsx (348 lines), button.jsx, card.jsx, index.css, components.json, tailwind.config.js, main.js
- npm registry: lucide-react 1.7.0, sonner 2.0.7, sharp 0.34.5, png2icons 2.0.1
- macOS native tools: `sips` at /usr/bin/sips, `iconutil` at /usr/bin/iconutil (verified available)

### Secondary (MEDIUM confidence)
- shadcn v4 data-slot pattern and component APIs -- verified through CLI `--view` output for each component
- Electron BrowserWindow icon behavior (macOS vs Windows) -- based on Electron documentation

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages verified in npm registry, existing dependencies confirmed in package.json, shadcn CLI dry-runs show exact file outputs
- Architecture: HIGH - all component APIs verified via `npx shadcn add --view`, all source files read and analyzed, integration points identified at exact line numbers
- Pitfalls: HIGH - button.jsx overwrite confirmed via `--diff`, sonner next-themes dependency confirmed via `--view`, Card default styles confirmed via source read, Progress indeterminate limitation confirmed via source read

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- shadcn v4 and radix-ui are mature, no breaking changes expected)
