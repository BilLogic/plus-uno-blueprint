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

export function getPathSectionBorderStyle(path: PathColorInput): {
  borderColor: string
  borderStyle: 'solid'
  borderWidth: number
} {
  return {
    borderColor: getPathColor(path),
    borderStyle: 'solid',
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
