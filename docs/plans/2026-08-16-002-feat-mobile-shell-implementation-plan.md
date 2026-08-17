---
title: "feat: mobile shell implementation — menu-driven surfaces, agent workspace, crash fixes"
type: feat
status: active
date: 2026-08-16
origin: docs/plans/2026-08-16-001-feat-mobile-navigation-model-plan.md
---

# Mobile shell implementation

Implements the navigation model from
[plan 001](2026-08-16-001-feat-mobile-navigation-model-plan.md) as validated by
the v3 prototype, together with the four P1 crash fixes the model depends on.

## Overview

The mobile shell has two problems that turn out to be one problem. It navigates
badly — a bottom tab bar holding a view mode, the real hierarchy hidden behind a
hamburger, a third copy of that hierarchy rendered in-content. And it freezes —
because every one of those navigation gestures tears down and rebuilds a
6,319-node tree.

**The redesign is the crash fix.** Scoping navigation scopes rendering. Once
tapping a phase means "show me this phase" and tapping a scenario means "walk me
through this scenario," the mobile Map never has cause to render all 669 cells
of the whole board again. The expensive surface stops existing rather than
getting optimised.

## Problem statement

### Measured, on the running app at 375×812

| Surface | DOM nodes in `<main>` | Cells |
| --- | --- | --- |
| Journey reader | 151 | 11 |
| Map | **6,319** | **669** |

`MobileShell.tsx:232` mounts `<ServiceOverviewView />` **with no props** — no
`soloScenarioId` — so a phone renders every phase and every scenario's blueprint
panel on one board, unvirtualized. `key={surface + (selectedScenarioId ?? 'none')}`
([MobileShell.tsx:223](../../src/components/mobile/MobileShell.tsx)) rebuilds all
of it on every surface toggle, phase tap, scenario tap, and agent-driven
navigation.

Toggling faster than a rebuild completes saturates the main thread: an injected
script with 4.5 s of work exceeded a 30 s timeout, the content area went blank,
and a screenshot caught the agent panel, the Map canvas, and two top bars
rendered translucently on top of each other. **Nothing throws**, so no error
boundary fires and the console stays empty — which is why this has read as "the
app crashes a lot" with nothing to debug.

### The amplifier

`EditorErrorBoundary` ([src/components/EditorErrorBoundary.tsx:29-52](../../src/components/EditorErrorBoundary.tsx))
sets `state.error` and has no path back — no reset key, no router to remount on
navigation, only a manual `window.location.reload()`. It is mounted *above*
`EditorShell` ([src/App.tsx:28](../../src/App.tsx)), so it replaces the entire
app including the chrome. Any single recoverable throw becomes indistinguishable
from a hard crash.

### The navigation defects

1. Two controllers fight over one state: the tabs set the view, then the drawer
   silently overrides it (`selectPhase` forces Map at `MobileShell.tsx:331`,
   `openScenario` forces Journey at `:161`).
2. The in-content journey index is unreachable after the first navigation —
   nothing ever clears `selectedScenarioId` (neither `clearSelection` nor
   `goHome` is imported).
3. The ⋯ overflow menu contains exactly one permanently disabled item.
4. The agent has two entry points (top bar ✦ and bottom "Ask"), and "Ask" sits
   inside `<nav aria-label="Primary">` while not being navigation.
5. ~100 px of permanent chrome (48 top + ~52 bottom with safe area).
6. Agent-driven navigation lands behind a sheet covering 92% of the viewport.
7. The mobile Map has **no reachable reset/fit control** — its two mount
   conditions in `ServiceOverviewView.tsx:400-404` are mutually exclusive — so
   rotating after a pinch strands the board, recoverable only by toggling
   surfaces (which works by accident, via the remount).

## Proposed solution

One persistent bar, one collapsible menu, one floating action.

```
┌──────────────────────────────────┐
│ ☰   Standard Scheduling     [⛶]  │  menu(☰⇄✕) · breadcrumb · fit (map only)
│     03 · PRE-SESSION             │
├──────────────────────────────────┤
│         content surface          │  phase → map · scenario → reader
│                            ╭───╮ │
│                            │ ✦ │ │  agent FAB → full session workspace
└────────────────────────────╰───╯─┘
```

### The surface rule

| You tapped | You get | Renders |
| --- | --- | --- |
| A phase heading | Map | That phase's scenarios only |
| A scenario | Reader | That one scenario, linear |
| A slice | Presentation | Full-bleed, unchanged |

The Map's job narrows to "this stretch of the service." **No mobile surface
renders the whole board.** That single decision removes the 6,319-node render,
and it falls out of the navigation model rather than being bolted on.

### Prototype

Validated interactively (menu open/close with the ☰⇄✕ transition, rail surface
swap, phase-vs-scenario routing, agent session list ⇄ conversation, rename,
filter, fit control): the v3 prototype published for this plan. All copy,
structure, and interaction in the phases below match it.

## Technical approach

### Phase 0 — Stop the bleeding (independent, ship first)

No design dependency; both are pure fixes and make everything after them
debuggable.

- **Error boundary recovers** ([todo 028](../../todos/028-pending-p1-error-boundary-never-resets.md)):
  accept a `resetKey` prop, clear `error` when it changes, move the boundary
  inside the shell so the chrome survives, add a "Try again" that doesn't
  discard the agent session, and log when it fires.
- **Deep-link poll stops ambushing** ([todo 024](../../todos/024-pending-p1-deep-link-poll-ambush.md)):
  bail when `selectedScenarioId !== scenarioId`, latch `openedRef` on *success*
  rather than on attempt, and add a wall-clock budget (~3 s after the scenario
  appears) instead of the current 10 s.

### Phase 1 — Make the surfaces cheap (prerequisite for everything after)

- Pass `soloScenarioId` / phase scoping to `ServiceOverviewView` so the mobile
  Map renders one phase, never the board.
- Drop `selectedScenarioId` from the animation key; let the canvas re-fit via
  its existing `resetKey`/`fitKey` rather than remounting. Desktop already
  documents this rule — *"Navigation inside the base canvas is a camera move,
  not a screen change, so it deliberately keeps the same key"*
  ([EditorShell.tsx:422-429](../../src/components/editor/EditorShell.tsx)).
- Keep both surfaces mounted, one hidden, so Map keeps zoom/pan and the reader
  keeps scroll position across navigation.

**Verification gate:** node count on the mobile Map surface recorded before and
after; rapid navigation for 10 s leaves the page responsive; no stacked
surfaces at any point.

### Phase 2 — Seams before surgery

`MobileShell` is 456 lines holding six independent state machines. Extract
before redesigning, so Phase 3 is a component swap rather than surgery on the
middle of a long function:

- `MobileTopBar.tsx` — menu toggle, breadcrumb, contextual fit control
- `MobileNavDrawer.tsx` — rail + panel
- `MobileAgentSheet.tsx` — FAB, sheet, session views
- `useMobileSliceDeepLink()` — or delete it entirely under Phase 4

Add the render tests that do not exist today (**zero** tests reference
`MobileShell`, `MobileScenarioReader`, or `isMobileViewport`, against ~324
vitest tests elsewhere). Pin what the redesign keeps true: nav routing, the
`?slice=` boot path, the four agent-bridge handlers, and the read-only tiers.

### Phase 3 — The new navigation model

- Delete the bottom `<nav>`; retire `MobileJourneyIndex` (the drawer is the
  index, and first load with nothing selected opens the drawer).
- Menu button becomes stateful: ☰ rotates to ✕ while open, closes on tap,
  `aria-expanded` and label follow. Honour `prefers-reduced-motion`.
- Drawer carries the desktop rail vocabulary — Blueprints ◫ / Slices ◇, matching
  `EditorRail`'s `SidebarSurface` set — with the light/dark control at the foot
  of the rail.
- Delete the ⋯ overflow menu.
- Top-right holds the **path selector** (decided 2026-08-16): mobile reads one
  path at a time, and the control that picks it belongs in the top bar rather
  than as a chip row inside the reader's scroll. The reader already maintains
  per-path state (`MobileScenarioReader.tsx:227` `pathId`) — this lifts the
  existing selection into the shell chrome, it does not invent a new mode.
  - Compact control: current path name as a tappable pill; tap opens a small
    menu of the scenario's paths (they are few — happy/unhappy/exception).
  - **Default rule:** the last path the user viewed for that scenario
    (persisted per scenario in `localStorage`), falling back to the happy
    path on first visit.
  - The Map surface honours the same selection where it applies; the
    selector hides on surfaces with no path dimension.
- The map's **Fit to screen** control shares the right slot, rendered only on
  the map, fixing the unreachable-reset defect.
- Navigation no longer forces a surface as a side effect; the surface follows
  from *what kind of thing* was tapped.
- Route nav through the shared helpers (`getMainSlides` / `getSubslides`) and
  drive expansion off the existing `expandedPhaseIds` / `setPhaseExpanded` on
  `EditorContext` rather than rendering every phase always-expanded.

### Phase 4 — Agent workspace

Mirror the desktop panel, which is explicitly two views — *"Step 1 picks (or
creates) a session; step 2 is the chat, full height"*
([AgentPanel.tsx:207-210](../../src/components/editor/AgentPanel.tsx)):

- FAB bottom-right, above the safe-area inset, hidden when `canAgent` is false.
- Sheet at ~88% height. Header uses a **back chevron**, not a second hamburger —
  two stacked bars with the same glyph made the top nav read as redundant.
- Session list: grouped by recency, message counts, name filter, **+ new**.
- Conversation: in-place editable title (*"auto-names are a default, not a
  decision"*), back to list, composer.
- Panel view state lives in the shared store (`useOpenAgentSessionId`), not in
  component state — desktop keeps it outside the component precisely so
  unmounting the panel doesn't drop you back to the list.
- Bridge handlers close the sheet before navigating, so an agent-driven jump is
  visible rather than landing behind an opaque surface.
- Fold in [todo 025](../../todos/025-pending-p1-boot-slice-derived-from-query.md):
  replace the four-atom boot-slice latch with the store as single source of
  truth, and surface `missingSliceId` on mobile (today a dead uno-bot link
  silently does nothing on the shell where those links mostly open).

### Phase 5 — Polish

Touch targets to 44 px (theme toggle is 28 px, slice rows ~34 px, reader path
chips 32 px); reader cell sheet stores an id and derives the cell rather than
snapshotting it; `agentSetSidebar` reports honestly instead of claiming success
against a no-op stub; group semantics for the slices list and nested list markup
in the drawer.

## Alternatives considered

- **Keep the toggle, make it authoritative.** Rejected: the menu selection
  already expresses the same intent, so the second control asks a question the
  user just answered. Removing it eliminates the two-controllers bug by
  construction rather than by arbitration.
- **Virtualize the whole-board Map.** Rejected as the primary fix: it optimises a
  view that has no job on a phone. Scoping is simpler and falls out of the
  navigation model. (Virtualization stays available if phase-scoped boards grow.)
- **Slice ⇄ blueprint as the toggle.** Considered and set aside: a slice is not a
  view *of the current scenario* but a separate object that can span several, so
  it belongs beside Blueprints in the rail. Revisit if usage shows people live
  in slices on mobile.
- **Compact agent card instead of a sheet.** Rejected after review: the agent
  needs session management — new, switch, continue — which a third-of-a-screen
  card cannot hold.
- **A persistent 48 px rail, as on desktop.** Rejected: 13% of a 375 px width for
  navigation the user is not currently doing. The rail lives inside the drawer;
  "collapsed" on a phone means closed.

## System-wide impact

**Interaction graph.** A surface change today remounts `VisualWalkthroughShell` →
`ServiceOverviewView` → `ZoomPanViewport` → `CanvasAnnotationProvider` /
`CanvasSelectionProvider`, re-running `usePhaseBlueprintFilters` →
`useCanvasBlueprints` → `useSupabaseQuery`, plus a ResizeObserver and a fresh fit
animation, and re-registering four module-level registries
(`registerAgentUiBridge`, `registerAgentUiContext`, `registerFocusCells`,
`registerAgentUiCommand`). After Phase 1 that chain runs on genuine scenario
changes only. The registries are correctly identity-guarded, so the churn is a
cost rather than a correctness bug — but it is the cost that jams the thread.

**Error propagation.** Phase 0 changes a thrown error from "app is dead until
manual reload" to "this surface failed; navigate away and back." Errors inside
the agent sheet should not take down the shell — scope a boundary to the sheet.

**State lifecycle.** The boot-slice latch and the store can currently disagree
about what is presenting; crossing 768 px then mounts the desktop shell into a
presentation the user already dismissed. Phase 4 collapses them to one source.

**API surface parity.** `AgentUiBridge` should make `setSidebarCollapsed`
optional rather than stubbed, so `agentSetSidebar` can report truthfully on
surfaces with no sidebar — the same verify-don't-assume rule `agentOpenCellPanel`
already follows.

**Integration scenarios** (cross-layer; mocked unit tests would miss all five):

1. Rapid phase → scenario → phase navigation for 10 s: page stays responsive, no
   stacked surfaces, agent bridge registered exactly once at rest.
2. `?cell=` boot on a throttled network, user navigates before it resolves: no
   panel hijack, no scroll jump.
3. `?slice=` boot, then offline/online cycle mid-presentation: no unmount, no
   restart at frame 1.
4. Ask the agent to navigate while the sheet is open: sheet closes, target
   visible, no claim of success without the move.
5. Throw inside the reader: chrome survives, navigating clears the fallback,
   agent session intact.

## Acceptance criteria

### Functional

- [ ] Tapping a phase opens the map scoped to that phase; tapping a scenario
      opens the reader; neither overrides a choice the user just made
- [ ] No mobile surface renders more than one phase of cells
- [ ] Map retains zoom/pan and the reader retains scroll across navigation
- [ ] ☰ shows open/closed state, animates between them, and closes on tap
- [ ] Fit control reachable on the map; rotation no longer strands the board
- [ ] Bottom tab bar, view toggle, ⋯ menu, and in-content index are gone
- [ ] Light/dark lives at the foot of the rail
- [ ] FAB opens a sheet supporting: new session, switch session, continue,
      rename, filter — reachable in ≤2 taps from the conversation
- [ ] Agent-driven navigation is visible, not hidden behind the sheet
- [ ] A thrown error leaves the chrome usable and clears on navigation

### Non-functional

- [ ] Rapid navigation for 10 s leaves the main thread responsive
- [ ] All nav targets ≥44 px
- [ ] `prefers-reduced-motion` respected for the menu and drawer transitions
- [ ] Mobile stays view-only; no editing affordances appear

### Quality gates

- [ ] Render tests cover nav routing, `?slice=` boot, the four bridge handlers,
      and the read-only tiers
- [ ] `npx tsc -p tsconfig.app.json --noEmit` and eslint clean
- [ ] Before/after DOM node counts recorded in the PR

## Deferred to implementation

- **Does the phase-scoped Map need a "whole service" affordance at all?** The
  drawer arguably is it. Decide after Phase 3 rather than building one
  speculatively.
- **Where the journey index goes** once `MobileJourneyIndex` retires — the drawer
  on first load is the plan, but confirm it feels right when nothing is selected
  mid-session.
- **Sheet drag-to-full-height** — whether 88% plus scroll is enough, or a real
  drag gesture earns its complexity.
- **Scoping a boundary to the agent sheet** vs. one boundary inside the shell.

## Scope boundaries

- Mobile stays **view-only**. No editing arrives with this.
- Desktop chrome is untouched; only its vocabulary is borrowed.
- Slice presentation stays full-bleed (already phone-shaped).
- The desktop text-bleed fix ([todo 026](../../todos/026-pending-p1-desktop-cell-text-bleed.md))
  is a separate track and does not block this.

## Risks

| Risk | Mitigation |
| --- | --- |
| Refactoring an untested 456-line component | Phase 2 adds tests before Phase 3 touches structure |
| Removing the whole-board Map surprises someone | It is unusable at 375 px today; the drawer covers "where am I in the service" |
| Two change classes at once (fixes + redesign) | Phase ordering: fixes land and ship before restructuring |
| Boot-slice work collides with Phase 4 | Fold 025 into Phase 4 rather than fixing it twice |

## Sources & references

- **Origin:** [plan 001](2026-08-16-001-feat-mobile-navigation-model-plan.md) —
  carried forward: journey/map is a view not a destination; the menu mirrors the
  desktop rail; the agent leaves the tab bar. Superseded there: the view toggle,
  removed in v3 as redundant with the menu.
- Findings: todos [023](../../todos/023-pending-p1-mobile-map-remount-jam.md),
  [024](../../todos/024-pending-p1-deep-link-poll-ambush.md),
  [025](../../todos/025-pending-p1-boot-slice-derived-from-query.md),
  [027](../../todos/027-pending-p2-mobile-shell-correctness-and-a11y.md),
  [028](../../todos/028-pending-p1-error-boundary-never-resets.md)
- Desktop precedent: `EditorRail.tsx` (rail surfaces), `EditorShell.tsx:89,422-429`
  (collapse + camera-move rule), `AgentPanel.tsx:207-210,395-430,860-880`
  (two-view session model, filter, rename)
