import type { PathType } from '@/types/database'

export const PATH_TYPE_SHORT_LABELS: Record<PathType, string> = {
  happy: 'Happy',
  unhappy: 'Unhappy',
  exception: 'Exception',
  alternative: 'Alternative',
}

export const PATH_TYPE_LABELS: Record<PathType, string> = {
  happy: 'Happy path',
  unhappy: 'Unhappy path',
  exception: 'Exception',
  alternative: 'Alternative',
}

/** Stroke color for blueprint trigger arrows — muted to complement pastel cells. */
export const PATH_TYPE_ARROW_COLORS: Record<PathType, string> = {
  happy: '#5FA88A',
  unhappy: '#C49A5C',
  exception: '#C97171',
  alternative: '#6E8FC7',
}

/** Border width for path section frames (compare + service blueprint). */
export const PATH_TYPE_SECTION_BORDER_WIDTH = 3

export function getPathTypeSectionBorderStyle(pathType: PathType): {
  borderColor: string
  borderStyle: 'solid'
  borderWidth: number
} {
  return {
    borderColor: PATH_TYPE_ARROW_COLORS[pathType],
    borderStyle: 'solid',
    borderWidth: PATH_TYPE_SECTION_BORDER_WIDTH,
  }
}

export function getPathTypeArrowColor(pathType: PathType): string {
  return PATH_TYPE_ARROW_COLORS[pathType]
}

export const PATH_TYPE_SWATCH_CLASSES: Record<PathType, string> = {
  happy: 'bg-emerald-500',
  unhappy: 'bg-amber-500',
  exception: 'bg-red-500',
  alternative: 'bg-blue-500',
}

/** Default Badge fill + label text per path type. */
export const PATH_TYPE_BADGE_CLASSES: Record<PathType, string> = {
  happy: 'bg-emerald-500 text-white',
  unhappy: 'bg-amber-500 text-white',
  exception: 'bg-red-500 text-white',
  alternative: 'bg-blue-500 text-white',
}

/** Path-type suffix for compare labels — omitted when the name already implies the type. */
export function getPathTypeSuffixIfNeeded(path: {
  name: string
  path_type: PathType
}): string | null {
  const short = PATH_TYPE_SHORT_LABELS[path.path_type]
  const full = PATH_TYPE_LABELS[path.path_type]
  const normalized = path.name.toLowerCase()

  if (
    normalized.includes(path.path_type) ||
    normalized.includes(short.toLowerCase()) ||
    normalized.includes(full.toLowerCase())
  ) {
    return null
  }

  return short
}
