---
audience: designers, developers
summary: The breakpoint contract (this doc is its single owner) — the 768px gate, the view-only mobile shell with reader and Map, tablet stance, semantic zoom, and the deliberate non-goals.
sources: src/hooks/use-mobile.ts, src/components/mobile/MobileShell.tsx, src/components/mobile/MobileScenarioReader.tsx, docs/plans/2026-08-08-001-feat-mobile-responsive-blueprint-plan.md
last-reviewed: 2026-08-08
---

# Responsive

**This doc owns breakpoints.** Layout, components, and engineering docs link
here; none of them may declare their own thresholds.

## The contract: one gate

One breakpoint, one source of truth: `MOBILE_BREAKPOINT` in
`src/hooks/use-mobile.ts` (768px), read through `useIsMobile()`. The shell
forks exactly once on it — below the gate the mobile shell renders; at or
above it, the desktop shell, byte-for-byte the same tree as before the mobile
work. There is no second breakpoint and no per-component media-query
improvisation; a surface that wants to behave differently by width goes
through this gate or argues a contract change here.

## Below 768 — the mobile shell

The phone gets its own reading grammar, not a shrunken desktop:

- **View-only for every tier**, including service accounts — the same
  experience site visitors get. No design mode, no cell editing, no structure
  writes; the agent is present but limited to the reading toolset. This is a
  UX gate (the server's RPC tiers remain the real wall), and the capability
  stays discoverable via copy — "Editing is available on desktop."
- **The reader is the default.** The 2-D board folds into a 1-D vertical
  journey: time becomes scroll, lanes survive inside each step as bands split
  by the line-of-visibility rule, trigger arrows become vertical connectors.
  Sticky step eyebrows carry the time-marker register
  ([typography](foundations/typography.md)).
- **Map is opt-in.** The real touch canvas (one finger pans, two pinch — the
  [touch contract](interaction.md#the-touch-contract)) behind an explicit
  toggle; **the reader⇄Map fold** is the mobile signature: the board visibly
  folds into the journey and unfolds back, on the pinned motion vocabulary,
  cross-fading under reduced motion.
- **Sheets and bottom drawers** replace side panels: nav in a left sheet,
  agent full-screen, cell detail as a bottom sheet with snap points
  ([components](components.md) owns the posture contract).
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
Below `SEMANTIC_ZOOM_THRESHOLD` (≈0.35, owned by `useZoomPanViewport.ts`) the
board drops to the **blocks tier**: flat blocks + counter-scaled phase labels,
the overview as density map ([data-viz](foundations/data-viz.md)). The blocks
tier is also the miniature the mobile fold animates from — one implementation
serves both.

## Non-goals — deliberate, not deferred

- **No mobile authoring.** Decided, not pending: mobile is view-only for all
  tiers, and design mode simply does not exist below the gate (absent, never
  disabled).
- **No PWA / offline / install.**
- Compare v3 on mobile is a filed follow-up, not a silent gap — the cockpit
  is its own responsive problem.
