import type { PathType } from '@/types/database'

export type PathColorInput = {
  path_type: PathType
  name: string
}

/** Primary accent per path type — also used as defaults for unnamed paths. */
export const PATH_TYPE_COLORS: Record<PathType, string> = {
  happy: '#10B981',
  unhappy: '#F59E0B',
  exception: '#EF4444',
  alternative: '#3B82F6',
  /** Fallback only — named paths should use per-title registry colors. */
  named: '#6366F1',
}

/** Stroke color for blueprint trigger arrows — muted to complement pastel cells. */
export const PATH_TYPE_ARROW_COLORS: Record<PathType, string> = {
  happy: '#5FA88A',
  unhappy: '#C49A5C',
  exception: '#C97171',
  alternative: '#6E8FC7',
  named: '#7C83DB',
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
  'named:Set Goals': '#6366F1',
  'named:Check Goals': '#8B5CF6',
  'named:Update Goals': '#EC4899',
  'named:Set Goals Edge Case': '#0EA5E9',
  'named:Update Goals Edge Case': '#14B8A6',
}

export const PATH_ARROW_COLOR_REGISTRY: Record<string, string> = {
  'happy:Happy Path': PATH_TYPE_ARROW_COLORS.happy,
  'unhappy:Sad Path': PATH_TYPE_ARROW_COLORS.unhappy,
  'alternative:Alternate Path': PATH_TYPE_ARROW_COLORS.alternative,
  'named:Set Goals': '#7C83DB',
  'named:Check Goals': '#9F88D8',
  'named:Update Goals': '#D16BA0',
  'named:Set Goals Edge Case': '#3DAFD6',
  'named:Update Goals Edge Case': '#3CB8A8',
}

const EXTENDED_PATH_COLORS = [
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#0EA5E9',
  '#14B8A6',
  '#F97316',
  '#84CC16',
  '#A855F7',
  '#E11D48',
  '#0891B2',
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
