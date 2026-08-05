import { RADIX_LIGHT } from '@/lib/radixLight'
import type { PathType } from '@/types/database'

export type PathColorInput = {
  path_type: PathType
  name: string
}

/**
 * Primary accent per path type — also used as defaults for unnamed paths.
 *
 * Radix step 1100, not the Tailwind v3 defaults these used to be (#10B981 and
 * friends). The step matters: `getPathBadgeStyle` renders `#FFFFFF` on this
 * fill, and the old values measured 2.0–2.9:1 against white — the amber one
 * worst. Step 11 is the step Radix specifies for text weight, and every entry
 * here clears 4.98:1 on white.
 *
 * `unhappy` is orange rather than amber for the same reason: amber's step 9/10
 * are near-yellow and unusable under white text, so the whole family would have
 * had to be read at a different step from every other path type.
 */
export const PATH_TYPE_COLORS: Record<PathType, string> = {
  happy: RADIX_LIGHT.green1100,
  unhappy: RADIX_LIGHT.orange1100,
  exception: RADIX_LIGHT.red1100,
  alternative: RADIX_LIGHT.blue1100,
  /** Fallback only — named paths should use per-title registry colors. */
  named: RADIX_LIGHT.indigo1100,
}

/**
 * Stroke color for blueprint trigger arrows — step 1000, one notch lighter than
 * the badge, so a stroke reads as related to the label it belongs to without
 * being the same value. Same family per path type as `PATH_TYPE_COLORS`.
 */
export const PATH_TYPE_ARROW_COLORS: Record<PathType, string> = {
  happy: RADIX_LIGHT.green1000,
  unhappy: RADIX_LIGHT.orange1000,
  exception: RADIX_LIGHT.red1000,
  alternative: RADIX_LIGHT.blue1000,
  named: RADIX_LIGHT.indigo1000,
}

/** Stable identity for path colors across scenarios (same type + name → same color). */
export function getPathColorKey(path: PathColorInput): string {
  return `${path.path_type}:${path.name}`
}

/**
 * Canonical path colors — shared across every scenario.
 * Keys match `getPathColorKey` (`path_type:Path Name`).
 */
export const PATH_COLOR_REGISTRY: Record<string, string> = {
  'happy:Happy Path': PATH_TYPE_COLORS.happy,
  'unhappy:Sad Path': PATH_TYPE_COLORS.unhappy,
  'alternative:Alternate Path': PATH_TYPE_COLORS.alternative,
  'named:Set Goals': RADIX_LIGHT.indigo1100,
  'named:Check Goals': RADIX_LIGHT.violet1100,
  'named:Update Goals': RADIX_LIGHT.pink1100,
  'named:Set Goals Edge Case': RADIX_LIGHT.purple1100,
  'named:Update Goals Edge Case': RADIX_LIGHT.crimson1100,
}

export const PATH_ARROW_COLOR_REGISTRY: Record<string, string> = {
  'happy:Happy Path': PATH_TYPE_ARROW_COLORS.happy,
  'unhappy:Sad Path': PATH_TYPE_ARROW_COLORS.unhappy,
  'alternative:Alternate Path': PATH_TYPE_ARROW_COLORS.alternative,
  'named:Set Goals': RADIX_LIGHT.indigo1000,
  'named:Check Goals': RADIX_LIGHT.violet1000,
  'named:Update Goals': RADIX_LIGHT.pink1000,
  'named:Set Goals Edge Case': RADIX_LIGHT.purple1000,
  'named:Update Goals Edge Case': RADIX_LIGHT.crimson1000,
}

/**
 * Hash fallback for paths with no registry entry. Ten families at step 1100,
 * ordered so adjacent hashes land on distant hues rather than neighbouring ones.
 */
const EXTENDED_PATH_COLORS = [
  RADIX_LIGHT.indigo1100,
  RADIX_LIGHT.orange1100,
  RADIX_LIGHT.violet1100,
  RADIX_LIGHT.green1100,
  RADIX_LIGHT.pink1100,
  RADIX_LIGHT.blue1100,
  RADIX_LIGHT.tomato1100,
  RADIX_LIGHT.purple1100,
  RADIX_LIGHT.gold1100,
  RADIX_LIGHT.crimson1100,
] as const

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
 */
const EXTENDED_PATH_DASHES = [
  '7 4 2 4',
  '12 5',
  '2 4',
  '10 4 2 4 2 4',
  '5 5',
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
    color: '#FFFFFF',
  }
}

/** URL-safe marker suffix from a path color key. */
export function pathColorKeyToMarkerSuffix(colorKey: string): string {
  return colorKey.replace(/[^a-zA-Z0-9]+/g, '-')
}
