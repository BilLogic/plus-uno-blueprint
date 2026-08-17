---
title: 'feat: Trigger-line anatomy — one routing contract for every arrow situation'
type: feat
status: active
date: 2026-08-17
---

# Trigger-Line Anatomy — one routing contract for every arrow situation

## Overview

The trigger arrows grew case by case (forward runs, wrap corridors, in-lane
loops, merged-view remaps), and the seams show: an inbound head and an
outbound tail can share one edge point, runs strike through cell faces
(mitigated 2026-08-17 by putting the forward layer under the cells — a
paint fix, not a routing fix), and two different sources converging on one
target stack two heads. This plan defines ONE anchor-and-routing contract,
prototyped against an enumerated situation catalog, so every future arrow
case is a table lookup instead of a new special case.

## Problem Statement

- **In/out collision.** A cell's inbound arrow and outbound arrow can both
  anchor at the same edge midpoint. Reading direction from the drawing is
  impossible at a glance ("is this one line passing through, or an in and
  an out?").
- **Runs behind cells.** Lines that cross a cell now tuck behind it. Honest
  paint, but the reader loses the line; routing should prefer the column
  gaps and lane gutters so lines rarely need to hide.
- **Converging heads.** N sources → one target draws N heads side by side
  at one edge. They should merge into a shared trunk with one head (a
  "confluence"), or fan into clearly separated anchor slots.
- **No shared vocabulary.** Stacked, merged, and single-path views each
  restate routing rules; the merged remap added aliasing on top. Nothing
  states the full set of situations the router must handle.

## Proposed Solution

### 1. Anchor slots, not edge midpoints

Every cell edge exposes ordered anchor SLOTS (lo-fi, cell seen from above):

```
            in₁   in₂
             ▼     ▼
        ┌────┬─────┬────┐
  in ──▶│    │           │──▶ out
        │    │   CELL    │
  out ◀─│    │           │◀── in
        └────┴─────┴────┘
             ▲     │
            in₃   out₁
```

Rules:
- **Inbound and outbound never share a slot or a side-adjacent pair.**
  Default assignment: OUT leaves from the side facing the target's column
  (right for forward, left for backward); IN arrives on the side facing
  the source. When both would claim one side (loop back into a neighbor),
  the OUT slides to the top/bottom slot of that side — separation is the
  invariant, side preference is the tiebreak.
- Slots are allocated deterministically from the trigger list (sorted by
  target column, then path order), so the same data always draws the same
  picture.

### 2. Confluence: many-to-one merges into one head

When ≥2 triggers share a TARGET cell and arrive from the same side, their
last segments merge into a trunk:

```
  A ────┐
        ├────▶ [ TARGET ]      not      A ────▶ [ TARGET ]
  B ────┘                               B ────▶ [ TARGET ]
```

- Merge only same-side arrivals; opposite-side arrivals keep their own head.
- The trunk wears the shared color when all members share a path, else the
  neutral stroke with per-branch colors up to the junction.
- (The merged view's exact-duplicate dedupe from 2026-08-17 is the trivial
  case of this — identical (source, target) edges — and stays.)

### 3. Route through gaps first

Priority order for a run's corridor:
1. The column gap between the source and target columns.
2. The lane gutter (the divider-row bands).
3. The wrap corridors above/below rows (existing).
4. Only then a straight run that may pass behind cells.

### 4. The situation catalog (the prototype's spine)

A fixture blueprint containing every case, one per column pair, becomes
both the visual prototype page and the regression fixture:

| # | Situation | Today | Contract |
|---|-----------|-------|----------|
| S1 | Forward, adjacent column | ok | unchanged |
| S2 | Forward, skip ≥1 column | strikes through cells | route via column gaps |
| S3 | Backward (loop) within a lane | in-lane corridor | unchanged, but OUT/IN separated per §1 |
| S4 | Cross-lane, downward | ok | unchanged |
| S5 | Cross-lane, upward | wrap corridor | unchanged |
| S6 | In + out on ONE cell, same side | overlapping at one point | slot separation (§1) |
| S7 | N sources → one target, same side | N stacked heads | confluence (§2) |
| S8 | One source → N targets | N separate lines | shared trunk that fans (§2 mirrored) |
| S9 | Merged view: aliased endpoints (subset-shared cells) | dedupe of identical edges | unchanged + confluence for non-identical |
| S10 | Chain A→B→C where B is both target and source | B's in/out can collide | §1 slots on B |

### 5. Prototype before wiring

Build the catalog as a standalone route (`/proto/arrows`, dev-only) that
renders the fixture blueprint through the REAL `IntegratedTriggerArrows`
with the new router behind a flag. Sign-off happens on that page — every
S# eyeballed — before the flag flips on for the app.

## Implementation Phases

### Phase 1 — Catalog + prototype page
- Fixture blueprint data covering S1–S10 (pure data, no DB).
- Dev-only route rendering each situation labeled.
- Verification: page shows today's behavior — the "before" record.

### Phase 2 — Anchor-slot allocator
- Pure lib (`arrowAnchorSlots.ts`): (triggers, cell geometry) → slot per
  endpoint, with the §1 invariants. Unit tests per S#.
- Router consumes slots instead of edge midpoints.
- Verification: S6/S10 show separated in/out on the prototype page.

### Phase 3 — Confluence
- Pure lib merge pass over routed polylines sharing a target slot.
- Verification: S7/S8 show single trunk + one head.

### Phase 4 — Gap-first corridors
- Route scoring that prefers §3's corridor order; keep the z-0 tuck as the
  final fallback.
- Verification: S2 runs ride the gaps; zero strike-throughs in catalog.

### Phase 5 — Flip + regression
- Enable in app views (stacked, merged, single, slices, mobile).
- Screenshot the catalog per view as the regression baseline.

## Scope Boundaries

- No new arrow KINDS (no orthogonal-only rewrite, no curved splines).
- Fold/pleat arrow dropping stays as is.
- Performance envelope: allocator + confluence must stay O(triggers·log)
  per band; no per-frame recomputation beyond today's observer setup.

## Acceptance Criteria

- [ ] No inbound and outbound anchor share a slot on any catalog cell.
- [ ] Same-side multi-arrivals draw exactly one head.
- [ ] No catalog run crosses a cell face when a gap route exists.
- [ ] Same data → same drawing (deterministic slot order).
- [ ] All existing arrow tests + 359-suite green; new per-S# unit tests.

## Sources

- `src/components/blueprint/IntegratedTriggerArrows.tsx` (current router)
- `src/lib/blueprintArrowGeometry.ts` (geometry helpers)
- `src/lib/compareMergedGrid.ts` (merged remap/dedupe — the S9 baseline)
- User review 2026-08-17: in/out separation, one-head merges, lines behind
  blocks.
