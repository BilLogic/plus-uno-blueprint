---
audience: developers
summary: Where things live in src/ and which existing pattern to copy before inventing one.
sources: AGENTS.md, src/components/, src/lib/, src/hooks/, src/contexts/, src/components/editor/CanvasSelectionProvider.tsx, src/components/ui/deferred-skeleton.tsx
last-reviewed: 2026-08-08
---

# Codebase guide

Where things live, and the patterns to copy. The rule underneath all of
it: before inventing anything, find the nearest feature that already
solved the shape of your problem and copy it — the codebase is small
enough that "nearest feature" is always findable.

## Where things live

| Path | What |
|---|---|
| `src/components/ui/` | The design system — shadcn, base-ui flavor. Compose these; never hand-roll a primitive that exists. Missing one? Add via the shadcn CLI. |
| `src/components/blueprint/` | The board itself: cells, arrows, the cell detail panel, compare surfaces, walkthroughs. |
| `src/components/editor/` | The shell around the board: sidebar, tabs, canvas chrome, dialogs, the agent dock, slice editing. |
| `src/components/mobile/` | The phone shell: `MobileShell` + its chrome (top bar, nav sheet, agent sheet, path pill). View-only by design; the canvas itself is shared with desktop. |
| `src/lib/` | Plain logic, no React: layout math, mutations, the authoring session ledger, `agent/` (the in-app agent). |
| `src/hooks/` | Data hooks (thin wrappers over `useSupabaseQuery`) and viewport/interaction hooks. |
| `src/contexts/` | Providers and module stores. Files ending in lowercase (`canvasModeContext.ts`) are stores non-React code can read; `*Provider.tsx` files are React-only. |
| `src/data/` | Bundled fallback fixtures for no-DB sessions. |
| `src/styles/` | Token tiers and board CSS — see [standards](standards.md#token-discipline). |

## State idioms

Reviewers keep re-teaching these; copy them instead.

- **Derived state over synced state.** Compute in render; don't mirror a
  prop into `useState` + effect.
- **Freeze a prop snapshot** with `useState(initializer)` — reading refs
  during render is lint-blocked.
- **Render-phase guarded setState** is the house pattern for reacting to a
  prop change without an effect (and without a wrong first frame). Real
  example — `src/components/editor/CanvasSelectionProvider.tsx`:

  ```tsx
  const [lastMode, setLastMode] = useState(mode)
  if (lastMode !== mode) {
    setLastMode(mode)
    if (mode !== 'design' && picked.length > 0) setPicked([])
  }
  ```

  Cleared during render rather than in an effect so the new mode never
  paints one frame with stale UI. React re-renders immediately with the
  new state; the guard makes it converge.
- **Cross-surface state** = module store + `useSyncExternalStore` — when
  and why in [architecture](architecture.md#the-module-store-idiom).
- **Panel-level actions portal to a footer host** — the
  `CELL_PANEL_FOOTER_ID` pattern in
  `src/components/blueprint/CellPanelEditor.tsx`.

## Patterns to copy, by problem shape

- **Filter-as-you-type picker** → `OwnerTagSelect`.
- **Review-then-commit list** → `SessionChangesSheet`.
- **Context menus + accordion groups in the sidebar** →
  `SlicesSidebarSection`; the sidebar's one disclosure vocabulary is
  `SidebarNav`.
- **One surface, two postures** → the agent chat: `AgentDock`
  (`src/components/editor/AgentDock.tsx`) renders the same `AgentPanel`
  docked in the sidebar or floating over the canvas, with placement in a
  module store (`src/lib/agent/placement.ts`) so the conversation and the
  in-flight drag survive the mount-point swap. Copy this shape whenever a
  surface must move between homes without losing state.
- **Detail panel with responsive postures** →
  `BlueprintCellDetailPanel` (`src/components/blueprint/BlueprintCellDetailPanel.tsx`):
  side panel on desktop, `Drawer` sheet on mobile. Which posture a given
  surface *should* use — drawer vs sheet vs panel, snap points, handles —
  is owned by `design/components.md`; this doc only points at the
  implementation to copy.
- **Need→primitive map** for agent-UX work →
  `docs/reference/ui-inventory.md`.

## Error boundaries

`EditorErrorBoundary` (`src/components/EditorErrorBoundary.tsx`) wraps the
whole editor: any recoverable throw in the always-mounted canvas renders a
designed reload surface instead of a white screen, and logs to the
`[editor] uncaught error:` console channel
(see [operations](operations.md#monitoring)). Don't add per-feature
boundaries reflexively — one boundary at the shell is the pattern; add a
narrower one only when a surface can meaningfully continue without the
failed subtree.

## Deferred skeletons

Loading placeholders go through `DeferredSkeleton`
(`src/components/ui/deferred-skeleton.tsx`): a skeleton may only paint
after `SKELETON_HOLD_MS`, so fast loads never flash one. Sessions are
shared by hold key — a waterfall whose stages render from different
components (slice detail → scenario → blueprints) passes one key and shows
exactly one skeleton for the whole chain, no restarts, no replayed fades.
The board-shaped placeholders live in
`src/components/editor/EditorLoadingSkeletons.tsx`.

## Writes

No component writes to a table. Every DB write goes through the wrapper
layer so it lands in the session ledger with a captured revert — the write
path, its invariants, and the wrapper files are owned by
[access-and-security](access-and-security.md#authoring-writes).
