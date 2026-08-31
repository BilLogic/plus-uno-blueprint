import { describe, expect, it } from 'vitest'
import { BLUEPRINT_THEME } from '@/lib/blueprintTheme'
import { CELL_STEP } from '@/lib/blueprintCellStyle'
import {
  PATH_TYPE_COLORS,
  getPathColor,
  getPathDashArray,
  PATH_IDENTITY_PERIOD,
} from '@/lib/pathColorTheme'
import {
  chromaCeiling,
  dial,
  contrast,
  derivedFillInk,
  hslToRgb,
  inSrgbGamut,
  oklch,
  oklchHue,
  oklchToLinearSrgb,
  palette,
  resolvePaletteToken,
  stylesheet,
} from '@/lib/tokenModel'

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

/*
 * The colour maths, the ramps and the cascade all come from `tokenModel` now.
 *
 * This file used to carry its own resolver — HSL and OKLCH conversions, a
 * `colors.css` reader, a contrast solver — and so did nothing else. That is
 * the shape ADR 0001 retires: five guards, five readers, five samples, each
 * one measuring the region where its property already held. The maths is
 * unchanged; the reader is shared, so widening it widens every rule at once.
 */
const THEMES = { light: palette('light'), dark: palette('dark') }

/** Resolve a `var(--color-family-step)` string against one theme. */
const resolve = resolvePaletteToken


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
  const semantic = stylesheet('semantic.css').text
  const light = stylesheet('themes/light.css').text

  // Through the cascade, not off the page: a dial's value is what wins at the
  // root under a theme, which is a different question from what one file says.
  const HUE = dial('--hue', 'light')
  const SURFACE = dial('--surface', 'light')
  const FOREGROUND_LIGHTNESS = dial('--foreground-lightness', 'light')
  const CHROMA = dial('--chroma', 'light')

  // --primary: oklch(<l> <c> var(--primary-hue))
  const declared =
    /--primary:\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+var\(--primary-hue\)\s*\)/.exec(
      semantic,
    )
  if (!declared) throw new Error('--primary is no longer a literal L C hue')
  const L = Number(declared[1])
  const C = Number(declared[2])

  const canvas = oklch(SURFACE, 0, dial('--surface-hue', 'light'))

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
    // pastel badge rather than a control.
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
    ['storyboard', 'slate'],
    ['evidence', 'blue'],
    ['actor', 'green'],
    ['frontstage-touchpoint', 'violet'],
    ['frontstage-action', 'pink'],
    ['backstage-touchpoint', 'lime'],
    ['backstage-action', 'orange'],
    ['support', 'amber'],
    ['partner-action', 'gray'],
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
    // The guarantee for a variant is the PAIR, not the hue alone. There are
    // four open families and seven dashes, deliberately coprime — 28 distinct
    // identities — so two arbitrary names sharing a family is a one-in-four
    // coincidence no hash can rule out, and demanding otherwise asserts
    // something the system does not provide. (An `exception` is the opposite
    // case: it takes the type colour, so its dash must carry the whole load —
    // pinned in pathColorTheme.test.ts.)
    const a = { path_type: 'variant', name: 'Alpha' } as const
    const b = { path_type: 'variant', name: 'Beta' } as const
    const identical =
      getPathColor(a) === getPathColor(b) &&
      getPathDashArray(a) === getPathDashArray(b)
    expect(identical).toBe(false)
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

/**
 * Board chrome — the ink-on-ground pairs the frame actually renders.
 *
 * These are CROSS-FAMILY pairs: a gray ink on a slate ground. Every assertion
 * in this file used to measure a pair whose halves came from the same
 * primitive family, and every colour defect found in this system has been a
 * pair whose halves did not. The divider caption ran at 2.64:1 for months
 * inside a file that measured contrast 100 times.
 *
 * The floor is 4.5:1 because both of these are text, and small text: the
 * divider caption is `--text-2xs` (11px), `--text-3xs` (10px) on compact
 * boards. Neither is near the large-text threshold.
 */
describe.each(['light', 'dark'] as const)('board chrome: %s', (theme) => {
  const pairs: ReadonlyArray<readonly [string, string, string]> = [
    ['divider caption', BLUEPRINT_THEME.dividerLabel, BLUEPRINT_THEME.dividerBg],
    ['label rail header', BLUEPRINT_THEME.headerText, BLUEPRINT_THEME.labelRail],
  ]

  it.each(pairs)('%s clears AA on its own row', (_name, ink, ground) => {
    expect(contrast(resolve(ink, theme), resolve(ground, theme))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('lane roles and touchpoint tones stay disjoint', () => {
  const css = stylesheet('blueprint.css').text
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

  it('shares no family, so a touchpoint can never read as its lane', () => {
    const lanes = familiesIn('lane')
    const tones = familiesIn('tone')
    expect(lanes.size).toBeGreaterThan(0)
    expect(tones.size).toBeGreaterThan(0)
    expect([...lanes].filter((f) => tones.has(f))).toEqual([])
  })

  it('keeps the open set off the lane families', () => {
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

  /*
   * The claim this file used to make, and the one it can actually hold.
   *
   * The test above titled itself "keeps NAMED paths off the lane families" and
   * sampled 40 synthetic names all hard-coded to `path_type: 'variant'`.
   * `getPathColor` short-circuits every other type, so the sample could only
   * ever produce the four open families — the one set that is disjoint by
   * construction. `happy` and `exception` were structurally unreachable, and
   * `happy` is green against the green `actor` lane. The name said one thing,
   * the sample another, and `guidelines/foundations/color.md` cited this file
   * as holding the wider claim.
   *
   * Extending the sample fails, and that failure is the finding. The honest
   * fix is to narrow the claim rather than reshuffle the palette: 9 lane
   * families plus 7 touchpoint tones is all 16, so `happy` cannot move off
   * green without displacing something that is also on screen. What CAN be
   * held is that the overlap is exactly one, known, and drawn at a different
   * weight — a step-1100 line over a step-400 fill.
   */
  const KNOWN_LANE_OVERLAP = ['happy']

  it('has exactly one path type sharing a lane family, and names it', () => {
    const lanes = familiesIn('lane')
    const overlapping = Object.entries(PATH_TYPE_COLORS)
      .filter(([, token]) => lanes.has(/--color-([a-z]+)-/.exec(token)![1]))
      .map(([type]) => type)
    expect(overlapping).toEqual(KNOWN_LANE_OVERLAP)
  })

  it('draws that overlap at a different weight from the lane it crosses', () => {
    // What makes the one collision survivable: the path is a line at the text
    // step, the lane is a fill four steps lighter. Same family, not the same
    // colour.
    const laneFill = Number(CELL_STEP.surface)
    for (const type of KNOWN_LANE_OVERLAP) {
      const step = Number(
        /--color-[a-z]+-(\d+)/.exec(
          PATH_TYPE_COLORS[type as keyof typeof PATH_TYPE_COLORS],
        )![1],
      )
      expect(step).toBeGreaterThan(laneFill)
    }
  })

  /*
   * The constraint nobody had written down: the palette is FULL.
   *
   * Nine families to lanes, seven to touchpoint tones, sixteen in all and
   * nothing spare. It is invisible until someone tries to add a tenth lane and
   * finds there is nowhere for it to go — and it is the reason the fix above
   * is a narrowed claim rather than a reallocation.
   */
  it('states its own allocation, so a tenth lane fails before it is drawn', () => {
    const lanes = familiesIn('lane')
    const tones = familiesIn('tone')
    expect(lanes.size).toBe(9)
    expect(tones.size).toBe(7)
    expect(new Set([...lanes, ...tones]).size).toBe(16)
  })
})

/*
 * Lanes AND touchpoint tones. The tones used to get set membership and a
 * `size > 0` guard while the lanes got a completeness check plus hover,
 * pressed, ring and text contrast in both themes — and the gap was
 * structural, not incidental: the regex below matched
 * `[data-blueprint-lane=…]` only, so all seven tones were excluded from every
 * contrast assertion in the file. Seven of our sixteen allocated families were
 * exempt from every check. They set the same seven properties from the same
 * ramps and render as cell surfaces exactly the way lanes do; there was never
 * a reason beyond the shape of one regex.
 */
describe.each([
  ['lane', 9],
  ['tone', 7],
] as const)('interaction states: %s', (attr, expectedCount) => {
  const css = stylesheet('blueprint.css').text
  /** Every `[data-blueprint-*]` rule, as role → { property: family-step }. */
  const laneRules = [
    ...css.matchAll(
      new RegExp(`\\[data-blueprint-${attr}='([a-z-]+)'\\] \\{([^}]*)\\}`, 'g'),
    ),
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
    '--background-blueprint-cell-hover',
    '--background-blueprint-cell-pressed',
    '--ring-blueprint-cell',
    '--foreground-blueprint-cell',
  ]

  it('defines every state on every role', () => {
    // Nine lanes since `partner-action` landed (2026-08-21), seven tones. The
    // count is asserted so a role added to the type without a CSS block fails
    // here rather than rendering an unstyled row.
    expect(laneRules).toHaveLength(expectedCount)
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
