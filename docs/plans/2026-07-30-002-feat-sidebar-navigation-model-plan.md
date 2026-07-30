---
title: "Sidebar navigation & interaction model"
type: feat
status: completed
date: 2026-07-30
---

# Sidebar navigation & interaction model

Plan only — no implementation until Bill signs off. Local doc; not pushed.

Companion to [2026-07-30-001 loading & motion system](./2026-07-30-001-fix-loading-and-motion-system-plan.md);
camera-behavior items that belong to motion are cross-referenced, not duplicated.

## Overview

The sidebar is now the app's primary navigation surface (paths moved into it, slices
grouped by type, blueprints/slices mode toggle). Six user-decided changes need a
coherent interaction model behind them:

1. Remove the **Overview** nav row — Home button / zoom-out is the true overview.
2. **Phase row click = expand accordion + focus canvas on the whole phase** (caret is no
   longer the only expander).
3. **Collapsing never moves the camera** — collapse phase B while scenario S under phase
   A is selected, and the camera stays on S.
4. **Paths hidden until a scenario is selected** (progressive disclosure, not disabled).
5. **Clear selected state** for the active scenario (today it's indistinguishable from
   hover).
6. **Slices-mode parity** — same selection affordance and expand semantics.

A spec-flow analysis of these six against the code found 41 gaps (5 blockers). The
decisions below resolve every blocker; the phases implement them.

## Problem Statement

Today the sidebar carries **ten independent state atoms**, only two of which are coupled,
and the camera is a pure function of one string (`fitKey` in
`ServiceOverviewView.tsx:251` = `view:activeSlideId:counts:selectedPathIds`). That design
produces the specific complaints:

- **Expansion and selection are unrelated.** `openParents` (`SlideNav.tsx:48`) is
  component-local and add-only; it never reflects a phase *selection*, so a phase row
  click today doesn't focus the canvas at all.
- **Selected looks like hovered.** `data-active:bg-sidebar-accent` and
  `hover:bg-sidebar-accent` are the same token (`sidebar.tsx:476,680`), and
  `isActive={isMainActive || childActive}` (`SlideNav.tsx:113`) collapses "this phase is
  selected" and "this phase contains the selection" into one look. This is complaint 5.
- **Camera moves for non-navigational reasons**: every path checkbox (path ids are in
  `fitKey`), every sidebar width animation (ResizeObserver refit,
  `useZoomPanViewport.ts:299-331`), and a fresh mount after leaving a slice tab animates
  from an unfitted origin (pan 0,0 / zoom 1) — a swoop from nowhere.
- **State dies routinely**: `openParents` is destroyed by mode switches, the loading
  skeleton swap, collapsing the Phases section, and any presentation tab (the whole
  `<aside>` unmounts, `EditorShell.tsx:55`).

## Decisions (resolving the blockers)

| # | Decision | Rationale / gap |
|---|---|---|
| **D1** | **Collapse only when the row is BOTH expanded AND already the camera target** (`activeSlideId` is this phase or one of its scenarios). Otherwise the click expands + focuses. | Without this, a phase expanded via caret becomes unfocusable by row click — the user must click twice (blocker 1). |
| **D2** | **Sidebar Home button → `goHome()` (overview canvas)**, not `goLanding()`. The workspace title takes over "go to landing page". | Removing the Overview row would otherwise delete the only sidebar route to the overview canvas — Home currently lands on `Homepage`, which needs a second click to enter the canvas (blocker 8). Matches the user's "for true overview, people click Home or zoom out". **Verified nuance:** Home and Overview were never redundant (`landing` vs `home` view); the real duplicate is the Overview row vs the workspace breadcrumb, and they disagree on feel — the row calls `enterCanvas()` (jump cut, and the flag is sticky so *subsequent* phase focuses also jump), the breadcrumb calls `goHome()` (animated). After D2 every overview return animates identically. |
| **D3** | **Expansion state is explicitly managed and never derived from selection.** No collapse path may call `openDetail`. Multi-open (several phases may be open at once). | Deriving expansion from selection makes every collapse a camera move (blocker 2); single-open would let an unrelated click hide the selected scenario (gap 36). |
| **D4** | **Paths section renders outside the mode tabs** and is hidden only when *both* no scenario is selected *and* at least one path is active. Never hide it while `activePathKeys` is empty. | Hiding on empty selection strands the user: no paths selected → empty canvas → no scenario → section hidden → no path control anywhere (blocker 21). Also unreachable inside the `blueprints` branch when a slice tab forces Slices mode (gap 17). |
| **D5** | **A `?slice=` deep link seeds the base view**: on `resolvePending`, `openDetail(sliceScenarioId)` + expand its phase, without moving the camera of the open tab. | Otherwise a deep-link boot shows an empty sidebar behind the tab, and leaving the tab lands nowhere coherent (blocker 15). |
| **D6** | **ARIA contract**: the phase row is a `<button>` with `aria-expanded` + `aria-current`; the chevron becomes decorative (`aria-hidden`, not focusable). Enter/Space = expand + focus; ArrowRight/ArrowLeft = expand/collapse only (never moves the camera). | Two semantics on one row are otherwise unannounced (blocker 31), and keyboard users need an expand-without-navigating path (gap 32). |
| **D7** | **Path toggles must not move the camera** — drop `selectedPathIds` from `fitKey`. | Not a navigation action; today it discards the user's pan/zoom (gap 9). Lands in the motion plan's Phase 1 (fit-key hygiene). |
| **D8** | **Selection visual language**: selected = accent fill + left rail + medium weight; hover = a lighter token; ancestor-of-selection = marker/dot only. Applied identically in Blueprints and Slices modes. | Fixes complaint 5 and gives Slices mode the parity spec 6 asks for (gaps 33, 38). |

## Technical Approach

### State model (target)

Replace the implicit "`activeSlideId` holds either a phase id or a scenario id" with an
explicit pair, and lift expansion so it survives remounts:

```ts
// src/contexts/EditorContext.tsx (or a new NavStateContext if EditorContext grows unwieldy)
selectedPhaseId: string | null
selectedScenarioId: string | null     // null = the whole phase is the camera target
expandedPhaseIds: Set<string>          // explicit, multi-open, survives mode switches
focusNonce: number                     // bumped on every nav click (see gap 10)
```

- Camera target derives from `selectedScenarioId ?? selectedPhaseId`; `fitKey` becomes
  `view : target : counts : focusNonce` — **no path ids** (D7).
- `focusNonce` makes re-clicking the already-selected row recenter after the user panned
  away (gap 10).
- The add-only auto-expand effect (`SlideNav.tsx:50-56`) keys on `selectedScenarioId`
  alone and never re-opens a phase the user explicitly collapsed (gap 4).

### Interaction matrix

| Action | Expansion | Selection | Camera |
|---|---|---|---|
| Phase row click (collapsed, or expanded-but-not-focused) | expand | phase | **fit phase** |
| Phase row click (expanded AND focused — D1) | collapse | unchanged | **no move** |
| Chevron / ArrowLeft-Right | toggle | unchanged | **no move** |
| Scenario row click | ensure parent expanded | scenario | **fit scenario** |
| Path checkbox | — | — | **no move** (D7) |
| Sidebar mode switch | preserved | preserved | **no move** |
| Sidebar collapse/expand | — | — | **no move** (suppress chrome-driven ResizeObserver refit — gap 12) |
| Slice row click | — | — | opens/activates tab; base camera untouched |
| Sidebar Home | preserved | cleared | **fit overview** (D2) |
| Escape | preserved | cleared styling | fit overview (gap 6) |
| Deep-link restore | expand slice's phase | seed from slice | **no move** on the open tab (D5) |

### Phases

**Phase 1 — State lift & fit-key hygiene** (no visual change)
- Introduce the explicit state above; delete dead `SlideModeMain` first (`SlideModeView.tsx:154-261`, zero importers, carries a divergent second copy of camera wiring — gap 41).
- Remove path ids from `fitKey`; add `focusNonce`; make `skipCanvasFitAnimation` a
  one-shot consumed by the next fit (gap 11); first fit after any mount jumps rather than
  animating (gap 13).
- Acceptance: no camera movement on path toggle, sidebar collapse, or mode switch;
  re-clicking the selected row recenters.

**Phase 2 — Phase-row dual action + ARIA**
- Implement D1's collapse rule and D6's ARIA/keyboard contract; chevron decorative.
- Phases with zero scenarios: no chevron, click = focus only (gap 25).
- Acceptance: click matrix above holds; screen reader announces expanded + current;
  ArrowLeft/Right never moves the camera.

**Phase 3 — Selection visuals & Slices parity**
- New selected/hover/ancestor tokens (D8) in `sidebar.tsx`; distinct "contains selection"
  treatment when a phase is collapsed over the selected scenario (gap 3).
- Slices mode: rows driven by `activeKey`, `aria-current`, open-but-inactive tabs shown
  distinctly; controlled group-open set so creating/deleting a slice doesn't reset
  collapse state (gaps 29, 38).
- Acceptance: at a glance, which scenario is selected and which slice tab is active.

**Phase 4 — Overview removal, Home repoint, Paths disclosure**
- Delete the Overview nav row; repoint Home per D2; move the workspace-title click to
  `goLanding`.
- Paths section relocated outside the mode tabs with D4's visibility rule; skeleton row
  while the catalog is loading so "loading" ≠ "hidden" (gap 28); always mounted expanded
  (gap 23).
- Fix `CanvasEmptyState` copy, which still points at the removed navbar field, and give
  it a CTA that restores the default path (gap 21).
- Acceptance: no dead end reachable with zero paths selected; Paths visible in slice tabs.

**Phase 5 — Deep-link seeding & edge states**
- D5 seeding, applied only if the user hasn't navigated since boot (gap 16).
- Deleted-scenario-while-selected → `view='home'` + cleared selection instead of a silent
  jump to an unrelated phase (gap 27).
- Empty states: no phases, phase with no scenarios, empty slice groups (gaps 25, 26, 30);
  toast for a deep link to a deleted slice (gap 18).

## Scope boundaries
- Browser Back stays out of scope (URL uses `replaceState` only; gap 14) — state it, don't fix it.
- Presentation tabs unmount the sidebar; specs 4/5 explicitly don't apply there (gap 24).
- Slice tabs remain remount-on-activate (camera/dim state not preserved) — documented, not fixed (gap 20).
- Whether phase/scenario selection joins the URL is deferred (gap 40).

## Acceptance Criteria
- [ ] Every row of the interaction matrix verified by hand in the browser.
- [ ] Collapsing any phase while a scenario elsewhere is selected produces zero camera movement (instrumented count on `animateTransform`).
- [ ] Selected scenario is unambiguous at a glance in both modes; hover never reads as selected.
- [ ] No reachable state where paths are all off and no path control is visible.
- [ ] `?slice=` boot leaves a coherent sidebar; closing the tab lands on that slice's scenario.
- [ ] Keyboard: Enter/Space navigates, arrows expand only, focus visible, selected row scrolled into view (gap 35).
- [ ] `tsc -b`, `vite build` green; lint ≤ current baseline.

## Dependencies & Risks
- Phase 1 overlaps the motion plan's camera work — land motion Phase 1 first or together;
  both touch `fitKey`/`useZoomPanViewport`.
- `sidebar.tsx` token changes affect every sidebar consumer — verify the base view and
  collapsed rail, not just the new sections.
- Reduced-motion: fit animation currently ignores `prefers-reduced-motion` (gap 35) —
  handle in the motion plan.

## Sources
- Spec-flow gap analysis (in-session, 2026-07-30): 41 gaps with file:line evidence; blockers 1, 8, 15, 21, 31/36 resolved as D1–D6 above.
- User feedback round 5 (2026-07-30): the six spec items.
- Files: `SlideNav.tsx`, `SlideModeView.tsx`, `PathsSidebarSection.tsx`, `SlicesSidebarSection.tsx`, `EditorShell.tsx`, `EditorContext.tsx`, `ServiceOverviewView.tsx`, `ui/sidebar.tsx`.
