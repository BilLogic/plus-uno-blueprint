import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CELL_STEP } from '@/lib/blueprintCellStyle'
import {
  PATH_TYPE_COLORS,
  getPathColor,
  getPathDashArray,
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

describe('path badges', () => {
  const paths = Object.entries(PATH_TYPE_COLORS)

  describe.each(['light', 'dark'] as const)('%s', (theme) => {
    it.each(paths)('%s carries white text', (_type, token) => {
      // `getPathBadgeStyle` renders `--color-gray-100` on this fill.
      const fill = resolve(token, theme)
      const ink = resolve('--color-gray-100', theme)
      expect(contrast(fill, ink)).toBeGreaterThanOrEqual(4.5)
    })
  })

  describe.each(['light', 'dark'] as const)('%s open set', (theme) => {
    // The type defaults were measured above, but a named path draws its badge
    // from the open set — seven more fills that also render white text.
    const open = [
      ...new Set(
        Array.from({ length: 40 }, (_, i) =>
          getPathColor({ path_type: 'named', name: `Path ${i}` }),
        ),
      ),
    ]
    it.each(open)('%s carries white text', (token) => {
      const ink = resolve('--color-gray-100', theme)
      expect(contrast(resolve(token, theme), ink)).toBeGreaterThanOrEqual(4.5)
    })
  })

  it('separates two unregistered named paths', () => {
    const a = getPathColor({ path_type: 'named', name: 'Alpha' })
    const b = getPathColor({ path_type: 'named', name: 'Beta' })
    expect(a === b).toBe(false)
  })

  it('tells the named paths on the live board apart without colour', () => {
    // These five are what the database actually holds. They were all rendering
    // `7 4 2 4` — registered, so the dash fell through to the type default —
    // which left colour as the only channel (SC 1.4.1).
    const live = [
      'Set Goals',
      'Check Goals',
      'Update Goals',
      'Set Goals Edge Case',
      'Update Goals Edge Case',
    ]
    const dashes = live.map((name) =>
      getPathDashArray({ path_type: 'named', name }),
    )
    expect(new Set(dashes).size).toBe(live.length)
    const colours = live.map((name) =>
      getPathColor({ path_type: 'named', name }),
    )
    expect(new Set(colours).size).toBe(live.length)
  })

  it('pairs a distinct dash with every family in the open set', () => {
    // Colour and dash hash off the same key, so the pattern is a real second
    // channel for SC 1.4.1 only if the two lists are the same length.
    const seen = new Map<string, string | undefined>()
    for (let i = 0; i < 40; i++) {
      const path = { path_type: 'named' as const, name: `Path ${i}` }
      const colour = getPathColor(path)
      const dash = getPathDashArray(path)
      if (seen.has(colour)) expect(seen.get(colour)).toBe(dash)
      else seen.set(colour, dash)
    }
    expect(new Set(seen.values()).size).toBe(seen.size)
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
        getPathColor({ path_type: 'named', name: `Path ${i}` }),
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
      [...body.matchAll(/(--blueprint-cell-[a-z-]+):\s*var\(--color-([a-z]+-\d+)\)/g)]
        .map(([, prop, token]) => [prop, token]),
    ) as Record<string, string>,
  }))

  // Every property a lane role must define. Kept in step with the consumers:
  // a token nothing reads does not belong on the list, because then the test
  // is asserting the stylesheet against itself rather than against the app.
  const REQUIRED = [
    '--blueprint-cell-bg',
    '--blueprint-cell-bg-origin',
    '--blueprint-cell-bg-hover',
    '--blueprint-cell-bg-pressed',
    '--blueprint-cell-ring',
    '--blueprint-cell-ring-soft',
    '--blueprint-cell-text',
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
        const rest = at('--blueprint-cell-bg')
        // A state nobody can see is not a state.
        expect(contrast(rest, at('--blueprint-cell-bg-hover'))).toBeGreaterThan(1.03)
        expect(
          contrast(rest, at('--blueprint-cell-bg-pressed')),
        ).toBeGreaterThan(contrast(rest, at('--blueprint-cell-bg-hover')))
      },
    )

    it.each(laneRules.map((r) => [r.role, r] as const))(
      '%s: text stays legible on the hover and pressed surfaces too',
      (_role, { props }) => {
        const at = (key: string) =>
          THEMES[theme].get(props[key]) as [number, number, number]
        const text = at('--blueprint-cell-text')
        expect(contrast(text, at('--blueprint-cell-bg-hover'))).toBeGreaterThanOrEqual(4.5)
        expect(contrast(text, at('--blueprint-cell-bg-pressed'))).toBeGreaterThanOrEqual(4.5)
      },
    )
  })
})
