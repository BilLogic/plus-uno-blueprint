---
date: 2026-08-19
topic: stable-blueprint-cell-frames
---

# Stable blueprint cell frames

## What We're Building

One stable canvas footprint for each cell family so semantic zoom reveals
detail without changing geometry:

- storyboard cells use the full 192px data-column width in a 4:3 frame at
  every zoom tier;
- narrative cells use a fixed-height, four-line canvas preview;
- technology/system cells stack fixed-height pills with at most two visible
  label lines;
- overview and focused states render the identical grid, including both
  header axes and the same path-frame boundary.

Complete content remains available in the cell detail panel, accessibility
name, database, and agent tools.

## Why This Approach

The current row estimator sizes narrative lanes from the longest cell, while
storyboard images use their intrinsic aspect ratios and technology pills can
grow beyond the height assumed by the row math. Those three independent
content measurements make a semantic-detail change look like the blueprint is
reflowing even when the outer grid track is stable.

Stable frames separate canvas preview geometry from canonical content. The
canvas stays scannable and animation-safe; reading and editing surfaces keep
the complete information.

## Key Decisions

- Use 4:3 rather than 2:1 for storyboard frames. Most current source art is
  square-ish, so 4:3 produces less letterboxing. The width comes from the
  shared 192px data column and the height derives to 144px; it is not derived
  from the row height.
- Use `object-contain`; never crop or stretch storyboard art.
- Keep column and row header elements mounted at overview scale. Replace only
  their text paint with neutral skeleton bars in the `blocks` semantic tier.
  Semantic zoom must not add, remove, or resize grid tracks.
- View mode owns the renderer (`single`, `stacked`, or `merged`). Camera focus
  changes only the viewport transform and interaction emphasis, never the
  renderer, frame inset, or header structure.
- Use a four-line narrative preview in a fixed 128px face (96px compact).
- Treat 80 characters as the narrative authoring target and 100 as a soft
  warning. Do not truncate stored content or block agent writes.
- Use fixed 52px technology pills (42px compact), with two visible lines and
  ellipsis. Keep the full label as the accessible name and in cell detail.
- Continue stacking multiple technology pills vertically. Row height is a
  deterministic function of pill count, fixed pill height, and fixed gaps.
- Keep existing legacy comma/newline parsing for compatibility in this pass;
  future structured technology items should separate `name` and
  `description` without changing the canvas contract.

## Open Questions

None.

## Next Steps

Implement the frame contract, align row math with the rendered dimensions, and
validate semantic zoom, full-content access, compare layouts, and agent writes.
