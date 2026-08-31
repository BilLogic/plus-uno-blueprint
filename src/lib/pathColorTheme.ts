import type { CSSProperties } from 'react'
import type { PathType } from '@/types/database'

export type PathColorInput = {
  path_type: PathType
  name: string
}

/**
 * Primary accent per path type — the default when a path's own name is not
 * pinned and its type is not one of the open-ended two.
 *
 * Radix step 1100, not the Tailwind v3 defaults these used to be (#10B981 and
 * friends). The step is what makes these fills carriable: the old values
 * measured 2.0–2.9:1 against the ink a badge puts on them — the amber one
 * worst. Step 11 is Radix's text weight; `palette.test.ts` measures every
 * entry's DERIVED ink (see `[data-blueprint-fill]` in blueprint.css) against
 * the stylesheet to keep that true.
 *
 * Historical note, since the reasoning below reads oddly otherwise: these
 * were chosen when badges spelled `text-white` at eight call sites. The ink
 * is derived from the fill now, so the constraint is no longer "legible under
 * white" but "yields legible ink" — which these already satisfy.
 *
 * `unhappy` is orange rather than amber for the same reason: amber's step
 * 9/10 are near-yellow and carry almost no contrast either way, so the whole
 * family would have had to be read at a different step from every other path
 * type.
 */
export const PATH_TYPE_COLORS: Record<PathType, string> = {
  happy: 'var(--color-green-1100)',
  /** Fallback only — variant and exception paths read the open set below. */
  variant: 'var(--color-indigo-1100)',
  exception: 'var(--color-red-1100)',
}

/**
 * Stroke color for blueprint dependency arrows — step 1000, one notch lighter than
 * the badge, so a stroke reads as related to the label it belongs to without
 * being the same value. Same family per path type as `PATH_TYPE_COLORS`.
 */
export const PATH_TYPE_ARROW_COLORS: Record<PathType, string> = {
  happy: 'var(--color-green-1000)',
  variant: 'var(--color-indigo-1000)',
  exception: 'var(--color-red-1000)',
}

/** Stable identity for path colors across scenarios (same type + name → same color). */
export function getPathColorKey(path: PathColorInput): string {
  return `${path.path_type}:${path.name}`
}

/**
 * The families a VARIANT may be drawn from.
 *
 * Green and red are spoken for: green is always the happy path, red is always
 * an exception. Those two are fixed so a reader can trust them at a glance
 * without learning anything — red means trouble, everywhere, always. What is
 * left identifies variants, which are the only type a scenario holds several
 * of at once.
 *
 * Deliberately disjoint from the nine lane families, and `palette.test.ts`
 * holds that. (Eight until `partner-action` landed on 2026-08-21; the comment
 * went stale the same day and said "eight" for a year of commits.) Before
 * this, the open set drew on ten families including green, blue, violet and
 * pink, so a path could render as a 2px line in exactly the hue of the lane it
 * crossed. Four of the five open paths on the live board did: `Check Goals`
 * was violet over the violet frontstage-touchpoint lane, `Update Goals` pink over
 * the pink frontstage-action lane.
 *
 * The disjointness holds for the OPEN set. It does not hold for the path
 * TYPES: `happy` is green and the `actor` lane is green. That is not fixable
 * by reallocation — nine lanes plus seven touchpoint tones is all sixteen
 * families, so `happy` cannot move without displacing something else that is
 * on screen. What holds it together is the weight: a path is a step-1100 line,
 * a lane is a step-400 fill. `palette.test.ts` asserts that the overlap is
 * exactly one, named, and drawn at a heavier step than the lane it crosses.
 *
 * Crimson and tomato went out with red: a variant that reads as trouble is
 * worse than one that reads as nothing in particular.
 *
 * Sharing the touchpoint tone set rather than inventing a third is safe because
 * the two never render at the same weight — a tone is a step-400 touchpoint fill, a
 * path is a step-1100 line.
 */
const PATH_OPEN_FAMILIES = ['indigo', 'purple', 'gold', 'yellow'] as const

const step = (family: string, weight: 1000 | 1100) =>
  `var(--color-${family}-${weight})`

/**
 * Pinned non-happy paths, as a *slot* in the open set rather than a colour.
 *
 * Colour and stroke pattern are both read from this one number, so the pair can
 * never drift — the same guarantee the hash gives an unregistered path, stated
 * explicitly for the ones that actually render. Pinning only the colour is what
 * left all five of these sharing a single dash: they were in the registry, so
 * `getPathDashArray` fell through to the type default and every non-happy path on
 * the board came out `7 4 2 4`. Colour was doing all the work, which is the
 * exact failure SC 1.4.1 describes.
 */
const PINNED_PATH_SLOTS: Record<string, number> = {
  'Set Goals': 0,
  'Update Goals': 1,
  'Check Goals': 2,
  'Set Goals Edge Case': 3,
  'Update Goals Edge Case': 4,
}

/** The open set, by slot. Step 1100, the badge weight. */
const EXTENDED_PATH_COLORS = PATH_OPEN_FAMILIES.map((f) =>
  step(f, 1100),
) as readonly string[]

/** The same set one step lighter, for arrow strokes. */
const EXTENDED_ARROW_COLORS = PATH_OPEN_FAMILIES.map((f) =>
  step(f, 1000),
) as readonly string[]

/**
 * Stroke pattern per path type — the non-colour half of path identity.
 *
 * Paths were distinguishable by hue alone, which fails SC 1.4.1 (use of colour)
 * and is also just hard to read where two arrows cross. `undefined` means a
 * solid stroke, kept for the happy path so the common case stays cleanest.
 *
 * Patterns are tuned for the 2px arrow stroke: shorter than ~2px reads as a
 * dotted blur at overview zoom, longer than ~12px stops repeating within a
 * short segment.
 */
const PATH_TYPE_DASH: Record<PathType, string | undefined> = {
  happy: undefined,
  variant: '12 5',
  exception: '2 4',
}

/**
 * Extra patterns for the types that can have many distinct paths at once, hashed
 * the same way `EXTENDED_PATH_COLORS` is so a path's dash and colour stay paired.
 *
 * One per family in `PATH_OPEN_FAMILIES`. There used to be five against ten
 * colours, which meant two open paths could share a dash — fine while colour is
 * visible, and exactly the case SC 1.4.1 is about when it is not. Matching the
 * lengths makes the pattern a real second channel rather than a decoration.
 */
const EXTENDED_PATH_DASHES = [
  '7 4 2 4',
  '12 5',
  '2 4',
  '10 4 2 4 2 4',
  '5 5',
  '3 3 9 3',
  '14 4 3 4',
] as const

/**
 * How many distinct (colour, dash) pairs exist before one repeats.
 *
 * Colour and dash index the same slot through lists of different length, so
 * the pair's period is their lowest common multiple. The lengths are kept
 * COPRIME on purpose: equal lengths would lock one colour to one dash, making
 * the second channel redundant with the first — two paths sharing a colour
 * would share a dash too, and be indistinguishable to a reader who cannot
 * separate the hues (SC 1.4.1).
 */
export const PATH_IDENTITY_PERIOD =
  PATH_OPEN_FAMILIES.length * EXTENDED_PATH_DASHES.length


/**
 * Dash pattern for a path's arrows and section borders, paired with
 * {@link getPathColor} through the same slot so the two never come apart.
 *
 * The happy path is the one route a scenario can only have one of, so it takes
 * the type default — solid — and every other route reads the open set, pinned
 * by slot where we know the name and hashed where we do not.
 *
 * The dash is not decoration. Only seven colour families are disjoint from the
 * eight the lanes use, which is not enough to give `variant` and `exception` a
 * hue each AND keep paths of the same type apart — so hue cannot carry type,
 * and the pattern is what a reader who cannot separate the hues has left.
 * SC 1.4.1.
 */
export function getPathDashArray(path: PathColorInput): string | undefined {
  if (path.path_type === 'happy') return PATH_TYPE_DASH.happy
  return EXTENDED_PATH_DASHES[pathSlot(path) % EXTENDED_PATH_DASHES.length]
}

/**
 * Same, from the `${type}:${name}` key the arrow lanes already carry on each
 * segment. Bare `'happy'` (no colon) is the legacy default-path key.
 */
export function getPathDashArrayFromKey(colorKey: string): string | undefined {
  const separator = colorKey.indexOf(':')
  if (separator === -1) {
    return PATH_TYPE_DASH[colorKey as PathType] ?? undefined
  }
  return getPathDashArray({
    path_type: colorKey.slice(0, separator) as PathType,
    name: colorKey.slice(separator + 1),
  })
}

/**
 * FNV-1a, for its avalanche: one changed character moves the whole value.
 *
 * This was a plain sum of character codes until 2026-08-21, which has almost
 * no avalanche and is order-invariant besides. Two consequences, one
 * theoretical and one that had already shipped:
 *
 *   - Anagrams collided exactly. "Check Goals" and "Goals Check" — both
 *     plausible names for sibling routes here — took the same slot, so the
 *     same colour AND the same dash.
 *   - Worse, the live board carried a real collision: Wrap-Up's two variants,
 *     "Lead works from a dashboard" and "Redesigned reflection", landed on
 *     family 1 dash 3 together. Two sibling paths in one scenario, drawn
 *     identically, with nothing on screen to tell them apart.
 *
 * The second is why the dash matters so much for `exception` paths in
 * particular: they take the type colour, so every exception in a scenario is
 * the same red and the dash is their ONLY distinguishing channel. Variants get
 * a family as well, so for them it is the pair that must differ.
 *
 * Verified against all 17 non-happy paths on the board, grouped by scenario:
 * zero collisions. `Math.imul` keeps the 32-bit multiply exact.
 */
function hashKey(key: string): number {
  let hash = 0x811c9dc5
  for (const char of key) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return Math.abs(hash | 0)
}

/**
 * The one number a non-happy path's colour AND dash are both read from, so the
 * two can never come apart.
 *
 * Keyed on the NAME alone, never `${type}:${name}`. The registry used to key on
 * both, which meant re-typing a path silently dropped it out of its pinned slot
 * and back into the hash — and that is exactly what happened on 2026-08-21 when
 * the five Goal Setting paths moved off `custom`. A path's identity is what it
 * is called; its type is a fact about it.
 */
function pathSlot(path: PathColorInput): number {
  return PINNED_PATH_SLOTS[path.name] ?? hashKey(path.name)
}

export function getPathColor(path: PathColorInput): string {
  if (path.path_type !== 'variant') return PATH_TYPE_COLORS[path.path_type]
  return EXTENDED_PATH_COLORS[pathSlot(path) % EXTENDED_PATH_COLORS.length]
}

export function getPathArrowColor(path: PathColorInput): string {
  if (path.path_type !== 'variant') return PATH_TYPE_ARROW_COLORS[path.path_type]
  return EXTENDED_ARROW_COLORS[pathSlot(path) % EXTENDED_ARROW_COLORS.length]
}

/**
 * Frame around a path's section. Solid for the happy path, dashed for anything
 * else, so the frame carries the same non-colour distinction the arrows do —
 * CSS borders take a style keyword rather than a dash array, so this is the
 * coarse version of {@link getPathDashArray}.
 */
export function getPathSectionBorderStyle(path: PathColorInput): {
  borderColor: string
  borderStyle: 'solid' | 'dashed'
  borderWidth: number
} {
  return {
    borderColor: getPathColor(path),
    borderStyle: getPathDashArray(path) ? 'dashed' : 'solid',
    borderWidth: 3,
  }
}

/**
 * Style for a badge filled with a path's colour.
 *
 * Returns the FILL as a custom property, not as `background-color`, and no
 * `color` at all: `[data-blueprint-fill]` in blueprint.css paints both halves
 * and derives the ink from the fill (Supabase's `*-foreground` pattern). Every
 * call site must carry `data-blueprint-fill` for this to apply — which is the
 * point, since it is what makes the ink impossible to get wrong. `text-white`
 * used to be spelled out at eight of them and measured 1.17–2.33:1 in dark
 * mode; `palette.test.ts` measures the derived ink against every fill.
 */
export function getPathBadgeStyle(path: PathColorInput): CSSProperties {
  return {
    [BLUEPRINT_FILL_PROPERTY]: getPathColor(path),
  } as CSSProperties
}

/** The property `[data-blueprint-fill]` reads. One name, one owner. */
export const BLUEPRINT_FILL_PROPERTY = '--background-blueprint-fill'

/** Any solid fill (not just a path colour) plus its derived ink. */
export function getBlueprintFillStyle(fill: string): CSSProperties {
  return { [BLUEPRINT_FILL_PROPERTY]: fill } as CSSProperties
}

/** URL-safe marker suffix from a path color key. */
export function pathColorKeyToMarkerSuffix(colorKey: string): string {
  return colorKey.replace(/[^a-zA-Z0-9]+/g, '-')
}
