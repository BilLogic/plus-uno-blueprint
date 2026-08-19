---
audience: designers
summary: The encodings — compare bands, ledger, merged membership outlines, severity, the semantic-zoom blocks tier, path-type colors — and the rule that every encoding is tokenized and survives dark + forced-colors.
sources: src/components/blueprint/StackedCompareGrid.tsx, src/components/blueprint/MergedCompareGrid.tsx, src/components/blueprint/CompareDifferencesSurface.tsx, src/lib/pathColorTheme.ts, src/styles/blueprint.css, src/lib/palette.test.ts
last-reviewed: 2026-08-19
---

# Data visualization

The board is itself a visualization; these are the encodings layered on top of
it. The governing rule sits at the end — read it before adding any.

## Compare encodings

The compare cockpit (Compare v3) reads two scenario runs against each other:

- **Stacked bands** (`StackedCompareGrid`, `BlueprintPathBand`) — each path
  gets a horizontal band over the shared step grid, so the runs sit one above
  the other on the same time axis.
- **The ledger** (`CompareDifferencesSurface`) — the itemized differences
  surface below the fold; each entry cites the cells it derives from.
- **Divergent column tint** — a quiet background cue in Stacked; the
  Differences surface provides the precise step-by-step reading and
  navigation. There is no second navigation strip above the canvas.
- **Merged** is a per-slot combined grid. Shared slots draw once. Different
  versions stack vertically, while a thin rounded membership outline identifies
  the paths represented by every rendered cell without repainting its
  lane-colored face. A solid outline means one path; equal perimeter segments
  mean multiple paths. Hover or keyboard focus discloses the full path names.
  A shared cell therefore shows every selected path rather than encoding
  “shared” as an unexplained absence.

## Severity

Findings and compare annotations carry three severities — **info / warn /
critical** — and they map onto the semantic status roles, never onto raw
palette steps: info → `--info`, warn → `--warning`, critical →
`--destructive`. Severity is additionally carried by placement and wording,
not color alone.

## The semantic-zoom blocks tier

Below the threshold (`SEMANTIC_ZOOM_THRESHOLD` in `useZoomPanViewport.ts`,
stamped as `data-semantic-tier="blocks"` by the camera's transform writer)
cell text is smudge, so the overview switches encodings: cells render as
**flat blocks** and phase title badges **counter-scale** to hold a constant
on-screen size. What the tier communicates is the **density map** — journey
length, cells per phase, above/below the line of visibility — with the phase
labels as the only legible text. The CSS in `src/styles/blueprint.css`
(SEMANTIC ZOOM block) owns the fill choices; its forced-colors restatement
redraws the blocks in `CanvasText` so the density map survives High Contrast.
Focused multi-path comparisons use a lower cutoff because their fitted frame is
larger than one blueprint; opening a comparison must not immediately replace
the content the reader asked for with the density encoding.

## Path-type colors

`PATH_TYPE_COLORS` (`src/lib/pathColorTheme.ts`): happy = green, unhappy =
orange, exception = red, alternative = blue, named paths draw stable per-name
colors from a registry. Everything about it is deliberate and tested:

- Badges use step **1100** (Radix's text weight) so white text passes; arrows
  use step **1000**, one notch lighter, so a stroke reads as related to its
  badge without matching it.
- Color is never the only channel: the **happy path is solid, every other
  type is dashed** — line style carries the distinction too.
- Merged membership outlines pair color with perimeter position and full-name tooltip text;
  stacked geometry—not color—remains the primary difference signal.
- The named-path families are **disjoint from the lane families**, so a 2px
  path line can never render in the hue of the lane it crosses.

## The rule

**Every encoding uses tokens, and survives dark mode and forced-colors.** No
hex or rgb literals in a visualization; a color that means something must be a
`var(--color-*)` or semantic token so themes follow, must pair with a
non-color channel (dash, position, label, chip), and must have a forced-colors
restatement when its fill would flatten away. `src/lib/palette.test.ts`
measures the stylesheet — contrast floors and family disjointness are held by
test, and a new encoding extends that test, not just the palette.
