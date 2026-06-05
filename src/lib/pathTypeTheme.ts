import type { PathType } from '@/types/database'

export const PATH_TYPE_LABELS: Record<PathType, string> = {
  happy: 'Happy path',
  unhappy: 'Unhappy path',
  exception: 'Exception',
  alternative: 'Alternative',
}

/** Stroke color for blueprint trigger arrows per path type. */
export const PATH_TYPE_ARROW_COLORS: Record<PathType, string> = {
  happy: '#10B981',
  unhappy: '#F59E0B',
  exception: '#EF4444',
  alternative: '#3B82F6',
}

export const PATH_TYPE_SWATCH_CLASSES: Record<PathType, string> = {
  happy: 'bg-emerald-500',
  unhappy: 'bg-amber-500',
  exception: 'bg-red-500',
  alternative: 'bg-blue-500',
}

export function getPathTypeArrowColor(pathType: PathType): string {
  return PATH_TYPE_ARROW_COLORS[pathType]
}
