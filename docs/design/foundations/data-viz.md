---
audience: designers
summary: The encodings — compare bands, ledger, divergence strip and zones, severity, the semantic-zoom blocks tier, path-type colors — and the rule that every encoding is tokenized and survives dark + forced-colors.
sources: src/components/blueprint/CompareDivergenceStrip.tsx, src/components/blueprint/StackedCompareGrid.tsx, src/components/blueprint/CompareDifferencesSurface.tsx, src/lib/pathColorTheme.ts, src/styles/blueprint.css, src/lib/palette.test.ts
last-reviewed: 2026-08-08
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
- **The divergence strip** (`CompareDivergenceStrip`) — the signature. One
  shared neutral 2px track where the runs agree; where they split, per-path
  **colored + dashed** tracks; **zone chips** (①②③…, `CompareZoneChip` /
  `deriveCompareZones`) numbering each divergent zone so the strip, the
  bands, and the ledger can all point at "zone ②" and mean the same thing.
- **Merged** is a per-slot combined grid — a view mode, not a new encoding
  (see [content-voice](../content-voice.md) for the Stacked/Merged naming).

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

## Path-type colors

`PATH_TYPE_COLORS` (`src/lib/pathColorTheme.ts`): happy = green, unhappy =
orange, exception = red, alternative = blue, named paths draw stable per-name
colors from a registry. Everything about it is deliberate and tested:

- Badges use step **1100** (Radix's text weight) so white text passes; arrows
  use step **1000**, one notch lighter, so a stroke reads as related to its
  badge without matching it.
- Color is never the only channel: the **happy path is solid, every other
  type is dashed** — line style carries the distinction too.
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
