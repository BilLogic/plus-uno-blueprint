---
audience: developers
summary: How the app fits together — provider stack, module stores, the canvas stack, data flow, the mobile fork, and the performance constraints that shape all of it.
sources: src/App.tsx, src/components/editor/EditorShell.tsx, src/hooks/useZoomPanViewport.ts, src/hooks/useSupabaseQuery.ts, src/lib/queryClient.ts, src/lib/agent/placement.ts, commit 5911a95
last-reviewed: 2026-08-18
---

# Architecture

One-page app, no router. A single provider stack renders `EditorShell`,
which forks once — mobile or desktop — and everything else hangs off that.

## Provider stack

`src/App.tsx` is the whole story, in order:

QueryClientProvider → ThemeProvider → SupabaseProvider → EditorProvider →
ViewStateProvider → PathSelectionProvider → TooltipProvider →
EditorErrorBoundary → EditorShell

- `SupabaseProvider` (`src/contexts/SupabaseProvider.tsx`) owns the client
  singleton, the auth session, and the capability flags (`canWrite`,
  `canAgent`, `isServiceAccount`). See
  [access-and-security](access-and-security.md) for what those flags do and
  do not enforce.
- `EditorProvider` / `ViewStateProvider` own navigation: which phase,
  scenario, and tab is on screen.
- `EditorErrorBoundary` (`src/components/EditorErrorBoundary.tsx`) is the
  last line before a white screen — see Performance below for why it exists.

## The shell fork

`EditorShell` (`src/components/editor/EditorShell.tsx`) is one breakpoint
deciding which app this is: below `md` the view-only `MobileShell` — the
same desktop-parity canvas, scoped to the selected phase, behind mobile
chrome (top bar, nav drawer, agent sheet) — at or above it the desktop
editor, byte-for-byte the pre-mobile tree. The check is **synchronous**
(`matchMedia` through `useSyncExternalStore`, `src/hooks/useMobileShell.ts`)
so a phone never mounts the desktop canvas for even one frame. The
breakpoint contract itself is owned by `design/responsive.md`.

## The module-store idiom

Cross-surface shared state lives in a module-level store read through
`useSyncExternalStore`, not in context. Reach for it when state must
survive a mount point changing, or be read by non-React code. The live
examples, each with its reason in its header comment:

- `src/lib/agent/placement.ts` — the agent chat renders from two mount
  points (docked / floating) and a drag flips which one exists
  mid-gesture; component state would die in the gap.
- `src/lib/agent/panelState.ts` — open session + composer drafts, the rest
  of the "same conversation either way" promise.
- `src/contexts/canvasModeContext.ts` — view/design mode; the shared store
  lives outside the provider file so the agent's UI-context collector
  (plain functions) can read it.
- `src/contexts/sidebarCollapsedContext.ts` — navbars deep in canvas
  content publish their identity to the collapsed pill; not worth
  threading context through every surface.
- `src/hooks/useMobileShell.ts` — the media query as an external store.

Default to derived state and props otherwise —
[codebase-guide](codebase-guide.md) has the state idioms.

## The canvas stack

Top to bottom: `ZoomPanViewport` (`src/components/editor/ZoomPanViewport.tsx`,
wraps annotation + selection providers) → the transform layer
(`src/hooks/useZoomPanViewport.ts`) → artboards
(`[data-blueprint-artboard]`) → the blueprint grid
(`ServiceBlueprintGrid`) → cells.

- **Transforms bypass React.** A pan or pinch is sixty events a second;
  `applyTransformToElement` writes `translate3d(...) scale(...)` straight
  onto the content element. Nothing on that path may cause a render.
- **Semantic zoom** is stamped from the same transform writer: below
  `SEMANTIC_ZOOM_THRESHOLD` the board gets `data-semantic-tier="blocks"`
  and a `--semantic-label-boost` counter-scale variable. All styling for
  the tier lives in `src/styles/blueprint.css` under
  `[data-semantic-tier]`. The visual encoding is owned by
  `design/foundations/data-viz.md`.
- **Camera**: fit-to-view measures `fitSelector` bounds; `focusCells`
  registers per-viewport in a module registry (`src/lib/canvasFocusCells.ts`)
  so portalled surfaces (ledger drawer, agent commands) can fly the camera
  without a React path to it. Programmatic motion interpolates the visible
  world rectangle (coupled pan + zoom), has one cancellable owner, and starts
  navigation flights against the already-mounted target before the concurrent
  focus-state render. A matching post-navigation fit joins that flight instead
  of restarting it.
- **Input ownership**: pointer streams enter through native capture so a lane
  or cell cannot hide pointerdown with `stopPropagation`. The pure
  `canvasInputPolicy.ts` table documents precedence; continuous transforms stay
  imperative and publish one trailing React snapshot.

What each gesture is *supposed* to do — the click grammar, the touch
contract — is owned by `design/interaction.md`; this doc owns how it is
implemented. Debug a gesture with both open.

## Data flow

Reads go through `useSupabaseQuery` (`src/hooks/useSupabaseQuery.ts`): a
thin wrapper over TanStack Query that returns one discriminated union
(`loading | ready | error`), keyed by string, with a static-fixture
fallback path for no-DB and failed sessions. The cache policy
(`src/lib/queryClient.ts`) is `staleTime: Infinity` — nothing refetches on
its own, because nothing else edits the data. Consequences:

- Every mutation must invalidate, or the screen lies until reload. Call
  `invalidateQueries(prefix)` for scoped writes; any **structural** write
  calls `invalidateStructure()` — one canonical key list, because
  hand-rolled subsets drifted five ways before it existed (see the comment
  on `STRUCTURE_KEYS`).
- `useCanvasBlueprints` (`src/hooks/useCanvasBlueprints.ts`) fetches all
  paths for a scenario set in one query, keyed on the sorted id set, so
  every surface showing the same scenarios shares one fetch; errors fall
  back to the bundled fixtures in `src/data/blueprintFallbacks.ts`.

Writes never touch tables from components — the write path is owned by
[access-and-security](access-and-security.md#authoring-writes).

## Performance constraints

The board is **always fully mounted**: every phase, scenario, cell, and
arrow, with detail views dimming rather than unmounting. That is a
deliberate trade (instant navigation, one layout) and it sets the budget
for everything added to the canvas.

The lesson that set the rules (commit `5911a95`): step-visual images
decode to `width × height × 4 bytes` of bitmap **regardless of file
size**. ~450×700px sources across 141 mounted images meant 325 MB of
decoded RGBA — fine on desktop, an OOM tab-kill on mobile Chrome. Hence:

- **300px longest-edge cap** on step-visual assets. They display at
  ≤113×80; 300px is already 2.6× headroom. Downscale before committing.
- `loading="lazy"` + `decoding="async"` on every canvas `<img>`
  (`src/components/blueprint/BlueprintStepVisual.tsx`).
- `EditorErrorBoundary` catches recoverable throws with a designed reload
  surface. A true OOM still kills the tab; the cap is the real fix.
- Before adding any always-mounted asset class, estimate its decoded
  memory at full board scale, not its file size.

## Schema

The ERD lives at `docs/reference/erd.mmd`; the schema tour and access
model are in [access-and-security](access-and-security.md).
