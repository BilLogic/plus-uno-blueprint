import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * One queryable model of the visual vocabulary. Test-time only.
 *
 * Style rules used to be enforced by five independent files — `tokenDiscipline`,
 * `palette`, `motion`, `canvasStackingContract`, `railRhythmContract` — each
 * reading its own hand-picked subset of the tree with its own regex. Each
 * therefore sampled the region where its property already held: the palette
 * guard asserted that path colours stay off the lane families while sampling
 * only the one path type that cannot collide, the raw-value guard skipped
 * `src/lib/`, where the values it forbids already lived, and the motion guard
 * read two of the three stylesheets that declare an animation.
 *
 * A sixth ad-hoc guard would have reproduced the blind spot a sixth time. So
 * this module is the single seam (ADR 0001): it answers what is declared,
 * where, at what value under each theme, and who consumes it — and every rule
 * becomes an assertion against those answers rather than a new file reader.
 * Widen the sampling here and every rule inherits the fix.
 *
 * NOT in the model yet: the compiled artifact. ADR 0001 makes it an input
 * because liveness — "does this name still have a consumer" — cannot be read
 * off source alone (`--colors-white` has zero occurrences in compiled CSS and
 * one in the bundle, via an inline style). Nothing asserted today needs it;
 * the deletion phase does, and it is the phase that must build it. Its stated
 * prerequisite — excluding `docs/` from Tailwind's content scan, so that a
 * token named in a planning document does not generate the class cited as
 * evidence that it is live — is already in `styles/tailwind.config.css`.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '..')
const STYLES = resolve(SRC, 'styles')
/** The stylesheet entry. Import order is read from it, never restated here. */
const ENTRY = resolve(STYLES, 'tailwind.config.css')

export type Theme = 'light' | 'dark'

/**
 * Which layer a name is declared in. A name may appear in exactly one.
 *
 * `dial` is the small set of per-theme inputs; `primitive` the ramps in
 * `colors.css` and the Figma export in `global.css`; `semantic` the derived
 * answers to questions a component asks; `domain` the board's own vocabulary
 * in `blueprint.css`; `registry` the `@theme` keys that mint utilities.
 */
export type TokenLayer =
  | 'dial'
  | 'primitive'
  | 'semantic'
  | 'domain'
  | 'registry'

export type Declaration = {
  /** `--surface-hue` */
  name: string
  /** Right-hand side, trimmed, `var()`s intact. */
  value: string
  /** The selector list the declaration sits under, e.g. `:root, .light`. */
  selector: string
  /**
   * The at-rules and outer selectors wrapping it, outermost first — e.g.
   * `['@media print']` for the print override block. A declaration inside a
   * print-only block is not part of the screen cascade, and a model that
   * could not see that reported `print.css` as the winner for every dial.
   */
  context: string[]
  /** Path relative to `src/styles`, e.g. `themes/light.css`. */
  file: string
  line: number
  layer: TokenLayer
}

export type Consumer = {
  /** The name consumed, e.g. `--motion-micro`. */
  name: string
  /** Path relative to `src`, e.g. `components/editor/CanvasPenCursor.tsx`. */
  file: string
  line: number
  kind: 'stylesheet' | 'source'
}

export type SourceFile = {
  /** Path relative to `src`. */
  file: string
  /** Contents with comments stripped — a comment naming a class is not a use. */
  code: string
}

export type Stylesheet = {
  /** Path relative to `src/styles`. */
  file: string
  text: string
  /**
   * Position in the cascade. Files the entry imports carry their import index;
   * a stylesheet the entry never imports is not in the cascade at all.
   */
  order: number
}

// ---------------------------------------------------------------------------
// Stylesheets
// ---------------------------------------------------------------------------

function layerOf(file: string): TokenLayer {
  if (file.startsWith('themes/')) return 'dial'
  if (file === 'colors.css' || file === 'global.css') return 'primitive'
  if (file === 'theme.css' || file === 'unset-tw-colors.css') return 'registry'
  if (file === 'blueprint.css') return 'domain'
  return 'semantic'
}

let cachedSheets: Stylesheet[] | null = null

/**
 * Every stylesheet under `src/styles`, in cascade order.
 *
 * Order comes from the `@import` list in the entry sheet rather than from a
 * list here, because the entry's own header says source order is what breaks
 * the `:root`-versus-`.dark` tie — a model that guessed the order would be
 * wrong about exactly the case that matters.
 */
export function stylesheets(): Stylesheet[] {
  if (cachedSheets) return cachedSheets
  const entry = readFileSync(ENTRY, 'utf8')
  const imported = [...entry.matchAll(/@import\s+'\.\/([^']+)'/g)].map(
    ([, path]) => path,
  )
  const onDisk = cssFiles(STYLES).map((path) =>
    relative(STYLES, path).split('\\').join('/'),
  )
  const ordered = [
    ...imported,
    ...onDisk.filter((file) => !imported.includes(file)).sort(),
  ]
  cachedSheets = ordered.map((file, order) => ({
    file,
    text: readFileSync(resolve(STYLES, file), 'utf8'),
    // Files the entry never imports sort after everything it does, and are
    // excluded from cascade resolution below.
    order: imported.includes(file) ? order : Number.POSITIVE_INFINITY,
  }))
  return cachedSheets
}

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry)
    if (statSync(path).isDirectory()) return cssFiles(path)
    return entry.endsWith('.css') ? [path] : []
  })
}

/** One stylesheet by its path relative to `src/styles`. */
export function stylesheet(file: string): Stylesheet {
  const sheet = stylesheets().find((entry) => entry.file === file)
  if (!sheet) throw new Error(`no such stylesheet: ${file}`)
  return sheet
}

// ---------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------

let cachedDeclarations: Declaration[] | null = null

/**
 * Every custom property declared anywhere under `src/styles`, in cascade order.
 *
 * The parser tracks the selector each declaration sits under by watching brace
 * depth: at depth 1 inside a top-level rule the selector is that rule's, and
 * a nested rule (`&:hover`, a media query's child) reports the nesting joined
 * by a space. That is enough to answer "does this rule apply under `.dark`",
 * which is the only question the cascade resolver asks.
 */
export function declarations(): Declaration[] {
  if (cachedDeclarations) return cachedDeclarations
  cachedDeclarations = allDeclarations().filter((entry) =>
    entry.name.startsWith('--'),
  )
  return cachedDeclarations
}

/**
 * Every rule that declares a given CSS property, anywhere in the tree.
 *
 * The motion guard is why this is here rather than in one test: it read two of
 * the three stylesheets that declare an `animation:`, so a keyframe in
 * `utilities.css` with no reduced-motion branch was invisible to it. A guard
 * that picks its own files picks the ones where its property already holds.
 */
export function rulesDeclaring(property: string): Declaration[] {
  return allDeclarations().filter((entry) => entry.name === property)
}

let cachedAll: Declaration[] | null = null

/**
 * Every declaration in every stylesheet, with the selector it sits under.
 *
 * A character scanner rather than a per-line regex, because the per-line
 * version could only see a declaration that closed its own line. Forty-one did
 * not — `--background`, `--foreground`, `--card`, `--popover`, `--secondary`,
 * `--muted-foreground`, `--tertiary-foreground`, the whole contrast ladder and
 * every chart step are written as multi-line `oklch(…)` calls, so the seam ADR
 * 0001 makes the single source of truth about the token layer was blind to the
 * most-read names in it. `compat.css`'s aliases pointed at two of them, and the
 * rule "an alias points at a name semantic.css declares" failed on names
 * semantic.css plainly declares.
 *
 * Values are whitespace-collapsed so a declaration means the same thing
 * whichever way it was wrapped.
 */
function allDeclarations(): Declaration[] {
  if (cachedAll) return cachedAll
  const out: Declaration[] = []
  for (const sheet of stylesheets()) {
    const layer = layerOf(sheet.file)
    const stack: string[] = []
    let buffer = ''
    let line = 1
    // The line the buffer's first non-blank character sits on, so a wrapped
    // declaration is reported where its name is, not where its `;` is.
    let bufferLine = 1
    const flush = () => {
      const declaration = /^\s*(-{2}[a-zA-Z0-9-]+|[a-z-]+)\s*:\s*([\s\S]*)$/.exec(
        buffer,
      )
      if (declaration) {
        out.push({
          name: declaration[1],
          value: declaration[2].trim().replace(/\s+/g, ' '),
          selector: stack[stack.length - 1] ?? '',
          context: stack.slice(0, -1),
          file: sheet.file,
          line: bufferLine,
          layer,
        })
      }
      buffer = ''
    }
    for (const char of blankComments(sheet.text)) {
      if (char === '\n') line += 1
      if (char === '{') {
        stack.push(buffer.trim().replace(/\s+/g, ' '))
        buffer = ''
      } else if (char === '}') {
        // An unterminated final declaration (`color: red }`) is still one.
        flush()
        stack.pop()
      } else if (char === ';') {
        flush()
      } else {
        if (!buffer.trim() && char.trim()) bufferLine = line
        buffer += char
      }
    }
  }
  cachedAll = out
  return out
}

/**
 * Blank out `/* … *\/` while keeping every newline, so line numbers survive.
 *
 * Needed because the selector a declaration sits under is assembled from the
 * text before its `{`, and this codebase writes a paragraph of prose above
 * almost every block — a per-line comment strip left that prose glued to the
 * selector.
 */
function blankComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, ' '),
  )
}

/** Every declaration in one stylesheet. */
export function declarationsIn(file: string): Declaration[] {
  return declarations().filter((entry) => entry.file === file)
}

/** The distinct names one stylesheet declares. */
export function namesIn(file: string): Set<string> {
  return new Set(declarationsIn(file).map((entry) => entry.name))
}

// ---------------------------------------------------------------------------
// Cascade
// ---------------------------------------------------------------------------

/**
 * Does this selector list apply to the root element under `theme`?
 *
 * `:root`, `.light` and `.dark` all carry specificity (0,1,0), so whichever
 * rule comes last in source order wins — which is the whole mechanism behind
 * the warm-brown dark mode: `themes/light.css` matches bare `:root`, `:root`
 * matches `<html class="dark">`, and light imports before dark but after
 * `semantic.css`. Anything more specific, or scoped to a subtree, is not the
 * root cascade and is skipped.
 */
function appliesAtRoot(selector: string, theme: Theme): boolean {
  if (!selector) return false
  return selector.split(',').some((part) => {
    const trimmed = part.trim()
    if (trimmed === ':root') return true
    if (trimmed === '.light') return theme === 'light'
    if (trimmed === '.dark') return theme === 'dark'
    // next-themes stamps the class on documentElement, so `:root.light` and
    // friends are the same element wearing both.
    if (trimmed === ':root.light' || trimmed === 'html.light')
      return theme === 'light'
    if (trimmed === ':root.dark' || trimmed === 'html.dark')
      return theme === 'dark'
    return false
  })
}

/**
 * The declaration that wins at the root element under `theme`, or undefined.
 *
 * This is the assertion that would have caught the hue defect: ask what
 * `--surface-hue` actually resolves to under `.dark` rather than what the
 * comment beside it claims.
 */
export function winningDeclaration(
  name: string,
  theme: Theme,
): Declaration | undefined {
  const order = new Map(stylesheets().map((sheet) => [sheet.file, sheet.order]))
  let winner: Declaration | undefined
  for (const entry of declarations()) {
    if (entry.name !== name) continue
    if (!Number.isFinite(order.get(entry.file) ?? Infinity)) continue
    if (entry.context.some((rule) => /^@media\b/.test(rule) && /\bprint\b/.test(rule)))
      continue
    if (entry.context.some((rule) => rule && !/^@(media|supports|layer)\b/.test(rule)))
      continue
    if (!appliesAtRoot(entry.selector, theme)) continue
    winner = entry
  }
  return winner
}

/**
 * The value of `name` at the root under `theme`, with `var()` chased through.
 *
 * Falls back to a `var()`'s own default (`var(--x, 12px)`) when the referenced
 * name resolves to nothing, which is what the browser does.
 */
export function resolveValue(
  name: string,
  theme: Theme,
  seen: Set<string> = new Set(),
): string | undefined {
  if (seen.has(name)) return undefined
  seen.add(name)
  const declaration = winningDeclaration(name, theme)
  if (!declaration) return undefined
  return substitute(declaration.value, theme, seen)
}

function substitute(value: string, theme: Theme, seen: Set<string>): string {
  return value.replace(
    /var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^()]*))?\)/g,
    (whole, referenced: string, fallback: string | undefined) => {
      const resolved = resolveValue(referenced, theme, new Set(seen))
      if (resolved !== undefined) return resolved
      if (fallback !== undefined) return fallback.trim()
      return whole
    },
  )
}

// ---------------------------------------------------------------------------
// Consumers
// ---------------------------------------------------------------------------

const SOURCE_ROOTS = ['components', 'contexts', 'hooks', 'lib', 'data', 'config.ts']

let cachedSource: SourceFile[] | null = null

/**
 * Every non-test TypeScript file under `src`, comments stripped.
 *
 * The roots are everything that can carry a class string or an inline style —
 * `lib/`, `hooks/` and `contexts/` included, which is the sampling gap that
 * let `lib/filterToolbarButton.ts` carry the exact patterns the raw-value
 * guard forbids while that guard read only `components/`.
 */
export function sourceFiles(): SourceFile[] {
  if (cachedSource) return cachedSource
  const files: string[] = []
  for (const root of SOURCE_ROOTS) {
    const path = resolve(SRC, root)
    let stats
    try {
      stats = statSync(path)
    } catch {
      continue
    }
    if (stats.isDirectory()) files.push(...tsFiles(path))
    else files.push(path)
  }
  cachedSource = files
    .map((path) => ({
      file: relative(SRC, path).split('\\').join('/'),
      code: stripComments(readFileSync(path, 'utf8')),
    }))
    .sort((a, b) => a.file.localeCompare(b.file))
  return cachedSource
}

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry)
    if (statSync(path).isDirectory()) return tsFiles(path)
    if (!/\.tsx?$/.test(entry)) return []
    if (entry.includes('.test.')) return []
    return [path]
  })
}

/** A comment naming the class it replaced is not a use of that class. */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

let cachedConsumers: Consumer[] | null = null

/**
 * Everywhere a custom property is read: `var(--x)` in a stylesheet, `var(--x)`
 * in a class string or template literal, and `'--x': value` as an inline style
 * key. The last of those is why a stylesheet-only scan cannot answer liveness.
 */
export function consumers(): Consumer[] {
  if (cachedConsumers) return cachedConsumers
  const out: Consumer[] = []
  const push = (
    text: string,
    file: string,
    kind: Consumer['kind'],
    pattern: RegExp,
  ) => {
    text.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(pattern)) {
        out.push({ name: match[1], file, line: index + 1, kind })
      }
    })
  }
  for (const sheet of stylesheets()) {
    push(sheet.text, sheet.file, 'stylesheet', /var\(\s*(--[a-zA-Z0-9-]+)/g)
  }
  for (const source of sourceFiles()) {
    push(source.code, source.file, 'source', /var\(\s*(--[a-zA-Z0-9-]+)/g)
    push(source.code, source.file, 'source', /['"`](--[a-zA-Z0-9-]+)['"`]\s*:/g)
  }
  cachedConsumers = out
  return cachedConsumers
}

/** Every read of one name. */
export function consumersOf(name: string): Consumer[] {
  return consumers().filter((entry) => entry.name === name)
}

// ---------------------------------------------------------------------------
// Class strings
// ---------------------------------------------------------------------------

export type ClassUse = {
  /** The utility as written, e.g. `z-[30]` or `border-border/60`. */
  utility: string
  file: string
  line: number
}

let cachedClassUses: ClassUse[] | null = null

/**
 * Every utility-shaped token that appears inside a quoted string in source.
 *
 * Quoted-string-only on purpose: it keeps identifiers, imports and prose out
 * of the sample without needing to know which prop a string ends up on.
 */
export function classUses(): ClassUse[] {
  if (cachedClassUses) return cachedClassUses
  const out: ClassUse[] = []
  for (const source of sourceFiles()) {
    source.code.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)) {
        const body = match[1] ?? match[2] ?? match[3] ?? ''
        for (const token of body.split(/\s+/)) {
          if (!token) continue
          if (!/^[-a-z@[\]:.]/i.test(token)) continue
          out.push({ utility: token, file: source.file, line: index + 1 })
        }
      }
    })
  }
  cachedClassUses = out
  return cachedClassUses
}

/** Every class use matching a pattern, as `file:line: utility` strings. */
export function classUsesMatching(pattern: RegExp): string[] {
  return classUses()
    .filter((use) => {
      pattern.lastIndex = 0
      return pattern.test(use.utility)
    })
    .map((use) => `${use.file}:${use.line}: ${use.utility}`)
}

/** Every source line matching a pattern, as `file:line: match` strings. */
export function sourceMatching(pattern: RegExp): string[] {
  const out: string[] = []
  for (const source of sourceFiles()) {
    source.code.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(pattern)) {
        out.push(`${source.file}:${index + 1}: ${match[0]}`)
      }
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

export type Rgb = [number, number, number]

export function hslToRgb(h: number, s: number, l: number): Rgb {
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

/** OKLCH → linear sRGB (Björn Ottosson's matrices). */
export function oklchToLinearSrgb(l: number, c: number, hDeg: number): Rgb {
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

export const inSrgbGamut = (rgb: Rgb) =>
  rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6)

/** Gamma-encoded sRGB, so these values meet the `Rgb` the solver expects. */
export function oklch(l: number, c: number, hDeg: number): Rgb {
  return oklchToLinearSrgb(l, c, hDeg).map((v) => {
    const clamped = Math.min(1, Math.max(0, v))
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * clamped ** (1 / 2.4) - 0.055
  }) as Rgb
}

/** Gamma-encoded sRGB → OKLCH triple. */
export function oklchFromSrgb([r, g, b]: Rgb): [number, number, number] {
  const lin = (v: number) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const l_ = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m_ = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s_ = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const B2 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  return [L, Math.hypot(A, B2), ((Math.atan2(B2, A) * 180) / Math.PI + 360) % 360]
}

/** OKLCH hue in degrees for a gamma-encoded sRGB colour. */
export function oklchHue(rgb: Rgb): number {
  return oklchFromSrgb(rgb)[2]
}

/** Largest in-gamut chroma at this lightness and hue, to 4dp. */
export function chromaCeiling(l: number, hDeg: number): number {
  let lo = 0
  let hi = 0.5
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (inSrgbGamut(oklchToLinearSrgb(l, mid, hDeg))) lo = mid
    else hi = mid
  }
  return lo
}

export function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (v: number) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  )
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2))
}

/**
 * The ink `[data-blueprint-fill]` derives for a fill, mirrored in JS.
 *
 * The CSS is `oklch(from <fill> clamp(0.12, calc((0.62 - l) * 100), 0.99)
 * calc(c * 0.08) h)` — Supabase's `*-foreground` formula. The clamp is a step
 * function in practice: any fill below L 0.62 gets L 0.99 ink, anything above
 * gets 0.12, because the multiplier is 100. Chroma drops to 8% so the ink is
 * tinted rather than stark, and the hue rides along.
 *
 * Mirrored rather than asserted against one hard-coded ink, because a
 * hard-coded ink is exactly what this pairing replaced.
 */
export function derivedFillInk(fill: Rgb): Rgb {
  const [l, c, h] = oklchFromSrgb(fill)
  const inkL = Math.min(0.99, Math.max(0.12, (0.62 - l) * 100))
  return oklch(inkL, c * 0.08, h)
}

const scaleCache = new Map<Theme, Map<string, Rgb>>()

/**
 * The `--color-{family}-{step}` ramps for one theme, keyed `family-step`.
 *
 * Read straight off `colors.css`: light in the leading `:root` block, dark in
 * the `@media screen` block that follows it.
 */
export function palette(theme: Theme): Map<string, Rgb> {
  const cached = scaleCache.get(theme)
  if (cached) return cached
  const css = stylesheet('colors.css').text
  const darkStart = css.indexOf('@media screen {')
  const block =
    theme === 'light'
      ? css.slice(css.indexOf(':root {'), darkStart)
      : css.slice(darkStart)
  const scale = new Map<string, Rgb>()
  const declaration =
    /--color-([a-z]+)-(\d+):\s*hsla?\(\s*([\d.]+)(?:deg)?,\s*([\d.]+)%,\s*([\d.]+)%/g
  for (const [, family, step, h, s, l] of block.matchAll(declaration)) {
    scale.set(`${family}-${step}`, hslToRgb(Number(h), Number(s), Number(l)))
  }
  return scaleCache.set(theme, scale), scale
}

/** Resolve a `var(--color-family-step)` string against one theme. */
export function resolvePaletteToken(token: string, theme: Theme): Rgb {
  const match = /--color-([a-z]+-\d+)/.exec(token)
  if (!match) throw new Error(`not a palette token: ${token}`)
  const value = palette(theme).get(match[1])
  if (!value) throw new Error(`missing from colors.css: ${match[1]}`)
  return value
}

/** A numeric dial's value at the root under `theme`. */
export function dial(name: string, theme: Theme): number {
  const value = resolveValue(name, theme)
  if (value === undefined) throw new Error(`dial not declared: ${name}`)
  const number = /^-?[\d.]+/.exec(value.trim())
  if (!number) throw new Error(`dial ${name} is not numeric under ${theme}: ${value}`)
  return Number(number[0])
}
