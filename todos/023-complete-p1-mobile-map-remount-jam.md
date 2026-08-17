---
status: complete
priority: p1
issue_id: 023
tags: [code-review, mobile, performance, crash]
dependencies: []
---

# Mobile Map surface remounts 6,319 nodes on every toggle — freezes the app

## Problem Statement

Users report the mobile app "crashing a lot" while navigating. It does not
crash in the exception sense: nothing throws, no error boundary fires, the
console stays empty. The main thread jams, surfaces go blank, and half-built
layers stack on top of each other. Because there is no error, there is no
trace to debug from — which is why this has gone unexplained.

## Findings

Measured live at 375×812 against the dev server:

| Surface | DOM nodes in `<main>` | Cells |
| --- | --- | --- |
| Journey reader | **151** | 11 |
| Map | **6,319** | **669** |

The Map surface renders the *entire* service overview — every phase, every
scenario, 669 cells — on a phone. `key={surface + (selectedScenarioId ?? 'none')}`
([MobileShell.tsx:223](src/components/mobile/MobileShell.tsx:223)) makes every
view toggle a full teardown and rebuild of that 6,319-node tree.

Reproduction (confirmed twice): toggle Journey ⇄ Map about 8 times at ~60ms
intervals. The page stops responding — an injected script with 4.5s of work
exceeded a 30s timeout. A screenshot at that moment shows the agent panel, the
Map canvas, and two top bars rendered simultaneously and translucently on top
of each other. Slow toggling (700ms+ apart) never reproduces it.

Corroborating code review: `EditorShell.tsx:422-429` states the opposite rule
explicitly for desktop — *"Navigation inside the base canvas is a camera move,
not a screen change, so it deliberately keeps the same key."* Mobile
contradicts the documented convention.

**Why the board is unscoped:** `MobileShell.tsx:232` mounts
`<ServiceOverviewView />` with **no props at all** — no `soloScenarioId` — so
the phone renders every phase and every scenario's blueprint panel on one
board. `PhaseScenarioOverview` / `ScenarioBlueprintPanel` have no
virtualization or windowing. Each remount also re-runs
`usePhaseBlueprintFilters` → `useCanvasBlueprints` → `useSupabaseQuery`, the
skeleton, the ResizeObserver, and a fresh fit animation.

Every common gesture triggers it: the Journey/Map buttons, tapping a phase in
the nav sheet (which sets `selectPhase` *and* `setSurface('map')`), tapping a
scenario, and the agent's `selectPhase`/`selectScenario` bridge.

**Failure modes:** the thread jam is CONFIRMED (traced and reproduced). Out-of-
memory is SUSPECTED and would need a device memory profile to close — a true
OOM kills the tab outright rather than showing a fallback, which matches
"blank page / Safari reloaded the tab" reports if any exist.

## Proposed Solutions

**A. Drop `selectedScenarioId` from the key; keep both surfaces mounted.**
Key on `surface` alone (or nothing), hide the inactive surface rather than
unmounting it.
*Pros:* kills the teardown entirely; Map keeps zoom/pan, reader keeps scroll.
*Cons:* both trees stay in memory (~6.5k nodes resident).
*Effort:* Small. *Risk:* Low.

**B. Scope the mobile Map to the selected scenario.**
The phone has no use for all 669 cells at once; render one scenario's grid.
*Pros:* attacks the root magnitude, not just the churn; helps first paint too.
*Cons:* changes what Map *means* on mobile — a product decision.
*Effort:* Medium. *Risk:* Medium.

**C. Both** — scope the Map (B) and stop remounting (A).

## Recommended Action

_(triage)_ — A first as the immediate correctness fix, B evaluated alongside
the nav redesign, since that plan already reconsiders what Map is for.

## Technical Details

- `src/components/mobile/MobileShell.tsx:221-246` — keyed animation container
- `src/components/editor/ServiceOverviewView.tsx` — the 6.3k-node subtree
- Related: `docs/plans/2026-08-16-001-feat-mobile-navigation-model-plan.md` unit 1

## Acceptance Criteria

- [ ] Toggling Journey ⇄ Map 10× rapidly leaves the page responsive
- [ ] Map retains zoom/pan across a toggle; reader retains scroll position
- [ ] No stacked/translucent surfaces at any point during rapid toggling
- [ ] Node count on the mobile Map surface is recorded before/after

## Work Log

- 2026-08-16: Found by live reproduction during mobile nav audit. Measured
  node counts, reproduced the jam twice, captured the stacked-layer state.

## Resources

- Plan: `docs/plans/2026-08-16-001-feat-mobile-navigation-model-plan.md`
