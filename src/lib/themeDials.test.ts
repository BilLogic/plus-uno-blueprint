import { describe, expect, it } from 'vitest'
import {
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
 * here and now lives in `semantic.css` instead — a value that is the same in
 * both themes is not a dial, and the honest home for it is the layer that
 * neither theme owns.
 */
const MODE_INVARIANT_IN_LIGHT: string[] = []

/**
 * Dials `print.css` need not restate.
 *
 * `--helpers-os-appearance` is a string ("Light" / "Dark"), not a colour
 * input, and nothing reads it — Supabase ships it for a helper we did not
 * fork. Everything else in the light dial set has to be restated, because
 * print's block overrides `.dark` at the same scope and a dial it skips keeps
 * dark's value on white paper.
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
  it('restates every dial the light theme declares', () => {
    const missing = [...namesIn(LIGHT)]
      .filter((name) => !namesIn(PRINT).has(name))
      .filter((name) => !NOT_PRINTED.includes(name))
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

  it('keeps the radius dial out of the theme files entirely', () => {
    // A corner does not flip with the theme, so `--radius` is not a dial a
    // theme owns. It reached dark mode only through the `:root` leak above.
    expect(namesIn(LIGHT).has('--radius')).toBe(false)
    expect(namesIn(DARK).has('--radius')).toBe(false)
    expect(winningDeclaration('--radius', 'dark')?.file).toBe('semantic.css')
    expect(resolveValue('--radius', 'dark')).toBe(resolveValue('--radius', 'light'))
  })
})
