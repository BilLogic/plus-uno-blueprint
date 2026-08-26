---
audience: developers
summary: Where things live, how the app fits together, and which existing pattern to copy — provider stack, module stores, the canvas stack, data flow, and the performance budget the always-mounted board sets.
sources: src/App.tsx, src/components/editor/EditorShell.tsx, src/hooks/useZoomPanViewport.ts, src/hooks/useSupabaseQuery.ts, src/lib/queryClient.ts, src/lib/agent/placement.ts, src/components/ui/deferred-skeleton.tsx, commit 5911a95
last-reviewed: 2026-08-25
---

# Codebase guide

Where things live, how they connect, and the patterns to copy. One doc, because
"where does this live" and "how does it reach the rest" are the same question
asked twice — they were two docs, and the seam between them was where a reader
had to guess.

The rule underneath all of it: before inventing anything, find the nearest
feature that already solved the shape of your problem and copy it. The codebase
is small enough that "nearest feature" is always findable.

This doc **describes**. Where a choice was surprising or is hard to reverse, the
reasoning lives in [`docs/adr/`](../adr/) and is linked from here.

## Where things live

| Path | What |
|---|---|
| `src/components/ui/` | The design system — shadcn, base-ui flavor. Compose these; never hand-roll a primitive that exists. Missing one? Add via the shadcn CLI. |
| `src/components/blueprint/` | The board itself: cells, arrows, the entity panels, compare surfaces, walkthroughs. |
| `src/components/editor/` | The shell around the board: sidebar, tabs, canvas chrome, dialogs, the agent dock, slice editing. |
| `src/components/cover/` | The shell's landing view, skinned entirely by a content module. |
| `src/components/mobile/` | The phone shell: `MobileShell` + its chrome (top bar, nav sheet, agent sheet, path pill). View-only by design; the canvas itself is shared with desktop. |
| `src/lib/` | Plain logic, no React: layout math, mutations, the authoring session ledger, `agent/` (the in-app agent). |
| `src/hooks/` | Data hooks (thin wrappers over `useSupabaseQuery`) and viewport/interaction hooks. |
| `src/contexts/` | Providers and module stores. Files ending in lowercase (`canvasModeContext.ts`) are stores non-React code can read; `*Provider.tsx` files are React-only. |
| `src/data/` | Bundled fallback fixtures for no-DB sessions. |
| `src/styles/` | Token tiers and board CSS — see [standards](standards.md#token-discipline). |

What each of those component folders looks like *as a designed surface* is
[`docs/guidelines/composition/`](../guidelines/composition/overview.md), and
every file under `blueprint/`, `editor/`, `cover/` and `mobile/` is claimed by
exactly one doc there. This table says where code lives; those docs say what it
is. `npm run check:harness` keeps the second half honest.

## How it fits together

One-page app, no router. A single provider stack renders `EditorShell`, which
forks once — mobile or desktop — and everything else hangs off that.

## Provider stack

`src/App.tsx` is the whole story, in order:

QueryClientProvider → ThemeProvider → SupabaseProvider → EditorProvider →
ViewStateProvider → PathSelectionProvider → TooltipProvider →
ScenarioPathSelectionReset → EditorErrorBoundary → EditorShell → WriteFailureNotices

- `SupabaseProvider` (`src/contexts/SupabaseProvider.tsx`) owns the client
  singleton, the auth session, and the capability flags (`canWrite`,
  `canAgent`, `isServiceAccount`). See
  [access-and-security](access-and-security.md) for what those flags do and
  do not enforce.
- `EditorProvider` / `ViewStateProvider` own navigation: which phase,
  scenario, and tab is on screen.
- `EditorErrorBoundary` (`src/components/EditorErrorBoundary.tsx`) is the
  last line before a white screen — see Performance below for why it exists.
- `WriteFailureNotices` is mounted **after** it, outside the boundary, and
  deliberately: a write can fail as the shell falls over, and the notice is
  what says so.

## The shell fork

`EditorShell` (`src/components/editor/EditorShell.tsx`) is one breakpoint
deciding which app this is: below `md` the view-only `MobileShell` — the
same desktop-parity canvas, scoped to the selected scenario, behind mobile
chrome (top bar, nav drawer, agent sheet) — at or above it the desktop
editor, byte-for-byte the pre-mobile tree. The check is **synchronous**
(`matchMedia` through `useSyncExternalStore`, `src/hooks/useMobileShell.ts`)
so a phone never mounts the desktop canvas for even one frame. The
breakpoint contract itself is owned by [guidelines/foundations/layout.md](../guidelines/foundations/layout.md).

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

Default to derived state and props otherwise; the state idioms are below.
Why a module store rather than context is
[ADR 0005](../adr/0005-cross-surface-state-is-a-module-store.md).

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
- **Cross-surface state** = module store + `useSyncExternalStore`, per the
  idiom above and [ADR 0005](../adr/0005-cross-surface-state-is-a-module-store.md).
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
- **Detail panel with responsive postures** → the shared shell
  `src/components/blueprint/panelShell.tsx`: right-pinned inspector card on
  desktop, `Drawer` sheet on mobile. Which posture a given surface *should*
  use — drawer vs sheet vs panel, keying, snap points, handles — is owned by
  [`guidelines/composition/dialogs-sheets-and-forms.md`](../guidelines/composition/dialogs-sheets-and-forms.md);
  this doc only points at the implementation to copy.
- **Need→primitive map** for agent-UX work →
  [`docs/reference/ui-inventory.md`](../reference/ui-inventory.md).

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
  [guidelines/foundations/data-viz.md](../guidelines/foundations/data-viz.md).
- **Camera**: fit-to-view measures `fitSelector` bounds; `focusCells`
  registers per-viewport in a module registry (`src/lib/canvasFocusCells.ts`)
  so portalled surfaces (ledger drawer, agent commands) can fly the camera
  without a React path to it. Programmatic motion keeps pan and zoom coupled —
  the viewport centre interpolates linearly, the scale as a ratio — has one
  cancellable owner, and starts navigation flights against the already-mounted
  target before the concurrent focus-state render. A matching post-navigation
  fit joins that flight instead of restarting it; **"matching" is doing real
  work there**, and the layout invariants that keep it matching are in
  [guidelines/foundations/motion.md](../guidelines/foundations/motion.md) under "What 'exactly one camera animation per
  intent' rests on". A fit also waits for its target to measure the same size
  on two consecutive frames before it flies, so it never aims at half-grown
  geometry.
- **Input ownership**: pointer streams enter through native capture so a lane
  or cell cannot hide pointerdown with `stopPropagation`. The pure
  `canvasInputPolicy.ts` table documents precedence; continuous transforms stay
  imperative and publish one trailing React snapshot.

What each gesture is *supposed* to do — the click grammar, the touch contract —
is owned by
[guidelines/composition/canvas.md](../guidelines/composition/canvas.md); this
doc owns how it is implemented. Debug a gesture with both open.

## Data flow

Reads go through `useSupabaseQuery` (`src/hooks/useSupabaseQuery.ts`): a
thin wrapper over TanStack Query that returns one discriminated union
(`loading | ready | error`), keyed by string, with a static-fixture
fallback path for no-DB and failed sessions. The cache policy
(`src/lib/queryClient.ts`) is `staleTime: Infinity` — nothing refetches on
its own, because nothing else edits the data. Consequences:

- Every mutation must invalidate, or the screen lies until reload
  ([ADR 0006](../adr/0006-reads-never-refetch-on-their-own.md) is why that
  burden sits on the writer). Call
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

## Error boundaries

`EditorErrorBoundary` (`src/components/EditorErrorBoundary.tsx`) wraps the
whole editor: any recoverable throw in the always-mounted canvas renders a
designed reload surface instead of a white screen, and logs to the
`[editor] uncaught error:` console channel
(see [operations](operations.md#monitoring)). Don't add per-feature
boundaries reflexively — one boundary at the shell is the pattern; add a
narrower one only when a surface can meaningfully continue without the
failed subtree.

One thing sits deliberately **outside** it: `WriteFailureNotices`. A write can
fail as the shell falls over, and the notice is what says so.

## Deferred skeletons

Loading placeholders go through `DeferredSkeleton`
(`src/components/ui/deferred-skeleton.tsx`): a skeleton may only paint
after `SKELETON_HOLD_MS`, so fast loads never flash one. Sessions are
shared by hold key — a waterfall whose stages render from different
components (slice detail → scenario → blueprints) passes one key and shows
exactly one skeleton for the whole chain, no restarts, no replayed fades.
The board-shaped placeholders live in
`src/components/editor/EditorLoadingSkeletons.tsx`, and the entity panels have
their own shaped set (see
[guidelines/composition/entity-panels.md](../guidelines/composition/entity-panels.md)).

## Performance constraints

The board is **always fully mounted**: every phase, scenario, cell, and
arrow, with detail views dimming rather than unmounting. That is a deliberate
trade — [ADR 0004](../adr/0004-the-board-is-always-fully-mounted.md) records
what it buys and what it costs — and it sets the budget for everything added to
the canvas.

The lesson that set the rules (commit `5911a95`): step-visual images
decode to `width × height × 4 bytes` of bitmap **regardless of file
size**. ~450×700px sources across 141 mounted images meant 325 MB of
decoded RGBA — fine on desktop, an OOM tab-kill on mobile Chrome. Hence:

- **300px longest-edge cap** on step-visual assets. They display inside a
  stable 4:3, `object-contain` frame; 300px retains ample high-density
  headroom without paying to decode source-sized art. Downscale before
  committing.
- `loading="lazy"` + `decoding="async"` on every canvas `<img>`
  (`src/components/blueprint/BlueprintStepVisual.tsx`).
- `EditorErrorBoundary` catches recoverable throws with a designed reload
  surface. A true OOM still kills the tab; the cap is the real fix.
- Before adding any always-mounted asset class, estimate its decoded
  memory at full board scale, not its file size.

## Writes, and the schema

No component, context or hook writes to a table. Every DB write goes through the
wrapper layer so it lands in the session ledger with a captured revert — the
write path, its invariants, the wrapper files and the three modules that sit
outside them are owned by
[access-and-security](access-and-security.md#authoring-writes).

The ERD lives at `docs/reference/erd.mmd`; the schema tour and access model are
in the same doc. Anything crossing the repo boundary — the database, the Slack
bot, the deploy — is [`docs/connectors/`](../connectors/overview.md).
