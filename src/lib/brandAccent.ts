import { BRAND, type Brand } from '@/config'
import { hexToRgb, oklchFromSrgb } from '@/lib/oklch'

/**
 * The reader for `brand.accent` (#411).
 *
 * The seam offered the field and nothing read it: the accent that actually
 * painted this deployment was the `--hue` dial written into
 * `styles/themes/light.css` and `dark.css`, so a second deployment could set
 * `brand.accent` and watch nothing happen. This module closes that by writing
 * the accent's own hue onto the root element as `--hue` — the one dial the
 * theme files call "the one place it is declared" — before the first render.
 * An inline custom property on `documentElement` outranks every stylesheet
 * selector, so it wins under `:root`, under `.dark`, and under the print
 * override too.
 *
 * WHAT THE ACCENT MOVES, precisely, because a seam that overstates its reach
 * is the same defect one layer along. `--hue` feeds `--primary-hue`, and from
 * there the filled control, its hairline, its ink, the focus ring and the
 * sidebar selection chrome that derives from the ring; it also feeds
 * `--surface-hue` in dark mode, where `--chroma: 0.005` makes it faintly
 * visible on every surface, and the status-hue harmony pull that leans
 * warning / destructive / info a fraction of the way toward the brand.
 *
 * WHAT IT DOES NOT MOVE: the `--brand-*` ramp. Those steps are per-theme HSL
 * literals authored in the theme files, and Q42 of #396 settled that the theme
 * files stay each deployment's own — so a deployment that sets an accent off
 * its ramp gets the 2026-08-06 defect back, the filled button wearing a
 * different hue from every other brand surface. The contract is therefore the
 * template's documented one: the accent is the hue of your ramp, and rebranding
 * is this field plus the ramp beside it. `palette.test.ts` holds the two
 * together for the accent this deployment actually ships.
 *
 * Only the HUE is taken. The accent's own lightness and chroma are deliberately
 * ignored: `--primary-lightness` and `--primary-chroma` are a tuning decision
 * with three walked-back passes recorded above `--primary` in `semantic.css`,
 * not a brand fact. Taking them from the hex would paint PLUS's control at
 * L 0.874 / C 0.1025 — exactly the pastel-badge fill that tuning walked away
 * from.
 */

/** The dial an accent is read as. */
export const BRAND_ACCENT_DIAL = '--hue'

/**
 * The precision `themes/*.css` author the dial at, one decimal place.
 *
 * Rounding to it is what makes reading this deployment's own accent provably a
 * no-op rather than a sub-degree nudge: `#85ECD5` measures 177.6345°, the
 * theme files declare 177.6, and at one decimal the reader writes back the
 * value that was already there.
 */
const DIAL_PRECISION = 10

/** The minimum of an element this module needs, so a test can pass a fake. */
export type StyleTarget = { style: Pick<CSSStyleDeclaration, 'setProperty'> }

/**
 * The `--hue` an accent implies.
 *
 * Throws on a value it cannot read. A deployment's accent is authored code
 * that the type-check and the suite both see before a browser does, so a
 * malformed hex is a bug to hear about rather than a field to quietly ignore —
 * quietly ignoring the field is the whole of what #411 is about.
 */
export function brandAccentHue(accent: string): number {
  const [, , hue] = oklchFromSrgb(hexToRgb(accent))
  return Math.round(hue * DIAL_PRECISION) / DIAL_PRECISION
}

/**
 * Write the deployment's accent onto the root, and report the hue written.
 *
 * Returns `undefined` and writes nothing when the brand block sets no accent,
 * which leaves the theme files' own dial standing — the case the assertion in
 * `brandAccent.test.ts` calls "a deployment that sets no accent".
 *
 * It takes the whole brand block rather than the accent string, so that "no
 * accent" is a block without the field. A defaulted `accent?: string`
 * parameter cannot express it: passing `undefined` explicitly would fall
 * through to the default and paint PLUS's own accent, which is the same class
 * of silently-wrong as the field this ticket is about.
 */
export function applyBrandAccent(
  root: StyleTarget,
  brand: Brand = BRAND,
): number | undefined {
  if (brand.accent === undefined) return undefined
  const hue = brandAccentHue(brand.accent)
  root.style.setProperty(BRAND_ACCENT_DIAL, String(hue))
  return hue
}
