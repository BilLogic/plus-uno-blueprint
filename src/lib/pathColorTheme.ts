import type { PathType } from '@/types/database'

export type PathColorInput = {
  path_type: PathType
  name: string
}

/**
 * Primary accent per path type — also used as defaults for unnamed paths.
 *
 * Radix step 1100, not the Tailwind v3 defaults these used to be (#10B981 and
 * friends). The step matters: `getPathBadgeStyle` renders white on this fill,
 * and the old values measured 2.0–2.9:1 against white — the amber one worst.
 * Step 11 is Radix's text weight; `palette.test.ts` measures every entry
 * against the stylesheet to keep that true.
 *
 * `unhappy` is orange rather than amber for the same reason: amber's step 9/10
 * are near-yellow and unusable under white text, so the whole family would have
 * had to be read at a different step from every other path type.
 */
export const PATH_TYPE_COLORS: Record<PathType, string> = {
  happy: 'var(--color-green-1100)',
  unhappy: 'var(--color-orange-1100)',
  exception: 'var(--color-red-1100)',
  alternative: 'var(--color-blue-1100)',
  /** Fallback only — named paths should use per-title registry colors. */
  named: 'var(--color-indigo-1100)',
}

/**
 * Stroke color for blueprint trigger arrows — step 1000, one notch lighter than
 * the badge, so a stroke reads as related to the label it belongs to without
 * being the same value. Same family per path type as `PATH_TYPE_COLORS`.
 */
export const PATH_TYPE_ARROW_COLORS: Record<PathType, string> = {
  happy: 'var(--color-green-1000)',
  unhappy: 'var(--color-orange-1000)',
  exception: 'var(--color-red-1000)',
  alternative: 'var(--color-blue-1000)',
  named: 'var(--color-indigo-1000)',
}

/** Stable identity for path colors across scenarios (same type + name → same color). */
export function getPathColorKey(path: PathColorInput): string {
  return `${path.path_type}:${path.name}`
}

/**
 * Canonical path colors — shared across every scenario.
 * Keys match `getPathColorKey` (`path_type:Path Name`).
 */
/**
 * The families a path may be drawn from once its identity is a *name* rather
 * than a type — the same seven the touchpoint tones use.
 *
 * Deliberately disjoint from the eight lane families, and `palette.test.ts`
 * holds that. Before this, the open set drew on ten families including green,
 * blue, violet and pink, so a named path could render as a 2px line in exactly
 * the hue of the lane it crossed. Four of the five named paths on the live
 * board did: `Check Goals` was violet over the violet frontstage-tech lane,
 * `Update Goals` pink over the pink frontstage-action lane.
 *
 * Sharing the tone set rather than inventing a third one is safe because the
 * two never render at the same weight: a tone is a step-400 pill fill, a path
 * is a step-1100 line and badge. Seven hundred steps apart, they cannot be
 * mistaken for each other, and there is one palette to learn instead of two.
 *
 * The order puts distant hues next to each other, so adjacent hashes do not
 * land on neighbours.
 */
const PATH_NAMED_FAMILIES = [
  'indigo',
  'tomato',
  'purple',
  'gold',
  'crimson',
  'yellow',
  'red',
] as const

const named = (family: string, step: 1000 | 1100) =>
  `var(--color-${family}-${step})`

export const PATH_COLOR_REGISTRY: Record<string, string> = {
  'happy:Happy Path': PATH_TYPE_COLORS.happy,
  'unhappy:Sad Path': PATH_TYPE_COLORS.unhappy,
  'alternative:Alternate Path': PATH_TYPE_COLORS.alternative,
  'named:Set Goals': named('indigo', 1100),
  'named:Check Goals': named('purple', 1100),
  'named:Update Goals': named('tomato', 1100),
  'named:Set Goals Edge Case': named('gold', 1100),
  'named:Update Goals Edge Case': named('crimson', 1100),
}

export const PATH_ARROW_COLOR_REGISTRY: Record<string, string> = {
  'happy:Happy Path': PATH_TYPE_ARROW_COLORS.happy,
  'unhappy:Sad Path': PATH_TYPE_ARROW_COLORS.unhappy,
  'alternative:Alternate Path': PATH_TYPE_ARROW_COLORS.alternative,
  'named:Set Goals': named('indigo', 1000),
  'named:Check Goals': named('purple', 1000),
  'named:Update Goals': named('tomato', 1000),
  'named:Set Goals Edge Case': named('gold', 1000),
  'named:Update Goals Edge Case': named('crimson', 1000),
}

/** Hash fallback for a path with no registry entry. Step 1100, the badge weight. */
const EXTENDED_PATH_COLORS = PATH_NAMED_FAMILIES.map((f) =>
  named(f, 1100),
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
  unhappy: '7 4',
  exception: '2 4',
  alternative: '12 5',
  named: '7 4 2 4',
}

/**
 * Extra patterns for the types that can have many distinct paths at once, hashed
 * the same way `EXTENDED_PATH_COLORS` is so a path's dash and colour stay paired.
 *
 * One per family in `PATH_NAMED_FAMILIES`. There used to be five against ten
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
 * Dash pattern for a path's arrows and section borders. Mirrors
 * {@link getPathColor}: registry paths get their type's pattern, and the two
 * open-ended types hash into {@link EXTENDED_PATH_DASHES}.
 */
export function getPathDashArray(path: PathColorInput): string | undefined {
  if (path.path_type === 'alternative' || path.path_type === 'named') {
    const key = getPathColorKey(path)
    if (!PATH_COLOR_REGISTRY[key]) {
      return EXTENDED_PATH_DASHES[hashKey(key) % EXTENDED_PATH_DASHES.length]
    }
  }
  return PATH_TYPE_DASH[path.path_type]
}

/**
 * Same, from the `${type}:${name}` key the arrow layers already carry on each
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

function hashKey(key: string): number {
  let hash = 0
  for (const char of key) {
    hash = (hash + char.charCodeAt(0)) | 0
  }
  return Math.abs(hash)
}

export function getPathColor(path: PathColorInput): string {
  const key = getPathColorKey(path)
  const known = PATH_COLOR_REGISTRY[key]
  if (known) return known

  if (path.path_type === 'alternative' || path.path_type === 'named') {
    return EXTENDED_PATH_COLORS[hashKey(key) % EXTENDED_PATH_COLORS.length]
  }

  return PATH_TYPE_COLORS[path.path_type]
}

export function getPathArrowColor(path: PathColorInput): string {
  const key = getPathColorKey(path)
  const known = PATH_ARROW_COLOR_REGISTRY[key]
  if (known) return known

  if (path.path_type === 'alternative' || path.path_type === 'named') {
    return getPathColor(path)
  }

  return PATH_TYPE_ARROW_COLORS[path.path_type]
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

export function getPathBadgeStyle(path: PathColorInput): {
  backgroundColor: string
  color: string
} {
  return {
    backgroundColor: getPathColor(path),
    color: 'var(--color-gray-100)',
  }
}

/** URL-safe marker suffix from a path color key. */
export function pathColorKeyToMarkerSuffix(colorKey: string): string {
  return colorKey.replace(/[^a-zA-Z0-9]+/g, '-')
}
