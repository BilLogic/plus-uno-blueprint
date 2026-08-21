import {
  getPathArrowColor as getPathIdentityArrowColor,
  getPathSectionBorderStyle as getPathIdentitySectionBorderStyle,
  PATH_TYPE_ARROW_COLORS,
  PATH_TYPE_COLORS,
  type PathColorInput,
} from '@/lib/pathColorTheme'
import type { PathType } from '@/types/database'

export { PATH_TYPE_ARROW_COLORS, PATH_TYPE_COLORS } from '@/lib/pathColorTheme'

export const PATH_TYPE_SHORT_LABELS: Record<PathType, string> = {
  happy: 'Happy',
  unhappy: 'Unhappy',
  exception: 'Exception',
  alternative: 'Alternative',
  custom: 'Custom',
}

export const PATH_TYPE_LABELS: Record<PathType, string> = {
  happy: 'Happy path',
  unhappy: 'Unhappy path',
  exception: 'Exception',
  alternative: 'Alternative',
  custom: 'Custom',
}
export const PATH_TYPE_SECTION_BORDER_WIDTH = 3

export function getPathTypeSectionBorderStyle(
  pathType: PathType,
  path?: Pick<PathColorInput, 'name'>,
): {
  borderColor: string
  borderStyle: 'solid' | 'dashed'
  borderWidth: number
} {
  if (path?.name) {
    return getPathIdentitySectionBorderStyle({
      path_type: pathType,
      name: path.name,
    })
  }

  return {
    borderColor: PATH_TYPE_COLORS[pathType],
    // Solid only for the happy path — matches the arrow dash vocabulary.
    borderStyle: pathType === 'happy' ? 'solid' : 'dashed',
    borderWidth: PATH_TYPE_SECTION_BORDER_WIDTH,
  }
}

export function getPathTypeArrowColor(
  pathType: PathType,
  path?: Pick<PathColorInput, 'name'>,
): string {
  if (path?.name) {
    return getPathIdentityArrowColor({ path_type: pathType, name: path.name })
  }

  return PATH_TYPE_ARROW_COLORS[pathType]
}

/** Path-type suffix for compare labels — omitted when the name already implies the type. */
export function getPathTypeSuffixIfNeeded(path: {
  name: string
  path_type: PathType
}): string | null {
  if (path.path_type === 'custom') return null

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

/**
 * Overview frames: show the type badge for every path that HAS an archetype.
 *
 * This used to fire only for paths literally named "Happy Path" / "Alternate
 * Path" — a badge beside a name that already said the type was the only case
 * where it read as informative. Since 2026-08-21 no path is named after its
 * type, so the badge is the only place the archetype appears and it earns its
 * place on all of them. `custom` still shows nothing: it is the absence of an
 * archetype, not one of them.
 */
export function shouldShowPathTypeBadge(path: {
  name: string
  path_type?: PathType
}): boolean {
  return path.path_type !== undefined && path.path_type !== 'custom'
}
