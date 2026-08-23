import {
  getPathArrowColor as getPathIdentityArrowColor,
  getPathSectionBorderStyle as getPathIdentitySectionBorderStyle,
  PATH_TYPE_ARROW_COLORS,
  PATH_TYPE_COLORS,
  type PathColorInput,
} from '@/lib/pathColorTheme'
import type { PathType } from '@/types/database'

export { PATH_TYPE_ARROW_COLORS, PATH_TYPE_COLORS } from '@/lib/pathColorTheme'

export const PATH_TYPE_LABELS: Record<PathType, string> = {
  happy: 'Happy',
  variant: 'Variant',
  exception: 'Exception',
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


