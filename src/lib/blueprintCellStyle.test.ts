import { describe, expect, it } from 'vitest'
import {
  CELL_RING_MIN_CONTRAST,
  getBlueprintCellInteractionColors,
  getContrastRatio,
} from '@/lib/blueprintCellStyle'
import { BLUEPRINT_CELL_PALETTE } from '@/lib/blueprintTheme'

/**
 * The ring drawn on a blueprint cell is the focus affordance on the app's
 * most-used control, and it is resolved from the cell's own fill rather than
 * from `--ring` (see `getBlueprintCellInteractionStyle`, which always sets
 * `--blueprint-cell-ring-soft`, making the `var(..., var(--ring))` fallback in
 * `ui/button.tsx` unreachable).
 *
 * That makes this the only place the requirement can be enforced. The previous
 * fixed floor failed on five of the eight lane fills — 1.86:1 on chartreuse.
 */
describe('blueprint cell focus ring', () => {
  const fills = Object.entries(BLUEPRINT_CELL_PALETTE)

  it.each(fills)('%s (%s) clears SC 1.4.11 against its own fill', (_name, fill) => {
    // Both rings render as visible outlines — `--blueprint-cell-ring` is the
    // 2px slice-member outline in blueprint.css, `--blueprint-cell-ring-soft`
    // the focus affordance — so both owe the fill 3:1.
    const { ring, ringSoft } = getBlueprintCellInteractionColors(fill)
    expect(getContrastRatio(ring, fill)).toBeGreaterThanOrEqual(
      CELL_RING_MIN_CONTRAST,
    )
    expect(getContrastRatio(ringSoft, fill)).toBeGreaterThanOrEqual(
      CELL_RING_MIN_CONTRAST,
    )
  })

  it('keeps a near-grey fill in the grey family', () => {
    // `#F2F2F4` and `#F4F2F2` are perceptually identical, but their hue is
    // decided by a rounding artefact. Raising chroma used to amplify that into
    // rings 240° apart.
    const a = getBlueprintCellInteractionColors('#F2F2F4').ringSoft
    const b = getBlueprintCellInteractionColors('#F4F2F2').ringSoft
    const spread = (hex: string) => {
      const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      return Math.max(r, g, bl) - Math.min(r, g, bl)
    }
    expect(spread(a)).toBeLessThanOrEqual(12)
    expect(spread(b)).toBeLessThanOrEqual(12)
  })
})
