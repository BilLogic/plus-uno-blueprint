---
title: 'feat: every tech touchpoint its own cell'
type: feat
status: active
date: 2026-08-04
---

# Every tech touchpoint its own cell

## Problem

Front/Back Stage Tech cells store several touchpoints in one `cells` row
(content split on newline/comma into pills). Everything downstream keys on
`cell_id`, so the bundle is indivisible: picking one pill picks them all, a
slice cannot hold a subset, badges duplicate, and the detail panel needs a
parallel `techItem` code path that keeps breaking. The fix is identity:
one touchpoint, one row.

## Why it is staged (each stage leaves the app green)

The wall is `cells_layer_step_unique (layer_id, step_id)` — one cell per
slot — which `upsert_cell`'s `on conflict` target and every grid's
`Map<'layer:step', cell>` lookup assume. Splitting data before the renderer
accepts siblings would show one pill where three were; changing the schema
before the data is split would be invisible. Order matters:

1. **Render plural** (no behavior change today): `buildCellLookup` returns
   lists; pill lanes render every cell in the slot, each cell's content
   still parsed to pills (legacy multi-item cells keep working). Heights sum
   per slot.
2. **Schema**: add `slot_position int not null default 0`; replace the
   unique constraint with `(layer_id, step_id, slot_position)`; `upsert_cell`
   keeps its contract by targeting slot 0; `cell_key` minting gains a
   `-<position+1>` suffix for positions > 0.
3. **Data**: split every multi-item tech cell — original row keeps item 1
   (ids, arrows, slices, evidence, storyboards stay attached to it),
   siblings created for the rest at positions 1..n. Recorded caveat: a slice
   or arrow that meant "the bundle" now means its first touchpoint.
4. **Retire special cases**: pill pick/badge/panel paths lose their
   shared-id workarounds; todo 006 dissolves; lane insert handles ride on
   the same grid pass.

## Acceptance

- [ ] Stage 1 ships with zero visual diff on Discovery
- [ ] After stage 3: clicking one pill picks exactly one touchpoint; a slice
      can hold Slack without Email; badges appear once per touchpoint
- [ ] `upsert_cell` on an empty slot still creates and on slot 0 still updates
- [ ] 74+ tests stay green; new tests for key suffixing and slot summing
