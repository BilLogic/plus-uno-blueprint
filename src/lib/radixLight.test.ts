import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { RADIX_LIGHT } from '@/lib/radixLight'

/**
 * `radixLight.ts` is a hex transcription of the light half of colors.css, not a
 * reference to it — the canvas inlines its colours via `style` so they survive a
 * theme flip, which rules out `var()` at the use site.
 *
 * Transcription means the two can silently drift: edit a step in colors.css and
 * nothing tells you the board still paints the old value. This test is what
 * makes the claim "the canvas draws from the same palette" true rather than
 * merely intended.
 */

const COLORS_CSS = fileURLToPath(
  new URL('../styles/colors.css', import.meta.url),
)

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = light - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  const channel = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

/** Light-theme `--color-{family}-{step}` values, keyed as `family` + `step`. */
function readLightScale(): Map<string, string> {
  const css = readFileSync(COLORS_CSS, 'utf8')
  const light = css.slice(css.indexOf(':root {'), css.indexOf('.dark {'))
  const scale = new Map<string, string>()
  const declaration =
    /--color-([a-z]+)-(\d+):\s*hsla?\(\s*([\d.]+)(?:deg)?,\s*([\d.]+)%,\s*([\d.]+)%/g
  for (const match of light.matchAll(declaration)) {
    const [, family, step, h, s, l] = match
    scale.set(`${family}${step}`, hslToHex(Number(h), Number(s), Number(l)))
  }
  return scale
}

describe('radixLight mirrors colors.css', () => {
  const scale = readLightScale()
  const entries = Object.entries(RADIX_LIGHT)

  it('parsed the scale at all', () => {
    // Guards against the regex silently matching nothing after a format change,
    // which would make every assertion below vacuously pass.
    expect(scale.size).toBeGreaterThan(180)
  })

  it.each(entries)('%s matches its step', (name, hex) => {
    expect(scale.get(name)).toBe(hex)
  })
})
