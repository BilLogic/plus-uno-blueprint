import { describe, expect, it } from 'vitest'
import {
  declarations,
  declarationsIn,
  namesIn,
  resolveValue,
  winningDeclaration,
} from '@/lib/tokenModel'

/**
 * The dials, and the rule that keeps the two themes honest.
 *
 * `themes/light.css` declares its block on `:root, .light`, and `:root`
 * matches `<html class="dark">` — next-themes puts the class on
 * documentElement. `:root` and `.dark` both carry specificity (0,1,0), and
 * light imports after `semantic.css`, so a dial light declares and dark omits
 * does not fall back to the semantic default: it silently becomes dark's
 * value too.
 *
 * That ran every dark surface at `--surface-hue: 34` — warm brown — for
 * months, under a comment in `themes/dark.css` asserting the opposite. The
 * comment was the reason nobody looked.
 *
 * The structural alternative, scoping light to `.light` the way upstream
 * scopes `[data-theme='light']`, is NOT what we do: `index.html` ships no
 * theme class, so the first paint before next-themes mounts would have no
 * dials at all. Light stays the `:root` default, and this file is what makes
 * that safe — a dial light declares is a dial dark declares.
 */

const LIGHT = 'themes/light.css'
const DARK = 'themes/dark.css'
const PRINT = 'print.css'

/**
 * Dials light may declare alone, because they are mode-invariant and leaking
 * into dark is the intended behaviour rather than an accident.
 *
 * Empty on purpose. It is not decoration: the assertion below re-derives each
 * listed name under both themes and fails if it is not actually invariant, so
 * a wrong exemption is caught rather than trusted. `--radius` used to belong
 * here, and then spent a month in `semantic.css`; it is now declared in both
 * theme files at one value, which is what a mode-invariant dial looks like
 * once parity rather than a leak is what carries it into dark (#459).
 */
const MODE_INVARIANT_IN_LIGHT: string[] = []

/**
 * The dials this deployment authors at one value for both modes.
 *
 * They are inputs, not derivations, so `semantic.css` is the wrong home for
 * them however invariant they are — that file is the derivation layer, and a
 * literal sitting in it is the only thing keeping it from being byte-identical
 * with the template's copy.
 *
 * Both files, same value, is the mechanism and not merely tidiness. A
 * mode-invariant value written into `themes/light.css` alone reaches dark
 * through the bare `:root` at the head of that file's selector list — the
 * identical leak that ran every dark surface at light's warm grey for months,
 * silently, under a comment claiming otherwise. Written into both, there is
 * nothing for the leak to carry, and the assertions below make the two
 * impossible to drift apart. #459.
 */
const AUTHORED_IN_BOTH = [
  '--radius',
  '--primary-lightness',
  '--primary-chroma',
  '--ring-lightness',
]

/** What one theme file declares a name as, or `ABSENT`. */
const valueIn = (file: string, name: string) =>
  declarationsIn(file).find((entry) => entry.name === name)?.value ?? 'ABSENT'

/**
 * Dials `print.css` need not restate.
 *
 * `--helpers-os-appearance` is a string ("Light" / "Dark"), not a colour
 * input, and nothing reads it — Supabase ships it for a helper we did not
 * fork. Every other dial whose dark value differs from its light one has to be
 * restated, because print's block overrides `.dark` at the same scope and a
 * dial it skips keeps dark's value on white paper.
 */
const NOT_PRINTED = ['--helpers-os-appearance']

/**
 * Dials print restates at its own value, on purpose.
 *
 * Paper is not a screen: the light theme's near-white surface (0.995) leaves a
 * raised plate nowhere to go once it clips at the page, so print sits the
 * canvas a shade lower and shortens the elevation step to match. Listed rather
 * than allowed silently, so the next divergence has to be argued for.
 */
const PRINT_DIVERGES = ['--surface', '--elevation-step']

describe('theme dials', () => {
  it('reads both theme files', () => {
    // A selector or format change that broke the parser would otherwise make
    // every assertion below pass against an empty set.
    expect(declarationsIn(LIGHT).length).toBeGreaterThan(20)
    expect(declarationsIn(DARK).length).toBeGreaterThan(20)
  })

  it('declares in dark every dial it declares in light', () => {
    const leaked = [...namesIn(LIGHT)]
      .filter((name) => !namesIn(DARK).has(name))
      .filter((name) => !MODE_INVARIANT_IN_LIGHT.includes(name))
      .sort()
    expect(leaked).toEqual([])
  })

  it('holds each exemption to being genuinely mode-invariant', () => {
    for (const name of MODE_INVARIANT_IN_LIGHT) {
      expect(resolveValue(name, 'light')).toBe(resolveValue(name, 'dark'))
    }
  })

  it('backs every dark-only dial with a default outside the theme files', () => {
    // The other direction is safe — `.dark` does not match a light root — but
    // only if something declares the light value. `--field-alpha` is the live
    // case: 0.015 in `semantic.css`, dug to 0.12 in dark because the light
    // value disappears on a dark plate.
    const darkOnly = [...namesIn(DARK)].filter((name) => !namesIn(LIGHT).has(name))
    const homes = darkOnly.map(
      (name) => `${name} <- ${winningDeclaration(name, 'light')?.file ?? 'NOTHING'}`,
    )
    expect(homes).toEqual(darkOnly.map((name) => `${name} <- semantic.css`))
  })

  it('declares every authored knob in both theme files, at one value', () => {
    const absent = AUTHORED_IN_BOTH.filter(
      (name) => valueIn(LIGHT, name) === 'ABSENT',
    )
    expect(absent).toEqual([])
    // Compared as a whole list rather than knob by knob so a failure names the
    // one that drifted, and without pinning the numbers — a retune of the
    // filled control is allowed to move them, together.
    const declared = AUTHORED_IN_BOTH.map(
      (name) => `${name}: ${valueIn(LIGHT, name)} / ${valueIn(DARK, name)}`,
    )
    expect(declared).toEqual(
      AUTHORED_IN_BOTH.map(
        (name) => `${name}: ${valueIn(LIGHT, name)} / ${valueIn(LIGHT, name)}`,
      ),
    )
  })

  it('declares the authored knobs nowhere else', () => {
    // All four sat in `semantic.css` until #459, and a copy left behind there
    // would be unreachable rather than a fallback: light's block opens on
    // `:root` and imports after it. `print.css` must not restate them either —
    // print exists to override a dark value with the light one, and there is
    // no dark value here to override.
    const strays = declarations()
      .filter((entry) => AUTHORED_IN_BOTH.includes(entry.name))
      .filter((entry) => entry.file !== LIGHT && entry.file !== DARK)
      .map((entry) => `${entry.file}:${entry.line} ${entry.name}`)
    expect(strays).toEqual([])
  })
})

describe('the print override', () => {
  /*
   * `print.css` forces the light dials under `@media print` so a dark-mode
   * page still prints dark-on-white. Its own header says it "must restate the
   * full dial set the light theme declares" — and it did not: the `--brand-*`,
   * `--warning-N` and `--destructive-N` ramps were missing, so a status badge
   * printed from dark mode drew `bg-warning-200` at dark's near-black.
   *
   * The Radix ramps in `colors.css` do not need this because their dark block
   * is already `@media screen`. The theme files' ramps are not.
   */
  it('restates every dial whose dark value differs from its light one', () => {
    const missing = [...namesIn(LIGHT)]
      .filter((name) => !namesIn(PRINT).has(name))
      .filter((name) => !NOT_PRINTED.includes(name))
      // A dial both themes declare identically has nothing for print to
      // override: whichever theme is on the root, the value on paper is
      // already light's. Stated as the property rather than as a growing
      // exemption list, so the day one of them stops being invariant this
      // asks for the restatement on its own.
      .filter((name) => resolveValue(name, 'light') !== resolveValue(name, 'dark'))
      .sort()
    expect(missing).toEqual([])
  })

  it('restates them at the light theme\'s own values', () => {
    const light = new Map(
      declarationsIn(LIGHT).map((entry) => [entry.name, entry.value]),
    )
    const drifted = declarationsIn(PRINT)
      .filter((entry) => light.has(entry.name))
      .filter((entry) => !PRINT_DIVERGES.includes(entry.name))
      .filter((entry) => entry.value !== light.get(entry.name))
      .map((entry) => `${entry.name}: ${entry.value} (light: ${light.get(entry.name)})`)
    expect(drifted).toEqual([])
  })
})

describe('what the dials resolve to', () => {
  // The assertion that would have caught the hue defect: what the cascade
  // actually produces at the root, not what a declaration says in isolation.

  it('runs both themes on the brand hue', () => {
    expect(resolveValue('--hue', 'light')).toBe('177.6')
    expect(resolveValue('--hue', 'dark')).toBe('177.6')
  })

  it('tints dark surfaces with the brand hue, not with light\'s warm grey', () => {
    // `--chroma: 0.005` in dark means this hue is visible on every surface
    // token derived through it. In light `--chroma` is 0, so 34 is moot there
    // and kept as the dial a tinted light theme would turn.
    expect(resolveValue('--surface-hue', 'dark')).toBe(
      resolveValue('--hue', 'dark'),
    )
    expect(resolveValue('--surface-hue', 'light')).toBe('34')
  })

  it('leaves no root declaration that cannot win under either theme', () => {
    /*
     * The fourth combination the invariant in `semantic.css` forbids: a name
     * declared there AND in every theme file.
     *
     * `themes/light.css` opens on `:root, .light` and imports after
     * `semantic.css`, so for any name both themes declare, the semantic
     * declaration loses under light (to light) and under dark (to dark). It
     * is not a fallback; nothing can ever read it. `--surface-hue: var(--hue)`
     * sat on the semantic root block in exactly that state, saying the thing
     * `themes/dark.css` used to only claim in a comment — and #121 fixed the
     * comment without noticing the declaration behind it was the same lie in
     * a different font.
     *
     * Stated over every root-scoped declaration in the sheet tree rather than
     * over a list of dial names, because the shape is not specific to dials
     * and a list would sample where the property already holds.
     */
    const ROOT_SELECTORS = new Set([
      ':root',
      '.light',
      '.dark',
      ':root.light',
      ':root.dark',
      'html.light',
      'html.dark',
    ])
    const unreachable = declarations()
      .filter((entry) =>
        entry.selector
          .split(',')
          .some((part) => ROOT_SELECTORS.has(part.trim())),
      )
      // `print.css` is a separate cascade; `themeDials` above holds it.
      .filter(
        (entry) =>
          !entry.context.some(
            (rule) => /^@media\b/.test(rule) && /\bprint\b/.test(rule),
          ),
      )
      .filter(
        (entry) =>
          !entry.context.some(
            (rule) => rule && !/^@(media|supports|layer)\b/.test(rule),
          ),
      )
      .filter(
        (entry) =>
          winningDeclaration(entry.name, 'light') !== entry &&
          winningDeclaration(entry.name, 'dark') !== entry,
      )
      .map((entry) => `${entry.file}:${entry.line} ${entry.name}`)
    expect(unreachable).toEqual([])
  })

  it('carries the radius dial into dark by parity, not by the `:root` leak', () => {
    // A corner does not flip with the theme, so `--radius` is the same value
    // in both files — and writing it in both is exactly what makes that safe.
    // Written in `themes/light.css` alone it would still reach dark, through
    // the bare `:root` at the head of that file's selector list; dark would be
    // running a value it never declared, which is the shape the warm-grey
    // defect had. Declared in both, dark's radius is dark's own, and the
    // parity assertion above is what stops the two from drifting apart.
    expect(namesIn(LIGHT).has('--radius')).toBe(true)
    expect(namesIn(DARK).has('--radius')).toBe(true)
    expect(winningDeclaration('--radius', 'light')?.file).toBe(LIGHT)
    expect(winningDeclaration('--radius', 'dark')?.file).toBe(DARK)
    expect(resolveValue('--radius', 'dark')).toBe(resolveValue('--radius', 'light'))
  })
})
