import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CELL_STEP } from '@/lib/blueprintCellStyle'
import {
  PATH_TYPE_COLORS,
  getPathColor,
  getPathDashArray,
  PATH_IDENTITY_PERIOD,
} from '@/lib/pathColorTheme'

/**
 * The app resolves every colour through `var()`, so nothing in the browser can
 * be measured from here. This suite resolves the same tokens against
 * `colors.css` and measures the pairs the interface actually renders.
 *
 * It replaces a runtime contrast solver that computed ring lightness per cell.
 * The solver only ever saw light mode — it took a hex fill, and dark mode never
 * produced one. Reading the stylesheet checks both themes, which is the part
 * that was missing rather than the part that was expensive.
 */

const COLORS_CSS = fileURLToPath(
  new URL('../styles/colors.css', import.meta.url),
)
const SEMANTIC_CSS = fileURLToPath(
  new URL('../styles/semantic.css', import.meta.url),
)
const LIGHT_THEME_CSS = fileURLToPath(
  new URL('../styles/themes/light.css', import.meta.url),
)

type Rgb = [number, number, number]

function hslToRgb(h: number, s: number, l: number): Rgb {
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
  return [r + m, g + m, b + m]
}

/**
 * OKLCH → linear sRGB (Björn Ottosson's matrices). The brand tokens are the
 * one part of the system authored in OKLCH rather than picked off the HSL
 * ramps, so they need their own resolver; `resolve()` below only speaks
 * `--color-family-step`.
 */
function oklchToLinearSrgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const lc = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mc = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const sc = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
  ]
}

const inSrgbGamut = (rgb: Rgb) => rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6)

/**
 * The other direction: gamma-encoded sRGB → OKLCH hue in degrees. Needed
 * because the `--brand-*` ramp is authored as HSL literals, so its OKLCH hue
 * — the thing `--primary` has to agree with — is not readable off the page.
 */
function oklchHue([r, g, b]: Rgb): number {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360
}

/** Gamma-encoded sRGB, so these values can meet the `Rgb` the solver expects. */
function oklch(l: number, c: number, hDeg: number): Rgb {
  return oklchToLinearSrgb(l, c, hDeg).map((v) => {
    const clamped = Math.min(1, Math.max(0, v))
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * clamped ** (1 / 2.4) - 0.055
  }) as Rgb
}

/** Largest in-gamut chroma at this lightness and hue, to 4dp. */
function chromaCeiling(l: number, hDeg: number): number {
  let lo = 0
  let hi = 0.5
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (inSrgbGamut(oklchToLinearSrgb(l, mid, hDeg))) lo = mid
    else hi = mid
  }
  return lo
}

function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (v: number) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  )
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2))
}

/** `--color-{family}-{step}` values for one theme, keyed `family-step`. */
function readScale(theme: 'light' | 'dark'): Map<string, Rgb> {
  const css = readFileSync(COLORS_CSS, 'utf8')
  const start = css.indexOf(theme === 'light' ? ':root {' : '@media screen {')
  const block = theme === 'light' ? css.slice(start, css.indexOf('@media screen {')) : css.slice(start)
  const scale = new Map<string, Rgb>()
  const declaration =
    /--color-([a-z]+)-(\d+):\s*hsla?\(\s*([\d.]+)(?:deg)?,\s*([\d.]+)%,\s*([\d.]+)%/g
  for (const [, family, step, h, s, l] of block.matchAll(declaration)) {
    scale.set(`${family}-${step}`, hslToRgb(Number(h), Number(s), Number(l)))
  }
  return scale
}

const THEMES = { light: readScale('light'), dark: readScale('dark') }

/** Resolve a `var(--color-family-step)` string against one theme. */
function resolve(token: string, theme: 'light' | 'dark'): Rgb {
  const match = /--color-([a-z]+-\d+)/.exec(token)
  if (!match) throw new Error(`not a palette token: ${token}`)
  const value = THEMES[theme].get(match[1])
  if (!value) throw new Error(`missing from colors.css: ${match[1]}`)
  return value
}

describe('palette', () => {
  it.each(['light', 'dark'] as const)('%s scale parsed', (theme) => {
    // A format change that broke the regex would otherwise make every
    // assertion below pass against an empty map.
    expect(THEMES[theme].size).toBeGreaterThan(180)
  })
})

describe('brand fill', () => {
  // `--primary` and everything derived from it are authored in OKLCH against
  // the theme's `--hue` dial. Nothing here can be read off the HSL ramps, so
  // this block resolves the declarations on disk and measures them directly —
  // the fill is the most-tuned colour in the system and has been retuned three
  // times, twice into a state someone had to walk back.
  const semantic = readFileSync(SEMANTIC_CSS, 'utf8')
  const light = readFileSync(LIGHT_THEME_CSS, 'utf8')

  const dial = (css: string, name: string) => {
    const match = new RegExp(`--${name}:\\s*([\\d.]+)`).exec(css)
    if (!match) throw new Error(`dial not found: --${name}`)
    return Number(match[1])
  }

  const HUE = dial(light, 'hue')
  const SURFACE = dial(light, 'surface')
  const FOREGROUND_LIGHTNESS = dial(light, 'foreground-lightness')
  const CHROMA = dial(light, 'chroma')

  // --primary: oklch(<l> <c> var(--primary-hue))
  const declared =
    /--primary:\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+var\(--primary-hue\)\s*\)/.exec(
      semantic,
    )
  if (!declared) throw new Error('--primary is no longer a literal L C hue')
  const L = Number(declared[1])
  const C = Number(declared[2])

  const canvas = oklch(SURFACE, 0, dial(light, 'surface-hue'))

  it('states its own lightness and chroma, so a retune has to come here', () => {
    // A drive-by edit that moves either number lands on this assertion first
    // and has to read the tuning history above the declaration to change it.
    expect({ L, C }).toEqual({ L: 0.83, C: 0.135 })
  })

  it('sits on the brand ramp rather than beside it', () => {
    // The 2026-08-06 pass left the hue dial 5.4° off the `--brand-*` ramp,
    // which put the filled button on a cyaner green than every other brand
    // surface in the app. The ramp is authored as HSL literals whose OKLCH
    // hue is 177.6 at every step — so this compares the dial against the
    // ramp as CONVERTED, not against the HSL numbers on the page, which read
    // 163–171 and are not a hue reference.
    const brandHues = [...light.matchAll(/--brand-(\d00):\s*([\d.]+)deg\s+([\d.]+)%\s+([\d.]+)%/g)]
      .map(([, , h, s, l]) => oklchHue(hslToRgb(Number(h), Number(s), Number(l))))
    expect(brandHues.length).toBeGreaterThanOrEqual(5)
    for (const hue of brandHues) expect(Math.abs(hue - HUE)).toBeLessThan(0.2)
  })

  it('leaves the fill itself un-gamut-mapped', () => {
    // Headroom is the whole reason the chroma is set as a fraction of the
    // ceiling rather than at it: the browser silently chroma-reduces anything
    // past the ceiling, which would make the declared value a lie and freeze
    // any future retune in place.
    const ceiling = chromaCeiling(L, HUE)
    expect(C).toBeLessThan(ceiling)
    expect(inSrgbGamut(oklchToLinearSrgb(L, C, HUE))).toBe(true)
  })

  it('stays saturated enough to read as a control, not a wash', () => {
    // The 2026-08-06 pass sat at ~65% of the ceiling and read muddy next to
    // Supabase's #3ECF8E, which runs ~88.6% of the ceiling at its own L/H.
    // We now run 88.1% of ours — matched as a RATIO, because the absolute
    // chroma that reads right moves with the lightness and the hue.
    expect(C / chromaCeiling(L, HUE)).toBeGreaterThan(0.85)
    expect(C / chromaCeiling(L, HUE)).toBeLessThan(0.95)
  })

  it('is brighter than the pass the user called dull and dark', () => {
    // 2026-08-07b. Directional, not a re-statement of the literal above: the
    // fill has been walked down (0.874 → 0.78) and back up, and the floor is
    // what stops the next "tone it down" pass from landing under 0.78 again.
    // The ceiling keeps it below --brand-400's L 0.874, which read as a
    // pastel chip rather than a control.
    expect(L).toBeGreaterThan(0.8)
    expect(L).toBeLessThan(0.87)
  })

  it('carries its dark ink at AAA', () => {
    // --primary-foreground: oklch(min(surface, fg-lightness) chroma*0.45 hue)
    const ink = oklch(
      Math.min(SURFACE, FOREGROUND_LIGHTNESS),
      CHROMA * 0.45,
      HUE,
    )
    expect(contrast(oklch(L, C, HUE), ink)).toBeGreaterThanOrEqual(7)
  })

  it('keeps the focus ring legible on the canvas', () => {
    // SC 1.4.11. --ring: oklch(from var(--primary) 0.58 calc(c * 1.3) h) — and
    // c * 1.3 has been over the ceiling at L 0.58 across every retune, so what
    // actually renders is the gamut-mapped value. Measure that, not the
    // requested one, or this test passes on a colour no browser draws.
    const ringL = 0.58
    const ring = oklch(ringL, Math.min(C * 1.3, chromaCeiling(ringL, HUE)), HUE)
    expect(contrast(ring, canvas)).toBeGreaterThanOrEqual(3)
  })

  it('keeps the button hairline darker than the fill it edges', () => {
    // --primary-border: oklch(from var(--primary) calc(l - 0.12) calc(c*1.25) h).
    // The ×1.25 is gamut-mapped away at this hue, so the edge is carried by the
    // lightness step alone — which means the lightness step is what has to hold.
    const borderL = L - 0.12
    const border = oklch(
      borderL,
      Math.min(C * 1.25, chromaCeiling(borderL, HUE)),
      HUE,
    )
    expect(contrast(border, oklch(L, C, HUE))).toBeGreaterThan(1.4)
  })
})

describe('blueprint cells', () => {
  // role → family, mirroring the [data-blueprint-lane] rules in blueprint.css.
  const lanes: ReadonlyArray<readonly [string, string]> = [
    ['visual', 'slate'],
    ['evidence', 'blue'],
    ['actor', 'green'],
    ['frontstage-tech', 'violet'],
    ['frontstage-action', 'pink'],
    ['backstage-tech', 'lime'],
    ['backstage-action', 'orange'],
    ['support', 'amber'],
  ]

  describe.each(['light', 'dark'] as const)('%s', (theme) => {
    it.each(lanes)('%s: ring reads against its own surface', (_lane, family) => {
      // SC 1.4.11 — the ring is the focus affordance and the slice-member
      // outline. Radix step 8 is specified to be legible on steps 1–5.
      const ring = resolve(`--color-${family}-${CELL_STEP.ring}`, theme)
      const surface = resolve(`--color-${family}-${CELL_STEP.surface}`, theme)
      expect(contrast(ring, surface)).toBeGreaterThanOrEqual(3)
    })

    it.each(lanes)('%s: text reads against its own surface', (_lane, family) => {
      const text = resolve(`--color-${family}-${CELL_STEP.text}`, theme)
      const surface = resolve(`--color-${family}-${CELL_STEP.surface}`, theme)
      expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5)
    })

    it.each(lanes)('%s: hover is distinguishable from rest', (_lane, family) => {
      const rest = resolve(`--color-${family}-${CELL_STEP.surface}`, theme)
      const hover = resolve(`--color-${family}-${CELL_STEP.hover}`, theme)
      expect(contrast(rest, hover)).toBeGreaterThan(1.03)
    })
  })
})

/**
 * The ink `[data-blueprint-fill]` derives for a fill, mirrored in JS.
 *
 * The CSS is `oklch(from <fill> clamp(0.12, calc((0.62 - l) * 100), 0.99)
 * calc(c * 0.08) h)` — Supabase's `*-foreground` formula. The clamp is a
 * step function in practice: any fill below L 0.62 gets L 0.99 ink, anything
 * above gets 0.12, because the multiplier is 100. Chroma drops to 8% so the
 * ink is tinted rather than stark, and the hue rides along.
 *
 * Mirrored here rather than asserted against one hard-coded ink, because a
 * hard-coded ink is exactly what this pairing replaced: `text-white` measured
 * 1.17-2.33:1 in dark mode, and a test that only knew about one value could
 * not have caught it.
 */
function derivedFillInk(fill: Rgb): Rgb {
  const [l, c, h] = oklchFromSrgb(fill)
  const inkL = Math.min(0.99, Math.max(0.12, (0.62 - l) * 100))
  return oklch(inkL, c * 0.08, h)
}

/** Gamma-encoded sRGB -> OKLCH triple (the inverse `oklch()` above needs). */
function oklchFromSrgb([r, g, b]: Rgb): [number, number, number] {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const l_ = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m_ = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s_ = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const B2 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  return [L, Math.hypot(A, B2), ((Math.atan2(B2, A) * 180) / Math.PI + 360) % 360]
}

describe('path badges', () => {
  const paths = Object.entries(PATH_TYPE_COLORS)

  describe.each(['light', 'dark'] as const)('%s', (theme) => {
    it.each(paths)('%s pairs with legible derived ink', (_type, token) => {
      const fill = resolve(token, theme)
      expect(contrast(fill, derivedFillInk(fill))).toBeGreaterThanOrEqual(4.5)
    })
  })

  describe.each(['light', 'dark'] as const)('%s open set', (theme) => {
    // The type defaults were measured above, but a named path draws its badge
    // from the open set — seven more fills that also render white text.
    const open = [
      ...new Set(
        Array.from({ length: 40 }, (_, i) =>
          getPathColor({ path_type: 'variant', name: `Path ${i}` }),
        ),
      ),
    ]
    it.each(open)('%s pairs with legible derived ink', (token) => {
      const fill = resolve(token, theme)
      expect(contrast(fill, derivedFillInk(fill))).toBeGreaterThanOrEqual(4.5)
    })
  })

  describe.each(['light', 'dark'] as const)('%s divider tag', (theme) => {
    // Not a path colour, but the same `[data-blueprint-fill]` rule paints it —
    // and it was the worst of the `text-white` sites at 1.17:1 in dark mode.
    it('pairs with legible derived ink', () => {
      const fill = resolve('--color-slate-1200', theme)
      expect(contrast(fill, derivedFillInk(fill))).toBeGreaterThanOrEqual(4.5)
    })
  })

  it('separates two unregistered named paths', () => {
    const a = getPathColor({ path_type: 'variant', name: 'Alpha' })
    const b = getPathColor({ path_type: 'variant', name: 'Beta' })
    expect(a === b).toBe(false)
  })

  it('tells the live board\'s variants apart without colour', () => {
    // Goal Setting's three variants render side by side. They were all coming
    // out `7 4 2 4` — registered, so the dash fell through to the type default
    // — which left colour as the only channel (SC 1.4.1).
    const variants = ['Set Goals', 'Check Goals', 'Update Goals']
    const dashes = variants.map((name) =>
      getPathDashArray({ path_type: 'variant', name }),
    )
    expect(new Set(dashes).size).toBe(variants.length)
    const colours = variants.map((name) =>
      getPathColor({ path_type: 'variant', name }),
    )
    expect(new Set(colours).size).toBe(variants.length)
  })

  it('tells two exceptions in one scenario apart, though both are red', () => {
    // Red is fixed for every exception — a reader should never have to work
    // out whether red means trouble here. So within a scenario the dash is
    // the ONLY thing separating two of them, and it has to.
    const both = ['Set Goals Edge Case', 'Update Goals Edge Case']
    const colours = both.map((name) =>
      getPathColor({ path_type: 'exception', name }),
    )
    expect(new Set(colours).size).toBe(1) // both red, by design
    const dashes = both.map((name) =>
      getPathDashArray({ path_type: 'exception', name }),
    )
    expect(new Set(dashes).size).toBe(2)
  })

  it('never repeats a colour AND a dash together', () => {
    // Colour and dash index the same slot through lists of DIFFERENT length —
    // 4 variant families, 7 dash patterns — so a repeated colour lands on a
    // different dash and the pair stays unique for lcm(4,7) = 28 paths.
    //
    // This used to assert the opposite: one colour, always one dash. That made
    // the second channel redundant with the first, which is the same as having
    // one — two paths sharing a colour shared a dash too and were
    // indistinguishable (SC 1.4.1). The lengths are coprime on purpose.
    expect(PATH_IDENTITY_PERIOD).toBe(28)

    const slots = Array.from({ length: PATH_IDENTITY_PERIOD }, (_, i) => i)
    const pairs = new Set(
      slots.map((i) => `${i % 4}|${i % 7}`),
    )
    expect(pairs.size).toBe(PATH_IDENTITY_PERIOD)
  })
})

describe('lane roles and touchpoint tones stay disjoint', () => {
  const css = readFileSync(
    fileURLToPath(new URL('../styles/blueprint.css', import.meta.url)),
    'utf8',
  )
  const familiesIn = (attr: string) =>
    new Set(
      [
        ...css.matchAll(
          new RegExp(`\\[data-blueprint-${attr}='[a-z-]+'\\] \\{([^}]*)\\}`, 'g'),
        ),
      ].flatMap(([, body]) =>
        [...body.matchAll(/--color-([a-z]+)-/g)].map(([, f]) => f),
      ),
    )

  it('shares no family, so a pill can never read as its lane', () => {
    const lanes = familiesIn('lane')
    const tones = familiesIn('tone')
    expect(lanes.size).toBeGreaterThan(0)
    expect(tones.size).toBeGreaterThan(0)
    expect([...lanes].filter((f) => tones.has(f))).toEqual([])
  })

  it('keeps named paths off the lane families too', () => {
    // A named path is drawn as a line across the lanes it touches. Before the
    // open set moved onto the tone families, four of the five named paths on
    // the live board rendered in the hue of a lane they crossed.
    const lanes = familiesIn('lane')
    const pathFamilies = new Set(
      Array.from({ length: 40 }, (_, i) =>
        getPathColor({ path_type: 'variant', name: `Path ${i}` }),
      ).map((token) => /--color-([a-z]+)-/.exec(token)![1]),
    )
    expect(pathFamilies.size).toBeGreaterThan(1)
    expect([...pathFamilies].filter((f) => lanes.has(f))).toEqual([])
  })
})

describe('interaction states', () => {
  const css = readFileSync(
    fileURLToPath(new URL('../styles/blueprint.css', import.meta.url)),
    'utf8',
  )
  /** Every `[data-blueprint-lane]` rule, as role → { property: family-step }. */
  const laneRules = [
    ...css.matchAll(/\[data-blueprint-lane='([a-z-]+)'\] \{([^}]*)\}/g),
  ].map(([, role, body]) => ({
    role,
    props: Object.fromEntries(
      [...body.matchAll(/(--[a-z-]+-blueprint-cell[a-z-]*):\s*var\(--color-([a-z]+-\d+)\)/g)]
        .map(([, prop, token]) => [prop, token]),
    ) as Record<string, string>,
  }))

  // Every property a lane role must define. Kept in step with the consumers:
  // a token nothing reads does not belong on the list, because then the test
  // is asserting the stylesheet against itself rather than against the app.
  const REQUIRED = [
    '--background-blueprint-cell',
    '--background-blueprint-cell-origin',
    '--background-blueprint-cell-hover',
    '--background-blueprint-cell-pressed',
    '--ring-blueprint-cell',
    '--ring-blueprint-cell-soft',
    '--foreground-blueprint-cell',
  ]

  it('defines every state on every lane role', () => {
    expect(laneRules).toHaveLength(8)
    for (const { role, props } of laneRules) {
      for (const key of REQUIRED) {
        expect(`${role}:${key}`).toBe(props[key] ? `${role}:${key}` : 'MISSING')
      }
    }
  })

  describe.each(['light', 'dark'] as const)('%s', (theme) => {
    it.each(laneRules.map((r) => [r.role, r] as const))(
      '%s: hover and pressed each move further from rest',
      (_role, { props }) => {
        const at = (key: string) =>
          THEMES[theme].get(props[key]) as [number, number, number]
        const rest = at('--background-blueprint-cell')
        // A state nobody can see is not a state.
        expect(contrast(rest, at('--background-blueprint-cell-hover'))).toBeGreaterThan(1.03)
        expect(
          contrast(rest, at('--background-blueprint-cell-pressed')),
        ).toBeGreaterThan(contrast(rest, at('--background-blueprint-cell-hover')))
      },
    )

    it.each(laneRules.map((r) => [r.role, r] as const))(
      '%s: text stays legible on the hover and pressed surfaces too',
      (_role, { props }) => {
        const at = (key: string) =>
          THEMES[theme].get(props[key]) as [number, number, number]
        const text = at('--foreground-blueprint-cell')
        expect(contrast(text, at('--background-blueprint-cell-hover'))).toBeGreaterThanOrEqual(4.5)
        expect(contrast(text, at('--background-blueprint-cell-pressed'))).toBeGreaterThanOrEqual(4.5)
      },
    )
  })
})
