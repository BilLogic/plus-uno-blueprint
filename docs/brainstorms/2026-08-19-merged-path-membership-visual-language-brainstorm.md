---
date: 2026-08-19
topic: merged-path-membership-visual-language
---

# Merged path-membership visual language

## What We're Building

Merged view prioritizes finding differences. Cell faces retain their semantic
lane colors, while a thin, non-interactive rail along the top edge communicates
which selected paths own a divergent or subset-shared cell.

- Shared by every selected path: one normal cell with no rail.
- Unique to one path: one solid path-colored rail.
- Shared by a strict subset: one rail split into equal path-colored segments.
- Different content: the versions remain vertically stacked, each carrying
  the rail for the paths represented by that version.

Hovering the rail or focusing its cell reveals the full path names. The canvas
does not use abbreviated labels such as `HP` or `PS`.

## Why This Approach

The current whole-cell wash makes a subset-shared cell look like a broken or
unfinished puzzle piece. It also competes with the lane color, which is the
cell's primary semantic identity.

The rail separates the two visual channels cleanly: cell fill answers “what
kind of service activity is this?” while the outline answers “which paths does
this version belong to?” Vertical stacking continues to answer “do the paths
differ?” Full names on hover and keyboard focus avoid a legend-decoding task.

## Key Decisions

- Show positive membership on every rendered merged cell; absence is not a
  meaningful ownership signal.
- Remove path-color washes and striped cell backgrounds entirely.
- Preserve existing lane fills without tinting or blending them.
- Use a rounded perimeter outline so every cell shape, including pills, keeps
  its native corners.
- Use equal outline segments in selected-path order for multi-path membership.
- Expose full path names through a tooltip on pointer hover and keyboard focus.
- Do not render abbreviated path labels on cells.
- Keep the outline informational. Clicking the cell continues to open cell
  details; the outline does not filter, select, or navigate.
- Preserve color-independent meaning: stacked geometry communicates difference,
  and tooltip text communicates exact membership. Color is supplementary.
- At overview semantic zoom, retain the outline as a compact geometry signal; do
  not introduce additional text or alter cell dimensions.

## Approaches Considered

1. Compact abbreviated labels: precise but rejected because abbreviations are
   difficult to decode and not useful enough to justify the clutter.
2. Rounded membership outline with full-name disclosure: selected because it
   preserves the cell silhouette and makes membership positive everywhere.
3. Interaction-only membership with no persistent marker: quieter, but it hides
   the location of path-specific cells and weakens scanning.
4. Interactive outline segments: rejected because they create small nested controls
   and compete with the established click-to-open-cell behavior.

## Open Questions

None.

## Next Steps

Create an implementation plan covering the shared rail component, tooltip and
keyboard behavior, removal of wash styles and short labels, dark/forced-color
rendering, semantic-zoom validation, merged-slot tests, and agent/cell-selection
regression coverage.
