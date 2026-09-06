import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BRAND } from '@/config'
import {
  BRAND_ACCENT_DIAL,
  applyBrandAccent,
  brandAccentHue,
} from '@/lib/brandAccent'
import {
  chromaCeiling,
  contrast,
  dial,
  oklch,
  resolveValue,
  type Rgb,
  type Theme,
} from '@/lib/tokenModel'

/**
 * The brand seam, once it has a reader (#411).
 *
 * `brand.accent` was a documented field that nothing read: the accent that
 * painted this deployment was a literal in two stylesheets, so a second
 * deployment could set the field and see no change at all. What is worth
 * asserting is therefore not the colour PLUS happens to ship — a hex
 * expectation would only restate `config.ts` back to itself — but the property
 * the seam owes anyone who uses it: a deployment that sets an accent and one
 * that does not both come out with a legible palette, in light and in dark.
 *
 * So this file measures. Every input but the hue comes from `tokenModel`, the
 * one style seam (ADR 0001), which means the dials below are read through the
 * real cascade rather than off the page — and a dial a theme starts turning is
 * picked up here without a second reader ever learning what a theme file is.
 */

/** The one accent this deployment ships, non-optional for the assertions. */
const SHIPPED = BRAND.accent as string

/**
 * The colours a hue produces, measured the way a browser draws them.
 *
 * Mirrors the four derivations in `semantic.css` that hang off `--primary`,
 * with the chroma clamped to the sRGB ceiling at each lightness because that
 * is what CSS Color 4 gamut mapping does — measuring the REQUESTED chroma
 * would pass this suite on colours no browser renders, which is the note
 * `palette.test.ts` carries beside the same arithmetic.
 */
function rendered(hue: number, theme: Theme) {
  const surface = dial('--surface', theme)
  const chroma = dial('--chroma', theme)
  // Dark runs its surfaces on the brand hue; light holds them at its own warm
  // grey. Reading the dial rather than assuming either is the whole point.
  const surfaceHue =
    resolveValue('--surface-hue', theme) === resolveValue('--hue', theme)
      ? hue
      : dial('--surface-hue', theme)

  const fillL = dial('--primary-lightness', theme)
  const fillC = Math.min(dial('--primary-chroma', theme), chromaCeiling(fillL, hue))
  const ringL = dial('--ring-lightness', theme)
  const borderL = fillL - 0.12

  return {
    fill: oklch(fillL, fillC, hue),
    // --primary-foreground: oklch(min(surface, fg-lightness) chroma*0.45 hue)
    ink: oklch(
      Math.min(surface, dial('--foreground-lightness', theme)),
      chroma * 0.45,
      hue,
    ),
    // --ring: oklch(from --primary <ring-lightness> calc(c * 1.3) h)
    ring: oklch(ringL, Math.min(fillC * 1.3, chromaCeiling(ringL, hue)), hue),
    // --primary-border: oklch(from --primary calc(l - 0.12) calc(c * 1.25) h)
    border: oklch(
      borderL,
      Math.min(fillC * 1.25, chromaCeiling(borderL, hue)),
      hue,
    ),
    // --background: oklch(surface calc(chroma * 0.5) surface-hue)
    canvas: oklch(surface, chroma * 0.5, surfaceHue),
  }
}

/** The three floors a palette has to clear to be usable at all. */
function expectLegible(hue: number, theme: Theme) {
  const { fill, ink, ring, border, canvas } = rendered(hue, theme)
  // The filled control's own label. AAA, the floor `palette.test.ts` holds for
  // the shipped accent — a control is small text on a saturated ground.
  expect(contrast(fill, ink), `fill/ink at ${hue}° ${theme}`).toBeGreaterThanOrEqual(7)
  // SC 1.4.11: the focus ring is a non-text affordance on the canvas.
  expect(contrast(ring, canvas), `ring/canvas at ${hue}° ${theme}`).toBeGreaterThanOrEqual(3)
  // The hairline that makes the flat fill read as a control rather than a
  // badge. Not a WCAG floor — an edge nobody can see is not an edge.
  expect(contrast(border, fill), `border/fill at ${hue}° ${theme}`).toBeGreaterThan(1.4)
}

/** A hex spanning the wheel, so the sweep enters through the reader. */
function accentAt(hue: number): string {
  const l = 0.7
  const rgb = oklch(l, chromaCeiling(l, hue) * 0.8, hue)
  return `#${rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`
}

const WHEEL = Array.from({ length: 36 }, (_, step) => step * 10)

describe('the accent this deployment ships', () => {
  it('is a colour the reader can read', () => {
    // A malformed accent would otherwise reach a browser as a blank page. It
    // cannot: this fails first, in the repository that authored the value.
    expect(() => brandAccentHue(SHIPPED)).not.toThrow()
  })

  it('resolves to the dial the theme files already declare, so nothing repaints', () => {
    // #85ECD5 measures 177.6345°; the theme files author the dial at one
    // decimal, and the reader rounds to the same precision. Giving the seam a
    // reader is therefore a no-op for PLUS and a mechanism for everyone else.
    expect(brandAccentHue(SHIPPED)).toBe(dial('--hue', 'light'))
    expect(brandAccentHue(SHIPPED)).toBe(dial('--hue', 'dark'))
  })

  it('is written onto the root as the dial the token steps derive from', () => {
    const written: Array<[string, string | null]> = []
    const hue = applyBrandAccent({
      style: { setProperty: (name, value) => void written.push([name, value]) },
    })
    expect(hue).toBe(brandAccentHue(SHIPPED))
    expect(written).toEqual([[BRAND_ACCENT_DIAL, String(hue)]])
  })

  it('is read at boot, not from a render path', () => {
    // The defect this ticket names is a field nobody reads. A reader nothing
    // calls is the same defect with more code, so the call site is asserted.
    const entry = readFileSync(
      fileURLToPath(new URL('../main.tsx', import.meta.url)),
      'utf8',
    )
    expect(entry).toContain('applyBrandAccent')
    expect(entry).toMatch(/applyBrandAccent\(document\.documentElement\)/)
  })
})

describe('a deployment that sets no accent', () => {
  it('writes nothing, and keeps the theme files own the dial', () => {
    const written: string[] = []
    const hue = applyBrandAccent(
      { style: { setProperty: (name) => void written.push(name) } },
      {},
    )
    expect(hue).toBeUndefined()
    expect(written).toEqual([])
  })

  it.each(['light', 'dark'] as const)('has a legible palette in %s', (theme) => {
    expectLegible(dial('--hue', theme), theme)
  })
})

describe('a deployment that sets one', () => {
  it('actually repaints, which is the whole of what was missing', () => {
    // The field used to accept a value and discard it. Measured: a violet
    // accent moves the dial, and with it every brand surface derived through
    // it — the filled control, its hairline and the focus ring, in both themes.
    const violet = brandAccentHue('#7C3AED')
    expect(violet).not.toBe(dial('--hue', 'light'))
    for (const theme of ['light', 'dark'] as const) {
      const before = rendered(dial('--hue', theme), theme)
      const after = rendered(violet, theme)
      for (const key of ['fill', 'ring', 'border'] as const) {
        expect(after[key], `${key} in ${theme}`).not.toEqual(before[key] as Rgb)
      }
    }
  })

  it('leaves the ink alone in light and tints it in dark, because chroma says so', () => {
    // Not a caveat — the honest reach of the seam, measured. The filled
    // control's ink is `calc(var(--chroma) * 0.45)` saturated, and light runs
    // `--chroma: 0`, so light's ink is a neutral near-black at every accent.
    // Dark runs 0.005 and its ink carries the hue, faintly. A reader that
    // claimed to move everything would be wrong here first.
    const violet = brandAccentHue('#7C3AED')
    expect(rendered(violet, 'light').ink).toEqual(
      rendered(dial('--hue', 'light'), 'light').ink as Rgb,
    )
    expect(rendered(violet, 'dark').ink).not.toEqual(
      rendered(dial('--hue', 'dark'), 'dark').ink as Rgb,
    )
  })

  describe.each(['light', 'dark'] as const)('%s', (theme) => {
    it.each(WHEEL)('stays legible at %i°', (hue) => {
      // Swept rather than sampled from a handful of brand colours: a list of
      // real-world hexes samples the region where the property already holds,
      // which is the failure mode every guard in this tree has had once. The
      // input enters through the reader, so the rounding is in the loop too.
      expectLegible(brandAccentHue(accentAt(hue)), theme)
    })
  })
})
