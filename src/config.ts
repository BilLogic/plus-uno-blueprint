/** Org/workspace display name used across the shell (breadcrumbs, headers). */
export const ORG_NAME = 'PLUS'

/**
 * The deployment's brand block — the small one ADR 0013 describes, and no more.
 *
 * `accent` is the colour this deployment is branded on, written the way a
 * deployer knows it: a CSS hex. It is optional, and omitting it is a real
 * choice rather than a hole — a deployment that sets nothing paints the accent
 * its own `src/styles/themes/*.css` carry, which is where the brand ramp is
 * authored anyway.
 *
 * The field had no reader at all until #411: it was documented as a seam and
 * discarded at runtime, which is worse than not offering it. `brandAccent.ts`
 * is the reader, and its header says exactly how far the accent reaches.
 */
export type Brand = {
  /** CSS hex, `#RGB` or `#RRGGBB`. Omit to keep the theme files' own hue. */
  accent?: string
}

/**
 * PLUS's blue-green. Its OKLCH hue is 177.6, which is the hue the theme files
 * already declare and the hue of every step of their `--brand-*` ramp — so
 * this deployment's own accent resolves to the dial it already had, and
 * reading it repaints nothing.
 */
export const BRAND: Brand = {
  accent: '#85ECD5',
}
