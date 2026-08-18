---
audience: designers, developers
summary: The breakpoint contract (this doc is its single owner) — the 768px gate, the view-only desktop-parity mobile shell, tablet stance, semantic zoom, and the deliberate non-goals.
sources: src/hooks/useMobileShell.ts, src/components/mobile/MobileShell.tsx, src/components/mobile/MobileNavSheet.tsx, src/components/mobile/MobilePathSelector.tsx, docs/plans/2026-08-16-002-feat-mobile-shell-implementation-plan.md
last-reviewed: 2026-08-18
---

# Responsive

**This doc owns breakpoints.** Layout, components, and engineering docs link
here; none of them may declare their own thresholds.

## The contract: one gate

One breakpoint, one source of truth: `MOBILE_SHELL_QUERY` in
`src/hooks/useMobileShell.ts` (`max-width: 767px`, i.e. a 768px gate), read
through `useMobileShell()`. The check is synchronous (`matchMedia` via
`useSyncExternalStore`) so a phone never paints the desktop tree for even one
frame. The shell forks exactly once on it — below the gate the mobile shell
renders; at or above it, the desktop shell, byte-for-byte the same tree as
before the mobile work. There is no second breakpoint and no per-component
media-query improvisation; a surface that wants to behave differently by
width goes through this gate or argues a contract change here. (The shadcn
`useIsMobile` in `src/hooks/use-mobile.ts` survives only inside the ui
sidebar primitive; app code uses `useMobileShell`.)

## Below 768 — the mobile shell

The phone shows the **same canvas as desktop** — there is no mobile-specific
reading view. An earlier vertical "reader" existed and was deleted in the
2026-08-17 redesign; the shipped model is desktop parity, scoped:

- **View-only for every tier**, including service accounts — the same
  experience site visitors get. No design mode, no cell editing, no structure
  writes; the agent is present (for tiers that have it) but limited to the
  reading toolset. This is a UX gate — the server's RPC tiers remain the real
  wall.
- **One surface: the shared canvas, scoped to the selected phase.** The phone
  renders one stretch of the service rather than the whole board (rendering
  the whole board is what used to jam the main thread). Navigation is a
  camera move on that canvas — picking a scenario in the drawer frames it;
  there is no view toggle and no fold animation.
- **Chrome:** `MobileTopBar` (menu · title · contextual right slot) up top;
  `MobileNavSheet` — a left sheet holding a rail + panel, the same IA and
  `NavRow` components as the desktop sidebar, with Blueprints/Slices surfaces
  and the theme toggle at the rail's foot — as the index. It opens on first
  load when nothing is selected. Phase rows are pure accordion headers;
  only scenarios (and slices) navigate.
- **Paths are single-select.** The top-bar pill (`MobilePathSelector`) picks
  exactly one path through the same PathSelection context the desktop PATHS
  checkboxes drive, defaulting to the last-viewed path per scenario
  (localStorage) or the happy path. A one-path scenario shows a read-only
  chip instead of a menu.
- **The touch canvas is the real `ZoomPanViewport`** under the
  [touch contract](interaction.md#the-touch-contract): slop-gated pending
  pan, tap-to-open, two-finger pinch (with mid-gesture rebase), ghost-pointer
  reset, trailing-click swallow.
- **Reset View** is a mobile-only affordance — bottom-centered under the
  thumb (no scroll wheel, easy to lose the canvas). Desktop has no Reset
  View; double-click/Home reframe there.
- **Sheets replace side panels:** the agent opens from a floating action
  button into a 60svh bottom sheet; cell detail is a bottom sheet
  ([components](components.md) owns the posture contract); slices are
  viewable read-only, with presentation as a full-screen takeover.
- **44px touch targets** throughout (`size-11` pattern —
  [iconography](foundations/iconography.md)).

## At and above 768 — desktop, tablets included

Tablets get the full desktop shell, **editing included** — the view-only rule
binds to the mobile shell, not to touch. Portrait tablet is tight and that is
accepted; the sidebar collapses to its rail and the resizable widths absorb
the rest. No intermediate tablet layout exists, deliberately: a third shell
would triple every layout decision for one middling viewport.

## Semantic zoom

Width is not the only axis that changes rendering — zoom is the other.
Below `SEMANTIC_ZOOM_THRESHOLD` (0.25, owned by `useZoomPanViewport.ts`) the
board drops to the **blocks tier**: flat blocks + counter-scaled phase badges
(counter-scale capped at 10× so a deep zoom-out cannot detach a badge from
its frame), the overview as density map
([data-viz](foundations/data-viz.md)). One implementation serves phone and
desktop alike.

## Non-goals — deliberate, not deferred

- **No mobile authoring.** Decided, not pending: mobile is view-only for all
  tiers, and design mode simply does not exist below the gate (absent, never
  disabled).
- **No mobile-specific reading view.** Tried, shipped, deleted (2026-08-17):
  the maintained answer is one canvas with a phase-scoped camera, not a
  second rendering of the board.
- **No PWA / offline / install.**
- Compare v3 on mobile is a filed follow-up, not a silent gap — the cockpit
  is its own responsive problem.
